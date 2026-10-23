const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const User = require('./models/User');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for images

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/resideai')
  .then(async () => {
    console.log('MongoDB connected');
    try {
      await User.deleteMany({ tamilRole: 'superAdmin' });
    } catch (err) {
      console.error('Failed to remove legacy superAdmin users:', err?.message || err);
    }

    try {
      const usersWithUppercaseEmail = await User.find({ email: /[A-Z]/ }).select('_id email').lean();
      for (const u of usersWithUppercaseEmail) {
        const current = String(u.email || '');
        const normalized = current.trim().toLowerCase();
        if (!normalized || normalized === current) continue;

        const conflict = await User.findOne({ email: normalized }).select('_id').lean();
        if (conflict && String(conflict._id) !== String(u._id)) {
          continue;
        }

        await User.updateOne({ _id: u._id }, { $set: { email: normalized } });
      }
    } catch (err) {
      console.error('Failed to normalize user emails:', err?.message || err);
    }

    try {
      const raw = process.env.INITIAL_ADMIN_EMAILS || '';
      const emails = raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (emails.length) {
        await User.updateMany(
          { email: { $in: emails } },
          { $set: { role: 'admin', approved: true, blocked: false } }
        );
        console.log(`Initial admin promotion applied for: ${emails.join(', ')}`);
      }
    } catch (err) {
      console.error('Failed to apply initial admin promotion:', err?.message || err);
    }

    try {
      const Property = require('./models/Property');
      const propertiesToMigrate = await Property.find({
        $or: [
          { listingStatus: { $exists: false } },
          { listingStatus: null },
          { isListed: { $exists: false } },
          { isListed: null }
        ]
      });

      if (propertiesToMigrate.length > 0) {
        console.log(`Migrating listingStatus for ${propertiesToMigrate.length} legacy properties...`);
        for (const p of propertiesToMigrate) {
          if (p.saleStatus === 'sold' || p.buyer != null) {
            p.listingStatus = 'unlisted';
            p.isListed = false;
          } else if (p.occupancyStatus === 'occupied' || p.tenant != null) {
            p.listingStatus = 'unavailable';
            p.isListed = false;
          } else if (p.saleStatus === 'under_contract') {
            p.listingStatus = 'unavailable';
            p.isListed = false;
          } else if (p.status === 'approved' && p.occupancyStatus === 'vacant' && p.saleStatus === 'available') {
            p.listingStatus = 'listed';
            p.isListed = true;
            p.listedAt = p.listedAt || new Date();
          } else {
            p.listingStatus = 'unlisted';
            p.isListed = false;
          }
          await p.save();
        }
        console.log('Property listingStatus migration completed successfully.');
      }
    } catch (err) {
      console.error('Failed to migrate property listingStatus:', err?.message || err);
    }
  })
  .catch(err => console.log('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const agreementRoutes = require('./routes/agreements');
const vacateRequestRoutes = require('./routes/vacateRequests');
const conversationRoutes = require('./routes/conversations');
const visitRoutes = require('./routes/visits');
const auth = require('./middleware/auth');
const Agreement = require('./models/Agreement');

// Direct agreement document upload endpoint to avoid routing issues
app.put('/api/agreements/:id/documents', auth, async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ msg: 'Name and data are required' });
    }

    const agreement = await Agreement.findById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ msg: 'Agreement not found' });
    }

    if (agreement.tenant.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (!Array.isArray(agreement.documents)) {
      agreement.documents = [];
    }

    agreement.documents.push({
      name,
      data,
      uploadedAt: new Date()
    });

    await agreement.save();

    res.json(agreement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.post('/api/voice-to-text', upload.single('audio'), async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ msg: 'OPENAI_API_KEY is not configured' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No audio file uploaded' });
    }

    const form = new FormData();
    form.append('model', 'whisper-1');
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm',
    });

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000,
    });

    return res.json({ text: response?.data?.text || '' });
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data;
    console.error('voice-to-text error:', status || err?.message || err, details || '');
    return res.status(500).json({ msg: 'Voice to text failed' });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const text = req.body?.text;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ msg: 'text is required' });
    }

    const targetLanguageRaw = req.body?.targetLanguage;
    const targetLanguage =
      typeof targetLanguageRaw === 'string' && targetLanguageRaw.trim()
        ? targetLanguageRaw.trim().toLowerCase()
        : 'en';

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ msg: 'OPENAI_API_KEY is not configured' });
    }

    const model = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini';

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Detect the language of the input text. Return ONLY valid JSON with keys: originalText, detectedLanguage, englishText, tamilText.\n\nRules:\n- detectedLanguage should be ISO 639-1 when possible (e.g., "en", "ta", "hi").\n- englishText must be the English translation of the input. If already English, englishText must equal originalText.\n- tamilText must be the Tamil translation of the input. If already Tamil, tamilText must equal originalText.\n- Keep meaning and numbers intact.',
          },
          { role: 'user', content: text },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }

    const originalText = typeof parsed?.originalText === 'string' ? parsed.originalText : text;
    const englishText = typeof parsed?.englishText === 'string' ? parsed.englishText : originalText;
    const tamilText = typeof parsed?.tamilText === 'string' ? parsed.tamilText : originalText;
    const detectedLanguage =
      typeof parsed?.detectedLanguage === 'string' && parsed.detectedLanguage.trim()
        ? parsed.detectedLanguage.trim()
        : 'unknown';

    const translatedText = targetLanguage === 'ta' ? tamilText : englishText;

    return res.json({ originalText, translatedText, detectedLanguage, englishText, tamilText });
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data;
    console.error('translate error:', status || err?.message || err, details || '');
    return res.status(500).json({ msg: 'Translation failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/vacate-request', vacateRequestRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/notifications', require('./routes/notifications'));

app.get('/', (req, res) => {
  res.send('ReSideAI API is running');
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server and restart this backend.`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
