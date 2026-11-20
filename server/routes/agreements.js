const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Agreement = require('../models/Agreement');
const Request = require('../models/Request');
const { upsertAgreementDocument, verifyAgreementDocument } = require('../services/agreementService');

const uploadDir = path.join(__dirname, '../uploads');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {}
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '') || '.pdf';
    cb(null, 'agr-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Auth middleware that tolerates missing tokens for flexible client integrations
const auth = (req, res, next) => {
  const token = req.header('x-auth-token') || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded.user || decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token') || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded.user || decoded;
    } catch (e) {}
  }
  next();
};

// Universal upload handler that upserts in MongoDB and broadcasts via Socket.IO
async function handleUpload(req, res) {
  try {
    const io = req.app.get('io');
    const targetId =
      req.params.id ||
      req.params.propertyId ||
      req.body.propertyId ||
      req.body.rentalId ||
      req.body.canonicalPropertyId ||
      req.body.id ||
      req.body._id;

    const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;

    const agreement = await upsertAgreementDocument({
      targetId,
      file,
      body: req.body,
      user: req.user,
      io,
    });

    return res.status(200).json(agreement);
  } catch (err) {
    console.error('Agreement upload error:', err);
    return res.status(500).json({ msg: err.message || 'Server Error' });
  }
}

// Universal verify / accept / reject handler
async function handleVerify(req, res) {
  try {
    const io = req.app.get('io');
    const targetId =
      req.params.id ||
      req.body.agreementId ||
      req.body.id ||
      req.body.targetId ||
      req.body.propertyId;

    const propertyId = req.body.propertyId || req.params.propertyId;
    const status = req.body.status || 'APPROVED';
    const ownerNote = req.body.ownerNote || req.body.ownerMessage || req.body.note || '';

    const agreement = await verifyAgreementDocument({
      targetId,
      propertyId,
      status,
      ownerNote,
      reviewedAt: req.body.reviewedAt,
      body: req.body,
      user: req.user,
      io,
    });

    return res.status(200).json(agreement);
  } catch (err) {
    console.error('Agreement verify error:', err);
    return res.status(400).json({ msg: err.message || 'Server Error' });
  }
}

// ----------------------------------------------------
// 1. SPECIFIC GET ROUTES (Registered BEFORE parameterized :id)
// ----------------------------------------------------

// Get all agreements
router.get('/', optionalAuth, async (req, res) => {
  try {
    const agreements = await Agreement.find()
      .populate('property')
      .populate('tenant', 'name email phone')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });
    
    const validAgreements = [];
    for (const a of agreements) {
      if (a && a.property && a.property._id) {
        validAgreements.push(a);
      } else if (a && a._id) {
        await Agreement.deleteOne({ _id: a._id });
      }
    }
    res.json(validAgreements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get agreements for Tenant
router.get('/tenant', auth, async (req, res) => {
  try {
    const agreements = await Agreement.find({ tenant: req.user.id })
      .populate('property')
      .populate('owner', 'name email phone address')
      .sort({ createdAt: -1 });

    const validAgreements = [];
    for (const a of agreements) {
      if (a && a.property && a.property._id) {
        validAgreements.push(a);
      } else if (a && a._id) {
        await Agreement.deleteOne({ _id: a._id });
      }
    }
    res.json(validAgreements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get agreements for Owner
router.get('/owner', auth, async (req, res) => {
  try {
    const agreements = await Agreement.find({ owner: req.user.id })
      .populate('property')
      .populate('tenant', 'name email phone address')
      .sort({ createdAt: -1 });

    const validAgreements = [];
    for (const a of agreements) {
      if (a && a.property && a.property._id) {
        validAgreements.push(a);
      } else if (a && a._id) {
        await Agreement.deleteOne({ _id: a._id });
      }
    }
    res.json(validAgreements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get agreements by Property ID
router.get('/property/:propertyId', optionalAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const pIdStr = String(propertyId || '').trim();

    if (!pIdStr || pIdStr === 'undefined' || pIdStr === 'null') {
      return res.json([]);
    }

    const orConditions = [
      { propertyId: pIdStr },
      { canonicalPropertyId: pIdStr }
    ];
    if (mongoose.Types.ObjectId.isValid(pIdStr)) {
      orConditions.push({ property: new mongoose.Types.ObjectId(pIdStr) });
    }

    let agreements = await Agreement.find({ $or: orConditions })
      .populate('property')
      .populate('tenant', 'name email phone')
      .populate('owner', 'name email phone')
      .sort({ updatedAt: -1, createdAt: -1 });

    // Fallback if rental request has an uploaded document FOR THIS EXACT PROPERTY
    if (agreements.length === 0 && mongoose.Types.ObjectId.isValid(pIdStr)) {
      try {
        const rentalDoc = await Request.findOne({
          property: new mongoose.Types.ObjectId(pIdStr),
          $or: [
            { agreementDocument: { $exists: true, $ne: '' } },
            { signedAgreementUrl: { $exists: true, $ne: '' } },
            { agreementFile: { $exists: true, $ne: '' } }
          ]
        }).populate('property').populate('tenant').populate('owner');

        if (rentalDoc) {
          const fileDataUrl = rentalDoc.agreementDocument || rentalDoc.signedAgreementUrl || rentalDoc.agreementFile;
          const fallbackAgr = {
            _id: rentalDoc.agreement || new mongoose.Types.ObjectId(),
            propertyId: String(rentalDoc.property?._id || pIdStr),
            rentalId: String(rentalDoc._id),
            property: rentalDoc.property,
            tenant: rentalDoc.tenant,
            owner: rentalDoc.owner,
            propertyTitle: rentalDoc.property?.title || 'Rental Property',
            tenantName: rentalDoc.tenant?.name || 'Tenant',
            ownerName: rentalDoc.owner?.name || 'Owner',
            fileName: 'edee.pdf',
            fileType: 'application/pdf',
            fileDataUrl,
            fileUrl: fileDataUrl,
            status: 'PENDING',
            verificationStatus: 'PENDING',
            uploadedAt: new Date(rentalDoc.updatedAt || Date.now()).toLocaleString(),
            ownerMessage: '',
            createdAt: rentalDoc.createdAt || new Date(),
            updatedAt: rentalDoc.updatedAt || new Date(),
          };
          agreements = [fallbackAgr];
        }
      } catch (e) {}
    }

    // Strict filter to guarantee agreements belong strictly to requested property
    agreements = agreements.filter(ag => {
      const matchId = String(ag.propertyId || ag.canonicalPropertyId || ag.property?._id || ag.property || '');
      return matchId === pIdStr;
    });

    agreements = agreements.map(ag => {
      const obj = ag.toObject ? ag.toObject() : { ...ag };
      if (!obj.fileDataUrl && obj.documents && obj.documents.length > 0) {
        const latestDoc = obj.documents[obj.documents.length - 1];
        obj.fileName = obj.fileName || latestDoc.name;
        obj.fileDataUrl = latestDoc.data;
      }
      return obj;
    });

    res.json(agreements);
  } catch (err) {
    console.error('Error in GET /agreements/property/:propertyId:', err.message);
    res.status(500).send('Server Error');
  }
});

// ----------------------------------------------------
// 2. UPLOAD ROUTES (Matching all path variations to avoid 404)
// ----------------------------------------------------
router.post('/upload', optionalAuth, upload.any(), handleUpload);
router.post('/property/:id/upload', optionalAuth, upload.any(), handleUpload);
router.post('/:id/upload', optionalAuth, upload.any(), handleUpload);

// Support both POST and PUT for document uploads
router.post('/:id/documents', optionalAuth, upload.any(), handleUpload);
router.put('/:id/documents', optionalAuth, upload.any(), handleUpload);
router.post('/property/:id/documents', optionalAuth, upload.any(), handleUpload);
router.put('/property/:id/documents', optionalAuth, upload.any(), handleUpload);
router.post('/', optionalAuth, upload.any(), handleUpload);

// ----------------------------------------------------
// 3. VERIFICATION ROUTES
// ----------------------------------------------------
router.put('/:id/verify', optionalAuth, handleVerify);
router.put('/property/:id/verify', optionalAuth, handleVerify);
router.put('/verify/:id', optionalAuth, handleVerify);
router.put('/verify', optionalAuth, handleVerify);

// ----------------------------------------------------
// 4. TENANT FILL & SIGN ROUTE
// ----------------------------------------------------
router.put('/:id/fill', auth, async (req, res) => {
  try {
    const { startDate, durationMonths, terms } = req.body;
    let agreement = await Agreement.findById(req.params.id);

    if (!agreement) return res.status(404).json({ msg: 'Agreement not found' });

    if (agreement.tenant && agreement.tenant.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (startDate) agreement.startDate = new Date(startDate);
    if (durationMonths) {
      const start = agreement.startDate || new Date();
      agreement.endDate = new Date(new Date(start).setMonth(new Date(start).getMonth() + parseInt(durationMonths)));
    }
    if (terms) agreement.terms = terms;

    agreement.status = 'active';
    agreement.verificationStatus = 'APPROVED';
    await agreement.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('agreement:synced', agreement);
    }

    res.json(agreement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ----------------------------------------------------
// 5. PARAMETERIZED GET ROUTE (:id at bottom)
// ----------------------------------------------------
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (['tenant', 'owner', 'upload', 'verify'].includes(id)) return res.json([]);

    let agreement = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      agreement = await Agreement.findById(id);
    }
    if (!agreement) {
      agreement = await Agreement.findOne({
        $or: [
          { propertyId: id },
          { canonicalPropertyId: id },
          { rentalId: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ property: id }] : [])
        ]
      });
    }

    if (agreement && typeof agreement.populate === 'function') {
      try {
        await agreement.populate([
          { path: 'property' },
          { path: 'tenant', select: 'name email phone' },
          { path: 'owner', select: 'name email phone' },
        ]);
      } catch (e) {}
    }

    // Return 200 with null instead of 404 when no document exists yet
    return res.status(200).json(agreement || null);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
