const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function auth(req, res, next) {
  // Get token from header (x-auth-token or Authorization: Bearer <token>)
  let token = req.header('x-auth-token');

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      token = parts[1];
    } else {
      token = req.headers.authorization;
    }
  }

  // Check if not token
  if (!token) {
    return res.status(401).json({ success: false, msg: 'No token, authorization denied', message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded.user || decoded;
    if (req.user && !req.user.id && req.user._id) {
      req.user.id = req.user._id;
    }
    req.userId = req.user?.id || req.user?._id;

    // Enforce suspension/block checks on all protected routes
    const dbUser = await User.findById(req.userId).select('role isSuspended blocked');
    if (!dbUser) {
      return res.status(401).json({ success: false, msg: 'User not found', message: 'User not found' });
    }
    if (dbUser.isSuspended || dbUser.blocked) {
      return res.status(403).json({
        success: false,
        msg: 'Your account has been suspended. Please contact support.',
        message: 'Your account has been suspended. Please contact support.'
      });
    }
    req.user.role = dbUser.role;

    next();
  } catch (err) {
    res.status(401).json({ success: false, msg: 'Token is not valid', message: 'Token is not valid' });
  }
}

auth.requireAdmin = async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).select('role blocked isSuspended approved');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    if (user.isSuspended || user.blocked) {
      return res.status(403).json({ msg: 'Account is suspended or blocked' });
    }

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error(err?.message || err);
    return res.status(500).send('Server Error');
  }
};

auth.requireSuperAdmin = async function requireSuperAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).select('role blocked isSuspended');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    if (user.isSuspended || user.blocked) {
      return res.status(403).json({ msg: 'Account is suspended or blocked' });
    }

    if (user.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Super Admin access required' });
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
