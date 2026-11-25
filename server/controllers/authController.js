const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateNumericOtp, isOtpExpired, canResendOtp } = require('../utilities/otp');
const { sendOtpEmail } = require('../utilities/mailer');
const { sendVerificationEmail } = require('../utils/sendEmail');

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
    const { name, email, password, tamilRole, registrationPurpose } = req.body;

    // Support either registrationPurpose or legacy tamilRole
    const purposeInput = registrationPurpose || tamilRole;
    if (!name || !email || !password || !purposeInput) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    // Determine registration purpose and whether this is an admin request
    let normalizedPurpose = 'Customer';
    let isAdminRegistration = false;

    const rawLower = String(purposeInput).trim().toLowerCase();
    if (rawLower === 'admin') {
      isAdminRegistration = true;
    } else if (rawLower === 'owner' || rawLower === 'owners') {
      normalizedPurpose = 'Owner';
    } else if (rawLower === 'builder' || rawLower === 'builders') {
      normalizedPurpose = 'Builder';
    } else if (rawLower === 'dealer' || rawLower === 'dealers' || rawLower === 'brokersbuilders' || rawLower === 'broker') {
      normalizedPurpose = 'Dealer';
    } else if (rawLower === 'customer' || rawLower === 'customers' || rawLower === 'tenant' || rawLower === 'buyer') {
      normalizedPurpose = 'Customer';
    } else {
      return res.status(400).json({ msg: 'Invalid registration purpose. Must be Owner, Builder, Dealer, or Customer.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const initialAdminEmails = parseInitialAdminEmails();

    if (isAdminRegistration && !initialAdminEmails.has(normalizedEmail)) {
      return res.status(403).json({ msg: 'Admin registration is not enabled for this email' });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const emailOtpExpires = new Date(Date.now() + OTP_VALIDITY_MS);

    const legacyTamilRole = isAdminRegistration
      ? 'admin'
      : normalizedPurpose === 'Owner'
        ? 'owners'
        : normalizedPurpose === 'Customer'
          ? 'customers'
          : 'brokersBuilders';

    if (user && !user.isVerified) {
      user.name = name;
      user.password = hashedPassword;
      user.email = normalizedEmail;
      user.registrationPurpose = normalizedPurpose;
      user.tamilRole = legacyTamilRole;
      user.approved = true;
      user.blocked = false;
      user.role = isAdminRegistration ? 'admin' : 'user';
      user.emailOtpHash = emailOtpHash;
      user.emailOtpExpires = emailOtpExpires;
      user.otp = otp;
      user.otpExpiry = emailOtpExpires;
      user.otpPurpose = 'register';
      user.otpAttempts = 0;
      user.isVerified = false;
      user.isEmailVerified = false;
    } else if (!user) {
      user = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        registrationPurpose: normalizedPurpose,
        tamilRole: legacyTamilRole,
        approved: true,
        role: isAdminRegistration ? 'admin' : 'user',
        isVerified: false,
        isEmailVerified: false,
        emailOtpHash,
        emailOtpExpires,
        otp,
        otpExpiry: emailOtpExpires,
        otpPurpose: 'register',
        otpAttempts: 0
      });
    }

    await user.save();

    try {
      await sendVerificationEmail(normalizedEmail, otp, user.name || 'User');
    } catch (mailErr) {
      console.error('[Registration Mailer Error]', mailErr.message);
      return res.status(500).json({
        success: false,
        msg: mailErr.message || 'Failed to send verification email',
        message: mailErr.message || 'Failed to send verification email'
      });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to ' + normalizedEmail,
      msg: 'Verification code sent to ' + normalizedEmail
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error', message: 'Server error' });
  }
}

async function verifyRegistrationOtp(req, res) {
  try {
    const { email, otp, code } = req.body;
    const submittedOtp = String(otp || code || '').trim();

    if (!email || !submittedOtp) {
      return res.status(400).json({ success: false, msg: 'Email and OTP are required', message: 'Email and OTP are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ success: false, msg: 'Invalid OTP or email', message: 'Invalid OTP or email' });
    }

    if (user.isVerified && user.isEmailVerified && !user.emailOtpHash && !user.otp) {
      const token = createTokenForUser(user);
      return res.json({
        success: true,
        message: 'Account already verified',
        msg: 'Account already verified',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.tamilRole,
          tamilRole: user.tamilRole,
          internalRole: user.role,
          isEmailVerified: true
        }
      });
    }

    const now = new Date();
    const expiry = user.emailOtpExpires || user.otpExpiry;
    if (!expiry || expiry < now) {
      return res.status(400).json({ success: false, msg: 'OTP has expired', message: 'OTP has expired' });
    }

    if (user.otpAttempts >= 5) {
      return res
        .status(400)
        .json({ success: false, msg: 'Maximum OTP attempts exceeded. Please request a new OTP.', message: 'Maximum OTP attempts exceeded. Please request a new OTP.' });
    }

    const hashedSubmitted = crypto.createHash('sha256').update(submittedOtp).digest('hex');
    const isMatch = (user.emailOtpHash && user.emailOtpHash === hashedSubmitted) || (user.otp && user.otp === submittedOtp);

    if (!isMatch) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, msg: 'Invalid OTP', message: 'Invalid OTP' });
    }

    user.isEmailVerified = true;
    user.isVerified = true;
    if (user.role === 'user') {
      user.approved = true;
    }
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = undefined;
    user.otpAttempts = 0;
    await user.save();

    const token = createTokenForUser(user);

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      msg: 'Email verified successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationPurpose: user.registrationPurpose || (user.tamilRole === 'owners' ? 'Owner' : user.tamilRole === 'brokersBuilders' ? 'Builder' : 'Customer'),
        tamilRole: user.tamilRole,
        internalRole: user.role,
        isEmailVerified: true
      }
    });
  } catch (err) {
    console.error('Verify registration OTP error:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error', message: 'Server error' });
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

    if (user.role === 'user' && !user.approved) {
      user.approved = true;
      await user.save();
    }

    if (user.role === 'admin' && !user.approved) {
      return res.status(403).json({ msg: 'Account pending approval. Please wait for admin approval.' });
    }

    const token = createTokenForUser(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationPurpose: user.registrationPurpose || (user.tamilRole === 'owners' ? 'Owner' : user.tamilRole === 'brokersBuilders' ? 'Builder' : 'Customer'),
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

async function sendOtp(req, res) {
  try {
    const { email, purpose } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, msg: 'Email is required', message: 'Email is required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found', message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const emailOtpExpires = new Date(Date.now() + OTP_VALIDITY_MS);

    user.emailOtpHash = emailOtpHash;
    user.emailOtpExpires = emailOtpExpires;
    user.otp = otp;
    user.otpExpiry = emailOtpExpires;
    user.otpPurpose = purpose || 'register';
    user.otpAttempts = 0;
    await user.save();

    try {
      await sendVerificationEmail(normalizedEmail, otp, user.name || 'User');
    } catch (mailErr) {
      console.error('[Send OTP Mailer Error]', mailErr.message);
      return res.status(500).json({
        success: false,
        msg: mailErr.message || 'Failed to send verification email',
        message: mailErr.message || 'Failed to send verification email'
      });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to ' + normalizedEmail,
      msg: 'Verification code sent to ' + normalizedEmail
    });
  } catch (err) {
    console.error('sendOtp error:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error', message: 'Server error' });
  }
}

async function resendOtp(req, res) {
  try {
    const { email, purpose } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, msg: 'Email is required', message: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json({
        success: true,
        message: 'If this email is registered, a new OTP has been sent.',
        msg: 'If this email is registered, a new OTP has been sent.'
      });
    }

    const expiry = user.emailOtpExpires || user.otpExpiry;
    if (expiry && !canResendOtp(expiry)) {
      return res
        .status(429)
        .json({ success: false, msg: 'Please wait before requesting a new OTP.', message: 'Please wait before requesting a new OTP.' });
    }

    // If purpose is forgot password, maintain password reset flow untouched
    if (purpose === 'forgot') {
      const otp = generateNumericOtp(6);
      const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      user.otpPurpose = 'forgot';
      user.otpAttempts = 0;
      await user.save();

      const mailResult = await sendOtpEmail(normalizedEmail, otp, 'forgot');
      return res.json({
        msg: 'A new OTP has been sent if the email is registered.',
        devOtp: process.env.NODE_ENV !== 'production' || !mailResult.success ? otp : undefined
      });
    }

    // For email verification (signup / profile)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const emailOtpExpires = new Date(Date.now() + OTP_VALIDITY_MS);

    user.emailOtpHash = emailOtpHash;
    user.emailOtpExpires = emailOtpExpires;
    user.otp = otp;
    user.otpExpiry = emailOtpExpires;
    user.otpPurpose = purpose || 'register';
    user.otpAttempts = 0;
    await user.save();

    try {
      await sendVerificationEmail(normalizedEmail, otp, user.name || 'User');
    } catch (mailErr) {
      console.error('[Resend OTP Mailer Error]', mailErr.message);
      return res.status(500).json({
        success: false,
        msg: mailErr.message || 'Failed to send verification email',
        message: mailErr.message || 'Failed to send verification email'
      });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to ' + normalizedEmail,
      msg: 'Verification code sent to ' + normalizedEmail
    });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error', message: 'Server error' });
  }
}

module.exports = {
  register,
  verifyRegistrationOtp,
  login,
  forgotPassword,
  resetPasswordWithOtp,
  resendOtp,
  sendOtp
};
