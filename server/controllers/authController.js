const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateNumericOtp, isOtpExpired, canResendOtp } = require('../utilities/otp');
const { sendOtpEmail } = require('../utilities/mailer');

const OTP_VALIDITY_MS = 5 * 60_000;

function parseInitialAdminEmails() {
  const raw = process.env.INITIAL_ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function createTokenForUser(user) {
  const payload = { user: { id: user.id } };
  return jwt.sign(payload, 'secret', { expiresIn: '1d' });
}

async function register(req, res) {
  try {
    const { name, email, password, tamilRole } = req.body;

    if (!name || !email || !password || !tamilRole) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    const normalizedTamilRole = String(tamilRole);
    if (!['owners', 'brokersBuilders', 'customers', 'admin'].includes(normalizedTamilRole)) {
      return res.status(400).json({ msg: 'Invalid role' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const initialAdminEmails = parseInitialAdminEmails();
    const isAdminRegistration = normalizedTamilRole === 'admin';

    if (isAdminRegistration && !initialAdminEmails.has(normalizedEmail)) {
      return res.status(403).json({ msg: 'Admin registration is not enabled for this email' });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateNumericOtp(6);
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    if (user && !user.isVerified) {
      user.name = name;
      user.password = hashedPassword;
      user.email = normalizedEmail;
      user.tamilRole = normalizedTamilRole;
      user.approved = isAdminRegistration ? true : false;
      user.blocked = false;
      user.role = isAdminRegistration ? 'admin' : 'user';
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      user.otpPurpose = 'register';
      user.otpAttempts = 0;
      user.isVerified = false;
    } else if (!user) {
      user = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        tamilRole: normalizedTamilRole,
        approved: isAdminRegistration ? true : false,
        role: isAdminRegistration ? 'admin' : 'user',
        isVerified: false,
        otp,
        otpExpiry,
        otpPurpose: 'register',
        otpAttempts: 0
      });
    }

    await user.save();
    const mailResult = await sendOtpEmail(normalizedEmail, otp, 'register');

    return res.json({
      msg: mailResult.success
        ? 'OTP sent to your email for verification'
        : 'OTP generated. Note: Email service could not deliver OTP; use dev OTP code.',
      devOtp: process.env.NODE_ENV !== 'production' || !mailResult.success ? otp : undefined
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    return res.status(500).send('Server error');
  }
}

async function verifyRegistrationOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ msg: 'Email and OTP are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid OTP or email' });
    }

    if (user.isVerified && !user.otp) {
      const token = createTokenForUser(user);
      return res.json({
        msg: 'Account already verified',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.tamilRole,
          tamilRole: user.tamilRole,
          internalRole: user.role
        }
      });
    }

    if (user.otpPurpose !== 'register') {
      return res.status(400).json({ msg: 'Invalid OTP purpose' });
    }

    if (isOtpExpired(user.otpExpiry)) {
      return res.status(400).json({ msg: 'OTP has expired' });
    }

    if (user.otpAttempts >= 3) {
      return res
        .status(400)
        .json({ msg: 'Maximum OTP attempts exceeded. Please request a new OTP.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = undefined;
    user.otpAttempts = 0;
    await user.save();

    const token = createTokenForUser(user);

    return res.json({
      msg: 'Account verified successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.tamilRole,
        tamilRole: user.tamilRole,
        internalRole: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Server error');
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    if (user.blocked) {
      return res.status(403).json({ msg: 'Your account has been blocked. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ msg: 'Please verify your email before logging in.' });
    }

    if (!user.approved) {
      return res.status(403).json({ msg: 'Account pending approval. Please wait for admin approval.' });
    }

    const token = createTokenForUser(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.tamilRole,
        tamilRole: user.tamilRole,
        internalRole: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Server error');
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.isVerified) {
      return res.json({
        msg: 'If this email is registered and verified, an OTP has been sent.'
      });
    }

    const otp = generateNumericOtp(6);
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpPurpose = 'forgot';
    user.otpAttempts = 0;
    await user.save();

    const mailResult = await sendOtpEmail(normalizedEmail, otp, 'forgot');

    return res.json({
      msg: 'If this email is registered and verified, an OTP has been sent.',
      devOtp: process.env.NODE_ENV !== 'production' || !mailResult.success ? otp : undefined
    });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    return res.status(500).send('Server error');
  }
}

async function resetPasswordWithOtp(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ msg: 'Email, OTP and new password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isVerified) {
      return res.status(400).json({ msg: 'Invalid OTP or email' });
    }

    if (user.otpPurpose !== 'forgot') {
      return res.status(400).json({ msg: 'Invalid OTP purpose' });
    }

    if (isOtpExpired(user.otpExpiry)) {
      return res.status(400).json({ msg: 'OTP has expired' });
    }

    if (user.otpAttempts >= 3) {
      return res
        .status(400)
        .json({ msg: 'Maximum OTP attempts exceeded. Please request a new OTP.' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = undefined;
    user.otpAttempts = 0;
    await user.save();

    return res.json({ msg: 'Password reset successfully' });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Server error');
  }
}

async function resendOtp(req, res) {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ msg: 'Email and purpose are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json({ msg: 'If this email is registered, a new OTP has been sent.' });
    }

    if (!canResendOtp(user.otpExpiry)) {
      return res
        .status(429)
        .json({ msg: 'Please wait before requesting a new OTP.' });
    }

    const otp = generateNumericOtp(6);
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpPurpose = purpose;
    user.otpAttempts = 0;
    await user.save();

    const mailResult = await sendOtpEmail(normalizedEmail, otp, purpose);

    return res.json({
      msg: 'A new OTP has been sent if the email is registered.',
      devOtp: process.env.NODE_ENV !== 'production' || !mailResult.success ? otp : undefined
    });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    return res.status(500).send('Server error');
  }
}

module.exports = {
  register,
  verifyRegistrationOtp,
  login,
  forgotPassword,
  resetPasswordWithOtp,
  resendOtp
};
