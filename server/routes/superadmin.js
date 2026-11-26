const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const AuditLog = require('../models/AuditLog');
const SystemConfig = require('../models/SystemConfig');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

// Protect all /api/superadmin routes strictly
router.use(auth, auth.requireSuperAdmin);

const SAFE_USER_SELECT = '-password -phoneOtpHash -phoneOtpExpires -emailOtpHash -emailOtpExpires -otp -otpExpiry';

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function buildCsv(headers, rows) {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// GET /api/superadmin/overview
router.get('/overview', async (req, res) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalRegularUsers,
      verifiedUsers,
      suspendedUsers,
      totalProperties,
      vacantProperties,
      occupiedProperties,
      totalAgreements,
      totalMaintenanceRequests,
      recentUsers,
      recentProperties,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: { $nin: ['admin', 'superadmin'] } }),
      User.countDocuments({ $or: [{ isEmailVerified: true }, { isPhoneVerified: true }] }),
      User.countDocuments({ $or: [{ isSuspended: true }, { blocked: true }] }),
      Property.countDocuments(),
      Property.countDocuments({ occupancyStatus: { $ne: 'occupied' }, tenant: null }),
      Property.countDocuments({ $or: [{ occupancyStatus: 'occupied' }, { tenant: { $ne: null } }] }),
      Agreement.countDocuments(),
      MaintenanceRequest.countDocuments(),
      User.find()
        .select(SAFE_USER_SELECT)
        .sort({ _id: -1 })
        .limit(5)
        .lean(),
      Property.find()
        .populate('owner', 'name fullName email phone')
        .populate('tenant', 'name email phone')
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean(),
    ]);

    const counts = {
      totalUsers,
      totalAdmins,
      totalRegularUsers,
      verifiedUsers,
      suspendedUsers,
      totalProperties,
      vacantProperties,
      occupiedProperties,
      totalAgreements,
      totalMaintenanceRequests,
    };

    return res.json({
      counts,
      ...counts,
      recentUsers,
      recentProperties,
    });
  } catch (err) {
    console.error('SuperAdmin overview error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to load super admin overview' });
  }
});

// GET /api/superadmin/analytics
router.get('/analytics', async (req, res) => {
  try {
    const [allUsers, allProperties] = await Promise.all([
      User.find()
        .select('role tamilRole registrationPurpose isEmailVerified isPhoneVerified isAadhaarVerified isSuspended blocked createdAt')
        .lean(),
      Property.find()
        .select('status occupancyStatus transactionType tenant createdAt')
        .lean(),
    ]);

    let tenants = 0;
    let landlords = 0;
    let admins = 0;
    let superadmins = 0;
    let emailVerified = 0;
    let phoneVerified = 0;
    let aadhaarVerified = 0;
    let unverified = 0;

    for (const u of allUsers) {
      if (u.role === 'superadmin') superadmins++;
      else if (u.role === 'admin') admins++;
      else if (
        u.role === 'landlord' ||
        u.registrationPurpose === 'Owner' ||
        u.registrationPurpose === 'Builder' ||
        u.registrationPurpose === 'Dealer' ||
        u.tamilRole === 'owners' ||
        u.tamilRole === 'brokersBuilders'
      ) {
        landlords++;
      } else {
        tenants++;
      }

      if (u.isEmailVerified) emailVerified++;
      if (u.isPhoneVerified) phoneVerified++;
      if (u.isAadhaarVerified) aadhaarVerified++;
      if (!u.isEmailVerified && !u.isPhoneVerified && !u.isAadhaarVerified) unverified++;
    }

    let vacant = 0;
    let occupied = 0;
    let rent = 0;
    let purchase = 0;
    let approved = 0;
    let pending = 0;

    for (const p of allProperties) {
      if (p.occupancyStatus === 'occupied' || p.tenant) occupied++;
      else vacant++;

      if (String(p.transactionType || '').toLowerCase() === 'rent') rent++;
      else purchase++;

      if (p.status === 'approved') approved++;
      else pending++;
    }

    // 30-day growth trends
    const now = new Date();
    const dayMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { date: key, users: 0, properties: 0 });
    }

    for (const u of allUsers) {
      const ts = u.createdAt ? new Date(u.createdAt) : u._id?.getTimestamp ? u._id.getTimestamp() : null;
      if (ts) {
        const key = new Date(ts).toISOString().slice(0, 10);
        if (dayMap.has(key)) dayMap.get(key).users++;
      }
    }

    for (const p of allProperties) {
      const ts = p.createdAt ? new Date(p.createdAt) : p._id?.getTimestamp ? p._id.getTimestamp() : null;
      if (ts) {
        const key = new Date(ts).toISOString().slice(0, 10);
        if (dayMap.has(key)) dayMap.get(key).properties++;
      }
    }

    return res.json({
      roleBreakdown: {
        tenants,
        landlords,
        admins,
        superadmins,
        total: allUsers.length,
      },
      verificationStats: {
        emailVerified,
        phoneVerified,
        aadhaarVerified,
        unverified,
      },
      propertyStats: {
        total: allProperties.length,
        vacant,
        occupied,
        rent,
        purchase,
        approved,
        pending,
      },
      growthTrends: Array.from(dayMap.values()),
    });
  } catch (err) {
    console.error('SuperAdmin analytics error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to compute platform analytics' });
  }
});

// GET /api/superadmin/users
router.get('/users', async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};

    if (role && role !== 'all') {
      filter.role = String(role).trim().toLowerCase();
    }

    if (search && String(search).trim()) {
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { username: regex },
        { phone: regex },
      ];
    }

    const users = await User.find(filter)
      .select(SAFE_USER_SELECT)
      .sort({ _id: -1 })
      .lean();

    return res.json({ users, total: users.length });
  } catch (err) {
    console.error('SuperAdmin users fetch error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to fetch users' });
  }
});

// POST /api/superadmin/admins
router.post('/admins', async (req, res) => {
  try {
    const { name, username, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: 'Name, email, and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({ msg: 'A user with this email already exists' });
    }

    const trimmedUsername = username ? String(username).trim() : undefined;
    if (trimmedUsername) {
      const existingUsername = await User.findOne({
        username: new RegExp(`^${trimmedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (existingUsername) {
        return res.status(400).json({ msg: 'A user with this username already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const adminUser = await User.create({
      name: String(name).trim(),
      username: trimmedUsername || undefined,
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? String(phone).trim() : '',
      role: 'admin',
      tamilRole: 'admin',
      isEmailVerified: true,
      isVerified: true,
      approved: true,
      blocked: false,
      isSuspended: false,
    });

    await logAudit({
      req,
      action: 'ADMIN_CREATED',
      targetType: 'admin',
      targetId: adminUser._id,
      details: { email: adminUser.email, name: adminUser.name, username: adminUser.username },
    });

    const safeUser = await User.findById(adminUser._id).select(SAFE_USER_SELECT).lean();
    return res.status(201).json({ msg: 'Admin account created successfully', user: safeUser });
  } catch (err) {
    console.error('SuperAdmin create admin error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to create admin account' });
  }
});

// PATCH /api/superadmin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const targetRole = String(role || '').trim().toLowerCase();
    if (!['admin', 'user'].includes(targetRole)) {
      return res.status(400).json({ msg: "Role must be 'admin' or 'user'" });
    }

    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ msg: 'You cannot change your own role' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ msg: 'Cannot modify another Super Admin account' });
    }

    const previousRole = targetUser.role;
    targetUser.role = targetRole;
    if (targetRole === 'admin') {
      targetUser.tamilRole = 'admin';
      targetUser.approved = true;
    } else {
      targetUser.tamilRole =
        targetUser.registrationPurpose === 'Owner'
          ? 'owners'
          : targetUser.registrationPurpose === 'Builder' || targetUser.registrationPurpose === 'Dealer'
            ? 'brokersBuilders'
            : 'customers';
    }
    await targetUser.save();

    await logAudit({
      req,
      action: targetRole === 'admin' ? 'USER_PROMOTED_TO_ADMIN' : 'ADMIN_DEMOTED_TO_USER',
      targetType: 'user',
      targetId: targetUser._id,
      details: { email: targetUser.email, previousRole, newRole: targetRole },
    });

    const safeUser = await User.findById(targetUser._id).select(SAFE_USER_SELECT).lean();
    return res.json({ msg: `User role updated to ${targetRole}`, user: safeUser });
  } catch (err) {
    console.error('SuperAdmin role update error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to update user role' });
  }
});

// PATCH /api/superadmin/users/:id/status
router.patch('/users/:id/status', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ msg: 'You cannot suspend your own account' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ msg: 'Cannot suspend a Super Admin account' });
    }

    const nextSuspended =
      typeof req.body?.isSuspended === 'boolean'
        ? req.body.isSuspended
        : !(targetUser.isSuspended || targetUser.blocked);

    targetUser.isSuspended = nextSuspended;
    targetUser.blocked = nextSuspended;
    await targetUser.save();

    await logAudit({
      req,
      action: nextSuspended ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      targetType: targetUser.role === 'admin' ? 'admin' : 'user',
      targetId: targetUser._id,
      details: { email: targetUser.email, isSuspended: nextSuspended },
    });

    const safeUser = await User.findById(targetUser._id).select(SAFE_USER_SELECT).lean();
    return res.json({
      msg: nextSuspended ? 'Account suspended' : 'Account activated',
      user: safeUser,
    });
  } catch (err) {
    console.error('SuperAdmin status update error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to update user status' });
  }
});

// POST /api/superadmin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const newPassword = String(req.body?.newPassword || req.body?.password || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'Temporary password must be at least 6 characters' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (targetUser.role === 'superadmin' && String(targetUser._id) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Cannot reset another Super Admin password' });
    }

    // User schema has no pre-save password hashing hook, so hash once here
    targetUser.password = await bcrypt.hash(newPassword, 10);
    await targetUser.save();

    await logAudit({
      req,
      action: 'USER_PASSWORD_RESET',
      targetType: targetUser.role === 'admin' ? 'admin' : 'user',
      targetId: targetUser._id,
      details: { email: targetUser.email },
    });

    return res.json({ msg: `Password updated for ${targetUser.email}` });
  } catch (err) {
    console.error('SuperAdmin password reset error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to reset user password' });
  }
});

// DELETE /api/superadmin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ msg: 'You cannot delete your own account' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (targetUser.role === 'superadmin') {
      return res.status(403).json({ msg: 'Cannot delete a Super Admin account' });
    }

    const snapshot = { email: targetUser.email, name: targetUser.name, role: targetUser.role };
    await User.deleteOne({ _id: targetUser._id });

    await logAudit({
      req,
      action: 'USER_DELETED',
      targetType: snapshot.role === 'admin' ? 'admin' : 'user',
      targetId: req.params.id,
      details: snapshot,
    });

    return res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    console.error('SuperAdmin delete user error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to delete user' });
  }
});

// GET /api/superadmin/properties
router.get('/properties', async (req, res) => {
  try {
    const properties = await Property.find()
      .populate('owner', 'name fullName email phone role')
      .populate('tenant', 'name email phone')
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return res.json({ properties, total: properties.length });
  } catch (err) {
    console.error('SuperAdmin properties error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to fetch properties' });
  }
});

// PATCH /api/superadmin/properties/:id/verify
router.patch('/properties/:id/verify', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    property.status = 'approved';
    property.isListed = true;
    property.listingStatus = 'listed';
    await property.save();

    await logAudit({
      req,
      action: 'PROPERTY_FORCE_VERIFIED',
      targetType: 'property',
      targetId: property._id,
      details: { title: property.title, location: property.location },
    });

    return res.json({ msg: 'Property force-verified and listed', property });
  } catch (err) {
    console.error('SuperAdmin verify property error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to verify property' });
  }
});

// DELETE /api/superadmin/properties/:id
router.delete('/properties/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    const snapshot = { title: property.title, location: property.location, owner: property.owner };
    await Property.deleteOne({ _id: property._id });

    // Cascade delete any linked agreements and maintenance requests
    await Promise.allSettled([
      Agreement.deleteMany({ property: property._id }),
      MaintenanceRequest.deleteMany({ property: property._id }),
    ]);

    await logAudit({
      req,
      action: 'PROPERTY_FORCE_DELETED',
      targetType: 'property',
      targetId: property._id,
      details: snapshot,
    });

    return res.json({ msg: 'Listing force-deleted successfully' });
  } catch (err) {
    console.error('SuperAdmin delete property error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to delete property' });
  }
});

// GET /api/superadmin/agreements
router.get('/agreements', async (req, res) => {
  try {
    const agreements = await Agreement.find()
      .populate('property', 'title location price transactionType')
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return res.json({ agreements, total: agreements.length });
  } catch (err) {
    console.error('SuperAdmin agreements error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to fetch agreements' });
  }
});

// GET /api/superadmin/maintenance
router.get('/maintenance', async (req, res) => {
  try {
    const requests = await MaintenanceRequest.find()
      .populate('property', 'title location')
      .populate('tenant', 'name email phone')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return res.json({ requests, total: requests.length });
  } catch (err) {
    console.error('SuperAdmin maintenance error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to fetch maintenance requests' });
  }
});

// GET /api/superadmin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { action, actorRole } = req.query;
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10) || 50));

    const filter = {};
    if (action && action !== 'all') {
      filter.action = String(action).trim();
    }
    if (actorRole && actorRole !== 'all') {
      filter.actorRole = String(actorRole).trim();
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('SuperAdmin audit-logs error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to fetch audit logs' });
  }
});

// GET /api/superadmin/system-settings
router.get('/system-settings', async (req, res) => {
  try {
    const config = await SystemConfig.getSingleton();
    return res.json(config);
  } catch (err) {
    console.error('SuperAdmin get system-settings error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to fetch system settings' });
  }
});

// PATCH /api/superadmin/system-settings
router.patch('/system-settings', async (req, res) => {
  try {
    const config = await SystemConfig.getSingleton();
    const {
      maintenanceMode,
      allowNewRegistrations,
      requirePhoneVerificationForListing,
      globalBannerMessage,
    } = req.body;

    if (typeof maintenanceMode === 'boolean') config.maintenanceMode = maintenanceMode;
    if (typeof allowNewRegistrations === 'boolean') config.allowNewRegistrations = allowNewRegistrations;
    if (typeof requirePhoneVerificationForListing === 'boolean') {
      config.requirePhoneVerificationForListing = requirePhoneVerificationForListing;
    }
    if (typeof globalBannerMessage === 'string') {
      config.globalBannerMessage = globalBannerMessage.trim();
    }
    config.updatedAt = new Date();
    await config.save();

    await logAudit({
      req,
      action: 'SYSTEM_CONFIG_UPDATED',
      targetType: 'system_config',
      targetId: config._id,
      details: {
        maintenanceMode: config.maintenanceMode,
        allowNewRegistrations: config.allowNewRegistrations,
        requirePhoneVerificationForListing: config.requirePhoneVerificationForListing,
        globalBannerMessage: config.globalBannerMessage,
      },
    });

    return res.json({ msg: 'System settings updated', settings: config });
  } catch (err) {
    console.error('SuperAdmin patch system-settings error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to update system settings' });
  }
});

// GET /api/superadmin/export/:collection
router.get('/export/:collection', async (req, res) => {
  try {
    const collection = String(req.params.collection || '').toLowerCase();
    const format = String(req.query.format || 'csv').toLowerCase();

    if (!['users', 'properties', 'agreements'].includes(collection)) {
      return res.status(400).json({ msg: 'Invalid export collection. Use users, properties, or agreements.' });
    }

    let headers = [];
    let rows = [];
    let jsonData = [];

    if (collection === 'users') {
      const data = await User.find().select(SAFE_USER_SELECT).sort({ _id: -1 }).lean();
      jsonData = data;
      headers = ['ID', 'Name', 'Username', 'Email', 'Phone', 'Role', 'Purpose', 'EmailVerified', 'PhoneVerified', 'AadhaarVerified', 'Suspended'];
      rows = data.map((u) => [
        u._id,
        u.name,
        u.username || '',
        u.email,
        u.phone || '',
        u.role,
        u.registrationPurpose || '',
        Boolean(u.isEmailVerified),
        Boolean(u.isPhoneVerified),
        Boolean(u.isAadhaarVerified),
        Boolean(u.isSuspended || u.blocked),
      ]);
    } else if (collection === 'properties') {
      const data = await Property.find()
        .populate('owner', 'name email phone')
        .populate('tenant', 'name email')
        .sort({ createdAt: -1 })
        .lean();
      jsonData = data;
      headers = ['ID', 'Title', 'Type', 'Transaction', 'Location', 'Price', 'Status', 'Occupancy', 'OwnerName', 'OwnerEmail', 'OwnerPhone', 'TenantName'];
      rows = data.map((p) => [
        p._id,
        p.title,
        p.propertyType,
        p.transactionType,
        p.location,
        p.price,
        p.status,
        p.occupancyStatus || (p.tenant ? 'occupied' : 'vacant'),
        p.owner?.name || '',
        p.owner?.email || '',
        p.owner?.phone || '',
        p.tenant?.name || '',
      ]);
    } else if (collection === 'agreements') {
      const data = await Agreement.find()
        .populate('property', 'title location')
        .populate('owner', 'name email')
        .populate('tenant', 'name email')
        .sort({ createdAt: -1 })
        .lean();
      jsonData = data;
      headers = ['ID', 'Property', 'Location', 'Owner', 'Tenant', 'MonthlyRent', 'SecurityDeposit', 'Status'];
      rows = data.map((a) => [
        a._id,
        a.property?.title || '',
        a.property?.location || '',
        a.owner?.name || a.owner?.email || '',
        a.tenant?.name || a.tenant?.email || '',
        a.monthlyRent || 0,
        a.securityDeposit || 0,
        a.status || '',
      ]);
    }

    await logAudit({
      req,
      action: 'DATA_EXPORTED',
      targetType: collection,
      details: { format, count: rows.length },
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="reside-${collection}.json"`);
      return res.send(JSON.stringify(jsonData, null, 2));
    }

    const csv = buildCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reside-${collection}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('SuperAdmin export error:', err?.message || err);
    return res.status(500).json({ msg: 'Failed to export dataset' });
  }
});

module.exports = router;
