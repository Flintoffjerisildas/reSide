const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  register,
  verifyRegistrationOtp,
  login,
  forgotPassword,
  resetPasswordWithOtp,
  resendOtp
} = require('../controllers/authController');

// Register with email OTP
router.post('/register', register);

// Verify registration OTP
router.post('/verify-register-otp', verifyRegistrationOtp);

// Login with verified account
router.post('/login', login);

// Get Current User
router.get('/me', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    const decoded = jwt.verify(token, 'secret');
    const user = await User.findById(decoded.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
});

// Change Password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Current and new password are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Forgot Password - request OTP
router.post('/forgot-password', forgotPassword);

// Forgot Password - verify OTP and reset
router.post('/reset-password-otp', resetPasswordWithOtp);

// Resend OTP (register or forgot)
router.post('/resend-otp', resendOtp);

module.exports = router;
