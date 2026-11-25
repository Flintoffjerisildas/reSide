const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/sendEmail');

/**
 * Normalize phone number to MSG91's international format without leading + (e.g., 91XXXXXXXXXX)
 */
function normalizeMsg91Mobile(inputPhone) {
  if (!inputPhone) return '';
  const digits = String(inputPhone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

// POST /api/profile/send-verification-otp
router.post('/send-verification-otp', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found', message: 'User not found' });
    }

    const emailToSend = String(req.body.email || user.email).trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const emailOtpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.emailOtpHash = emailOtpHash;
    user.emailOtpExpires = emailOtpExpires;
    user.otp = otp;
    user.otpExpiry = emailOtpExpires;
    user.otpPurpose = 'profile-email-verify';
    user.otpAttempts = 0;
    await user.save();

    try {
      await sendVerificationEmail(emailToSend, otp, user.name || 'User');
    } catch (mailErr) {
      console.error('sendVerificationEmail error in profile:', mailErr.message);
      return res.status(500).json({
        success: false,
        msg: mailErr.message || 'Failed to send verification email',
        message: mailErr.message || 'Failed to send verification email'
      });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to ' + emailToSend,
      msg: 'Verification code sent to ' + emailToSend
    });
  } catch (err) {
    console.error('Profile send-verification-otp error:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error', message: 'Server error' });
  }
});

// POST /api/profile/verify-otp
router.post('/verify-otp', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found', message: 'User not found' });
    }

    const submittedOtp = String(req.body.otp || req.body.code || '').trim();
    if (!submittedOtp) {
      return res.status(400).json({ success: false, msg: 'OTP is required', message: 'OTP is required' });
    }

    const now = new Date();
    const expiry = user.emailOtpExpires || user.otpExpiry;
    if (!expiry || expiry < now) {
      return res.status(400).json({ success: false, msg: 'OTP has expired', message: 'OTP has expired' });
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
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = undefined;
    user.otpAttempts = 0;
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      msg: 'Email verified successfully!'
    });
  } catch (err) {
    console.error('Profile verify-otp error:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error', message: 'Server error' });
  }
});

// =========================================================================
// PHONE NUMBER OTP VERIFICATION (MSG91 API)
// =========================================================================

// POST /api/profile/send-phone-otp
router.post('/send-phone-otp', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', msg: 'User not found' });
    }

    const rawPhone = String(req.body.phone || user.phone || '').trim();
    const formattedMobile = normalizeMsg91Mobile(rawPhone);

    if (!formattedMobile || formattedMobile.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number',
        msg: 'Please provide a valid 10-digit mobile number'
      });
    }

    const msg91AuthKey = (process.env.MSG91_AUTH_KEY || '').trim();
    const templateId = (process.env.MSG91_TEMPLATE_ID || '').trim();

    if (!msg91AuthKey) {
      return res.status(500).json({
        success: false,
        message: 'MSG91_AUTH_KEY is not configured in server/.env',
        msg: 'MSG91_AUTH_KEY is not configured in server/.env'
      });
    }

    const tenDigitNumber = formattedMobile.slice(-10);
    user.phone = `+91${tenDigitNumber}`;

    if (templateId) {
      // If MSG91_TEMPLATE_ID is configured, dispatch with template
      const resp = await axios.post(
        'https://control.msg91.com/api/v5/otp',
        {
          template_id: templateId,
          mobile: formattedMobile,
          otp_length: 6,
          otp_expiry: 10
        },
        {
          headers: {
            authkey: msg91AuthKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (resp.data?.type === 'error') {
        console.error('[MSG91 Error]', resp.data);
        return res.status(400).json({
          success: false,
          message: resp.data?.message || 'Failed to send OTP via MSG91',
          msg: resp.data?.message || 'Failed to send OTP via MSG91'
        });
      }

      await user.save();
      return res.json({
        success: true,
        message: 'OTP sent via MSG91',
        msg: 'OTP sent via MSG91'
      });
    } else {
      // If process.env.MSG91_TEMPLATE_ID is empty:
      // Generate 6-digit numeric OTP in Node.js, store on user record with 10-minute expiry
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const phoneOtpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');
      const phoneOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

      user.phoneOtpHash = phoneOtpHash;
      user.phoneOtpExpires = phoneOtpExpires;
      user.phoneOtp = generatedOtp;
      await user.save();

      // Call POST https://control.msg91.com/api/v5/otp?mobile=${formattedMobile}&authkey=${process.env.MSG91_AUTH_KEY}&otp=${generatedOtp}
      const url = `https://control.msg91.com/api/v5/otp?mobile=${formattedMobile}&authkey=${msg91AuthKey}&otp=${generatedOtp}`;
      try {
        const resp = await axios.post(url);
        if (resp.data?.type === 'error') {
          console.error('[MSG91 Error]', resp.data);
          return res.status(400).json({
            success: false,
            message: resp.data?.message || 'Failed to send OTP via MSG91',
            msg: resp.data?.message || 'Failed to send OTP via MSG91'
          });
        }
      } catch (postErr) {
        console.error('[MSG91 Post Error]', postErr.response?.data || postErr.message);
      }

      console.log(`[MSG91 OTP DISPATCHED] Mobile: ${formattedMobile}, OTP: ${generatedOtp}`);

      return res.json({
        success: true,
        message: 'OTP sent via MSG91',
        msg: 'OTP sent via MSG91'
      });
    }
  } catch (err) {
    console.error('send-phone-otp error:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.message || 'Failed to send phone OTP',
      msg: err.response?.data?.message || 'Failed to send phone OTP'
    });
  }
});

// POST /api/profile/verify-phone-otp
router.post('/verify-phone-otp', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', msg: 'User not found' });
    }

    const submittedOtp = String(req.body.otp || req.body.code || '').trim();
    if (!submittedOtp) {
      return res.status(400).json({ success: false, message: 'OTP is required', msg: 'OTP is required' });
    }

    const rawPhone = String(req.body.phone || user.phone || '').trim();
    const formattedMobile = normalizeMsg91Mobile(rawPhone);
    const tenDigitNumber = formattedMobile.slice(-10);
    const msg91AuthKey = (process.env.MSG91_AUTH_KEY || '').trim();

    let verified = false;
    let errorMessage = '';

    // 1. Try MSG91 OTP verify API
    if (msg91AuthKey && formattedMobile) {
      try {
        const resp = await axios.get(
          `https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(submittedOtp)}&mobile=${formattedMobile}`,
          { headers: { authkey: msg91AuthKey } }
        );
        if (resp.data?.type === 'success' || resp.data?.message === 'OTP verified success') {
          verified = true;
        } else {
          errorMessage = resp.data?.message || 'Invalid or expired OTP';
        }
      } catch (apiErr) {
        console.error('[MSG91 Verify Error]', apiErr.response?.data || apiErr.message);
        errorMessage = apiErr.response?.data?.message || apiErr.message;
      }
    }

    // 2. Check stored fallback OTP if external verify didn't pass and template ID was omitted
    if (!verified && user.phoneOtpExpires && user.phoneOtpExpires > new Date()) {
      const hashed = crypto.createHash('sha256').update(submittedOtp).digest('hex');
      if (user.phoneOtpHash === hashed || user.phoneOtp === submittedOtp) {
        verified = true;
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Invalid or expired OTP',
        msg: errorMessage || 'Invalid or expired OTP'
      });
    }

    user.phone = `+91${tenDigitNumber}`;
    user.isPhoneVerified = true;
    user.phoneOtpHash = null;
    user.phoneOtpExpires = null;
    user.phoneOtp = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Phone number verified successfully!',
      msg: 'Phone number verified successfully!',
      user: {
        id: user._id,
        phone: user.phone,
        isPhoneVerified: user.isPhoneVerified
      }
    });
  } catch (err) {
    console.error('verify-phone-otp error:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.message || 'Server error',
      msg: err.response?.data?.message || 'Server error'
    });
  }
});

// POST /api/profile/verify-msg91-phone
router.post('/verify-msg91-phone', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', msg: 'User not found' });
    }

    const { phone, accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'MSG91 accessToken is required', msg: 'MSG91 accessToken is required' });
    }

    const rawPhone = String(phone || user.phone || '').trim();
    const formattedMobile = normalizeMsg91Mobile(rawPhone);
    const tenDigitNumber = formattedMobile ? formattedMobile.slice(-10) : rawPhone.replace(/\D/g, '').slice(-10);

    const msg91AuthKey = (process.env.MSG91_AUTH_KEY || '').trim();
    if (!msg91AuthKey) {
      return res.status(500).json({ success: false, message: 'MSG91_AUTH_KEY is not configured on server', msg: 'MSG91_AUTH_KEY is not configured on server' });
    }

    console.log(`[MSG91 verifyAccessToken] Validating token for mobile: ${formattedMobile || tenDigitNumber}`);

    const response = await axios.post(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      {
        authkey: msg91AuthKey,
        'access-token': accessToken
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[MSG91 verifyAccessToken response]', response.data);

    if (response.data?.type === 'success') {
      user.phone = `+91${tenDigitNumber}`;
      user.isPhoneVerified = true;
      user.phoneOtpHash = null;
      user.phoneOtpExpires = null;
      user.phoneOtp = null;
      await user.save();

      return res.json({
        success: true,
        message: response.data?.message || 'Phone number verified successfully!',
        msg: response.data?.message || 'Phone number verified successfully!',
        user: {
          id: user._id,
          phone: user.phone,
          isPhoneVerified: user.isPhoneVerified
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.message || 'Phone verification failed',
        msg: response.data?.message || 'Phone verification failed'
      });
    }
  } catch (err) {
    console.error('verify-msg91-phone error:', err.response?.data || err.message);
    const errMessage = err.response?.data?.message || err.message || 'Server error';
    return res.status(400).json({
      success: false,
      message: errMessage,
      msg: errMessage
    });
  }
});

// =========================================================================
// AADHAAR CARD KYC VERIFICATION
// =========================================================================

// POST /api/profile/aadhaar/send-otp
router.post('/aadhaar/send-otp', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', msg: 'User not found' });
    }

    const rawAadhaar = String(
      req.body.aadhaarNumber || req.body.idDocumentNumber || user.idDocumentNumber || user.idNumber || user.aadhar || ''
    ).trim();
    const cleanAadhaar = rawAadhaar.replace(/[\s\-]/g, '');

    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 12-digit Aadhaar number',
        msg: 'Please enter a valid 12-digit Aadhaar number'
      });
    }

    const apiBaseUrl = process.env.AADHAAR_API_BASE_URL?.trim();
    const apiKey = process.env.AADHAAR_API_KEY?.trim();

    if (!apiBaseUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar API key is not configured yet. Please add AADHAAR_API_KEY in server/.env.',
        msg: 'Aadhaar API key is not configured yet. Please add AADHAAR_API_KEY in server/.env.'
      });
    }

    try {
      const url = `${apiBaseUrl.replace(/\/+$/, '')}/otp`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          aadhaar_number: cleanAadhaar,
          aadhaarNumber: cleanAadhaar
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status || 400).json({
          success: false,
          message: data.message || data.msg || 'Aadhaar OTP request rejected by provider',
          msg: data.message || data.msg || 'Aadhaar OTP request rejected by provider'
        });
      }

      const refId =
        data.ref_id || data.request_id || data.refId || data.client_id || data.data?.ref_id || data.data?.client_id;
      user.aadhaarRefId = refId;
      await user.save();

      return res.json({
        success: true,
        refId,
        message: 'OTP sent to Aadhaar-linked mobile number',
        msg: 'OTP sent to Aadhaar-linked mobile number'
      });
    } catch (apiErr) {
      console.error('[Aadhaar API Error]', apiErr.message);
      return res.status(500).json({
        success: false,
        message: `Failed to contact Aadhaar API: ${apiErr.message}`,
        msg: `Failed to contact Aadhaar API: ${apiErr.message}`
      });
    }
  } catch (err) {
    console.error('aadhaar send-otp error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error', msg: 'Server error' });
  }
});

// POST /api/profile/aadhaar/verify-otp
router.post('/aadhaar/verify-otp', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', msg: 'User not found' });
    }

    const { otp, refId } = req.body;
    const rawAadhaar = String(
      req.body.aadhaarNumber || req.body.idDocumentNumber || user.idDocumentNumber || user.idNumber || user.aadhar || ''
    ).trim();
    const cleanAadhaar = rawAadhaar.replace(/[\s\-]/g, '');

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required',
        msg: 'OTP is required'
      });
    }

    const apiBaseUrl = process.env.AADHAAR_API_BASE_URL?.trim();
    const apiKey = process.env.AADHAAR_API_KEY?.trim();
    const apiSecret = process.env.AADHAAR_API_SECRET?.trim();

    if (!apiBaseUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar API key is not configured yet. Please add AADHAAR_API_KEY in server/.env.',
        msg: 'Aadhaar API key is not configured yet. Please add AADHAAR_API_KEY in server/.env.'
      });
    }

    const targetRefId = refId || user.aadhaarRefId;

    try {
      const url = `${apiBaseUrl.replace(/\/+$/, '')}/verify`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          ...(apiSecret ? { 'x-api-secret': apiSecret } : {})
        },
        body: JSON.stringify({
          ref_id: targetRefId,
          refId: targetRefId,
          otp: String(otp).trim(),
          aadhaar_number: cleanAadhaar
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status || 400).json({
          success: false,
          message: data.message || data.msg || 'Aadhaar KYC verification failed',
          msg: data.message || data.msg || 'Aadhaar KYC verification failed'
        });
      }

      const masked =
        cleanAadhaar.length === 12
          ? `XXXX-XXXX-${cleanAadhaar.slice(-4)}`
          : (data.masked_aadhaar || data.data?.masked_aadhaar || 'XXXX-XXXX-XXXX');
      const verifiedName = data.name || data.full_name || data.data?.name || data.data?.full_name || '';

      user.idDocumentNumber = masked;
      user.idNumber = masked;
      user.aadhar = masked;
      user.idProofType = 'Aadhaar Card';
      user.idType = 'Aadhaar Card';
      user.isAadhaarVerified = true;
      if (verifiedName) {
        user.aadhaarVerifiedName = verifiedName;
      }
      user.aadhaarRefId = null;
      await user.save();

      return res.json({
        success: true,
        message: 'Aadhaar KYC verified successfully!',
        msg: 'Aadhaar KYC verified successfully!',
        user: {
          id: user._id,
          idDocumentNumber: user.idDocumentNumber,
          isAadhaarVerified: user.isAadhaarVerified,
          aadhaarVerifiedName: user.aadhaarVerifiedName
        }
      });
    } catch (err) {
      console.error('[Aadhaar Verify Error]', err.message);
      return res.status(500).json({
        success: false,
        message: `Aadhaar verification service error: ${err.message}`,
        msg: `Aadhaar verification service error: ${err.message}`
      });
    }
  } catch (err) {
    console.error('aadhaar verify-otp error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error', msg: 'Server error' });
  }
});

module.exports = router;
