const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const User = require('../models/User');

async function seedSuperAdmin() {
  const username = (process.env.SUPERADMIN_USERNAME || '').trim();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  const pin = (process.env.SUPERADMIN_PIN || '').trim();
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();

  if (!username || !password) {
    console.error(
      'Missing required environment variables: SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in server/.env.'
    );
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resideai';
  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.name;
  console.log(`Connected to MongoDB database: ${dbName}`);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const securityPinHash = pin ? await bcrypt.hash(pin, 10) : undefined;

    const usernameRegex = new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const existing = await User.findOne(
      email
        ? { $or: [{ username: usernameRegex }, { email }] }
        : { username: usernameRegex }
    );

    let savedUser;
    if (existing) {
      existing.username = username;
      if (email) {
        existing.email = email;
      }
      existing.name = existing.name || username;
      existing.password = hashedPassword;
      if (securityPinHash) {
        existing.securityPinHash = securityPinHash;
      }
      existing.role = 'superadmin';
      existing.tamilRole = 'admin';
      existing.isEmailVerified = true;
      existing.isVerified = true;
      existing.approved = true;
      existing.blocked = false;
      existing.isSuspended = false;
      savedUser = await existing.save();
    } else {
      const doc = {
        username,
        name: username,
        password: hashedPassword,
        role: 'superadmin',
        tamilRole: 'admin',
        isEmailVerified: true,
        isVerified: true,
        approved: true,
        blocked: false,
        isSuspended: false,
      };
      if (email) {
        doc.email = email;
      }
      if (securityPinHash) {
        doc.securityPinHash = securityPinHash;
      }
      savedUser = await User.create(doc);
    }

    console.log('Super Admin seeded successfully:', {
      dbName,
      userId: String(savedUser._id),
      username: savedUser.username,
      email: savedUser.email || '(none)',
      role: savedUser.role,
      isEmailVerified: savedUser.isEmailVerified,
      isSuspended: savedUser.isSuspended,
      passwordStartsWith$2: String(savedUser.password || '').startsWith('$2'),
      hasSecurityPin: Boolean(pin || savedUser.securityPinHash),
    });
  } finally {
    await mongoose.disconnect();
  }
}

seedSuperAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed Super Admin:', err?.message || err);
    process.exit(1);
  });
