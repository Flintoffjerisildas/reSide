const jwt = require('jsonwebtoken');
const User = require('../models/User');

function auth(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
}

auth.requireAdmin = async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).select('role blocked approved');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    if (user.blocked) {
      return res.status(403).json({ msg: 'Account is blocked' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error(err?.message || err);
    return res.status(500).send('Server Error');
  }
};

auth.requireOwner = async function requireOwner(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).select('role tamilRole blocked approved name');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    if (user.blocked) {
      return res.status(403).json({ msg: 'Account is blocked' });
    }

    next();
  } catch (err) {
    console.error(err?.message || err);
    return res.status(500).send('Server Error');
  }
};

module.exports = auth;
