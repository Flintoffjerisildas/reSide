const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Request = require('../models/Request');
const Payment = require('../models/Payment');
const RentRecord = require('../models/RentRecord');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');

router.get('/admin/overview', auth, auth.requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const currentYear = new Date(today.getFullYear(), 0, 1);
    const nextYear = new Date(today.getFullYear() + 1, 0, 1);

    const [
      totalProperties,
      totalUsers,
      activeRentals,
      pendingMaintenance,
      overduePayments,
      pendingUsers,
      pendingPropertyRequests,
      submittedPayments
    ] = await Promise.all([
      Property.countDocuments({}),
      User.countDocuments({}),
      Agreement.countDocuments({ status: 'active' }),
      MaintenanceRequest.countDocuments({ status: 'pending' }),
      RentRecord.countDocuments({ status: 'overdue' }),
      User.countDocuments({ approved: false, blocked: false, isVerified: true }),
      Request.countDocuments({ status: 'pending' }),
      Payment.countDocuments({ status: 'submitted' })
    ]);

    const revenueThisMonthAgg = await Payment.aggregate([
      {
        $match: {
          status: 'approved',
          approvedDate: { $gte: currentMonth, $lt: nextMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const revenueThisYearAgg = await Payment.aggregate([
      {
        $match: {
          status: 'approved',
          approvedDate: { $gte: currentYear, $lt: nextYear }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const revenueTotalAgg = await Payment.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingRentAgg = await RentRecord.aggregate([
      {
        $match: {
          balance: { $gt: 0 },
          status: { $in: ['pending', 'overdue', 'partially_paid'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }
    ]);

    const revenueThisMonth = revenueThisMonthAgg?.[0]?.total || 0;
    const revenueThisYear = revenueThisYearAgg?.[0]?.total || 0;
    const revenueTotal = revenueTotalAgg?.[0]?.total || 0;
    const pendingRentAmount = pendingRentAgg?.[0]?.total || 0;
    const pendingRentCount = pendingRentAgg?.[0]?.count || 0;

    const alerts = [];
    if (pendingUsers > 0) alerts.push({ key: 'pendingUsers', severity: 'high', count: pendingUsers });
    if (pendingMaintenance > 0) alerts.push({ key: 'pendingMaintenance', severity: 'medium', count: pendingMaintenance });
    if (overduePayments > 0) alerts.push({ key: 'overduePayments', severity: 'high', count: overduePayments });
    if (submittedPayments > 0) alerts.push({ key: 'submittedPayments', severity: 'medium', count: submittedPayments });
    if (pendingPropertyRequests > 0) alerts.push({ key: 'pendingPropertyRequests', severity: 'low', count: pendingPropertyRequests });

    res.json({
      totals: {
        properties: totalProperties,
        users: totalUsers,
        activeRentals,
        revenueThisMonth,
        revenueThisYear,
        revenueTotal,
        pendingRentAmount,
        pendingRentCount,
        pendingMaintenance
      },
      pending: {
        users: pendingUsers,
        propertyRequests: pendingPropertyRequests,
        payments: submittedPayments,
        overduePayments
      },
      alerts,
      currentMonth,
      currentYear
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/analytics', auth, auth.requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    start.setHours(0, 0, 0, 0);

    const revenueRows = await Payment.aggregate([
      { $match: { status: 'approved', approvedDate: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$approvedDate' } },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const occupancyRows = await Property.aggregate([
      {
        $group: {
          _id: '$occupancyStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const occupancy = occupancyRows.reduce((acc, row) => {
      acc[row._id || 'unknown'] = row.count;
      return acc;
    }, {});

    const revenueByMonth = revenueRows.map((r) => ({
      month: r._id,
      revenue: r.revenue
    }));

    res.json({
      revenueByMonth,
      occupancy
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/revenue-report', auth, auth.requireAdmin, async (req, res) => {
  try {
    const monthsRaw = req.query?.months;
    const monthsParsed = Number(monthsRaw);
    const months = Number.isFinite(monthsParsed) ? Math.max(1, Math.min(60, Math.floor(monthsParsed))) : 12;

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = new Date(currentMonthStart);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const currentYear = new Date(today.getFullYear(), 0, 1);
    const nextYear = new Date(today.getFullYear() + 1, 0, 1);

    const [byMonthAgg, byYearAgg, revenueTotalAgg, revenueThisMonthAgg, revenueThisYearAgg, pendingRentAgg] =
      await Promise.all([
        Payment.aggregate([
          { $match: { status: 'approved', approvedDate: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$approvedDate' } },
              revenue: { $sum: '$amount' },
              transactions: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Payment.aggregate([
          { $match: { status: 'approved', approvedDate: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y', date: '$approvedDate' } },
              revenue: { $sum: '$amount' },
              transactions: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        Payment.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Payment.aggregate([
          {
            $match: {
              status: 'approved',
              approvedDate: { $gte: currentMonthStart, $lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) }
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Payment.aggregate([
          {
            $match: {
              status: 'approved',
              approvedDate: { $gte: currentYear, $lt: nextYear }
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        RentRecord.aggregate([
          {
            $match: {
              balance: { $gt: 0 },
              status: { $in: ['pending', 'overdue', 'partially_paid'] }
            }
          },
          { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }
        ])
      ]);

    const revenueTotal = revenueTotalAgg?.[0]?.total || 0;
    const revenueThisMonth = revenueThisMonthAgg?.[0]?.total || 0;
    const revenueThisYear = revenueThisYearAgg?.[0]?.total || 0;
    const pendingRentAmount = pendingRentAgg?.[0]?.total || 0;
    const pendingRentCount = pendingRentAgg?.[0]?.count || 0;

    const mapMonth = new Map(
      (Array.isArray(byMonthAgg) ? byMonthAgg : []).map((r) => [
        String(r._id),
        { month: String(r._id), revenue: Number(r.revenue || 0), transactions: Number(r.transactions || 0) }
      ])
    );

    const monthsOut = [];
    const iter = new Date(start);
    while (iter <= currentMonthStart) {
      const key = `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, '0')}`;
      monthsOut.push(mapMonth.get(key) || { month: key, revenue: 0, transactions: 0 });
      iter.setMonth(iter.getMonth() + 1);
    }

    const yearsOut = (Array.isArray(byYearAgg) ? byYearAgg : []).map((r) => ({
      year: String(r._id),
      revenue: Number(r.revenue || 0),
      transactions: Number(r.transactions || 0)
    }));

    res.json({
      summary: {
        totalRentCollected: revenueTotal,
        pendingPaymentsAmount: pendingRentAmount,
        pendingPaymentsCount: pendingRentCount,
        monthlyRevenue: revenueThisMonth,
        yearlyRevenue: revenueThisYear
      },
      byMonth: monthsOut,
      byYear: yearsOut,
      range: { months, start, end: currentMonthStart }
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/payment-status-report', auth, auth.requireAdmin, async (req, res) => {
  try {
    const monthsRaw = req.query?.months;
    const monthsParsed = Number(monthsRaw);
    const months = Number.isFinite(monthsParsed) ? Math.max(1, Math.min(60, Math.floor(monthsParsed))) : 1;

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const start = new Date(currentMonthStart);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const records = await RentRecord.find({ month: { $gte: start, $lt: nextMonthStart } })
      .populate('tenant', 'name email')
      .populate('property', 'title location')
      .sort({ dueDate: 1 });

    const rows = records.map((r) => ({
      id: String(r._id),
      tenantName: r?.tenant?.name || '',
      tenantEmail: r?.tenant?.email || '',
      propertyTitle: r?.property?.title || '',
      propertyLocation: r?.property?.location || '',
      dueDate: r?.dueDate,
      month: r?.month,
      rentAmount: Number(r?.rentAmount || 0),
      totalPaid: Number(r?.totalPaid || 0),
      balance: Number(r?.balance || 0),
      status: r?.status || 'pending'
    }));

    const paidRows = rows.filter((r) => r.status === 'paid' || r.balance <= 0);
    const overdueRows = rows.filter((r) => r.status === 'overdue');
    const unpaidRows = rows.filter((r) => !paidRows.includes(r) && r.balance > 0 && r.status !== 'overdue');

    const expectedRent = rows.reduce((acc, r) => acc + Number(r.rentAmount || 0), 0);
    const collected = rows.reduce((acc, r) => acc + Number(r.totalPaid || 0), 0);
    const outstanding = rows.reduce((acc, r) => acc + Number(r.balance || 0), 0);
    const overdueOutstanding = overdueRows.reduce((acc, r) => acc + Number(r.balance || 0), 0);

    res.json({
      summary: {
        months,
        expectedRent,
        collected,
        outstanding,
        overdueOutstanding,
        paidTenants: paidRows.length,
        unpaidTenants: unpaidRows.length,
        overduePayments: overdueRows.length
      },
      rows,
      range: { start, end: nextMonthStart }
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/property-performance-report', auth, auth.requireAdmin, async (req, res) => {
  try {
    const monthsRaw = req.query?.months;
    const monthsParsed = Number(monthsRaw);
    const months = Number.isFinite(monthsParsed) ? Math.max(1, Math.min(60, Math.floor(monthsParsed))) : 12;

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = new Date(currentMonthStart);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const [rentAgg, maintenanceAgg] = await Promise.all([
      RentRecord.aggregate([
        { $match: { month: { $gte: start } } },
        {
          $group: {
            _id: '$property',
            expected: { $sum: '$rentAmount' },
            collected: { $sum: '$totalPaid' },
            outstanding: { $sum: '$balance' },
            records: { $sum: 1 }
          }
        }
      ]),
      MaintenanceRequest.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: '$property', count: { $sum: 1 } } }
      ])
    ]);

    const maintenanceByProperty = new Map(
      (Array.isArray(maintenanceAgg) ? maintenanceAgg : []).map((r) => [String(r._id), Number(r.count || 0)])
    );

    const propertyIds = (Array.isArray(rentAgg) ? rentAgg : []).map((r) => r._id).filter(Boolean);
    const properties = await Property.find({ _id: { $in: propertyIds } }).select('title location occupancyStatus');
    const propertyById = new Map(properties.map((p) => [String(p._id), p]));

    const rows = (Array.isArray(rentAgg) ? rentAgg : []).map((r) => {
      const p = propertyById.get(String(r._id));
      return {
        propertyId: String(r._id),
        propertyTitle: p?.title || '',
        propertyLocation: p?.location || '',
        occupancyStatus: p?.occupancyStatus || 'vacant',
        incomeGenerated: Number(r.collected || 0),
        expectedIncome: Number(r.expected || 0),
        outstanding: Number(r.outstanding || 0),
        maintenanceCount: Number(maintenanceByProperty.get(String(r._id)) || 0),
        rentRecords: Number(r.records || 0)
      };
    });

    const bestProperty = rows.slice().sort((a, b) => b.incomeGenerated - a.incomeGenerated)[0] || null;
    const problemProperty =
      rows
        .slice()
        .sort((a, b) => (b.maintenanceCount - a.maintenanceCount) || (b.outstanding - a.outstanding))[0] || null;

    res.json({
      summary: { months, properties: rows.length },
      bestProperty,
      problemProperty,
      rows
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/occupancy-report', auth, auth.requireAdmin, async (req, res) => {
  try {
    const [total, occupied, vacant, maintenance] = await Promise.all([
      Property.countDocuments({}),
      Property.countDocuments({ occupancyStatus: 'occupied' }),
      Property.countDocuments({ occupancyStatus: 'vacant' }),
      Property.countDocuments({ occupancyStatus: 'maintenance' })
    ]);

    const occupancyPercent = total > 0 ? (occupied / total) * 100 : 0;

    res.json({
      totalProperties: total,
      occupied,
      vacant,
      maintenance,
      occupancyPercent
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/maintenance-report', auth, auth.requireAdmin, async (req, res) => {
  try {
    const monthsRaw = req.query?.months;
    const monthsParsed = Number(monthsRaw);
    const months = Number.isFinite(monthsParsed) ? Math.max(1, Math.min(60, Math.floor(monthsParsed))) : 12;

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = new Date(currentMonthStart);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const [total, pending, inProgress, completed, byCategoryAgg] = await Promise.all([
      MaintenanceRequest.countDocuments({ createdAt: { $gte: start } }),
      MaintenanceRequest.countDocuments({ status: 'pending', createdAt: { $gte: start } }),
      MaintenanceRequest.countDocuments({ status: 'in-progress', createdAt: { $gte: start } }),
      MaintenanceRequest.countDocuments({ status: 'completed', createdAt: { $gte: start } }),
      MaintenanceRequest.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const byCategory = (Array.isArray(byCategoryAgg) ? byCategoryAgg : []).map((r) => ({
      category: r._id || 'Other',
      count: Number(r.count || 0)
    }));

    const recent = await MaintenanceRequest.find({ createdAt: { $gte: start } })
      .populate('tenant', 'name email')
      .populate('property', 'title location')
      .sort({ createdAt: -1 })
      .limit(50);

    const rows = recent.map((m) => ({
      id: String(m._id),
      createdAt: m?.createdAt,
      status: m?.status || 'pending',
      category: m?.category || 'Other',
      priority: m?.priority || 'Low',
      issue: m?.issue || '',
      tenantName: m?.tenant?.name || '',
      tenantEmail: m?.tenant?.email || '',
      propertyTitle: m?.property?.title || '',
      propertyLocation: m?.property?.location || ''
    }));

    res.json({
      summary: { months, totalComplaints: total, pending, inProgress, completed },
      byCategory,
      rows
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/notifications', auth, auth.requireAdmin, async (req, res) => {
  try {
    const [
      pendingUsers,
      pendingMaintenance,
      overduePayments,
      submittedPayments,
      pendingPropertyRequests
    ] = await Promise.all([
      User.countDocuments({ approved: false, blocked: false, isVerified: true }),
      MaintenanceRequest.countDocuments({ status: 'pending' }),
      RentRecord.countDocuments({ status: 'overdue' }),
      Payment.countDocuments({ status: 'submitted' }),
      Request.countDocuments({ status: 'pending' })
    ]);

    const items = [];
    if (pendingUsers > 0) items.push({ key: 'pendingUsers', severity: 'high', count: pendingUsers });
    if (overduePayments > 0) items.push({ key: 'overduePayments', severity: 'high', count: overduePayments });
    if (submittedPayments > 0) items.push({ key: 'submittedPayments', severity: 'medium', count: submittedPayments });
    if (pendingMaintenance > 0) items.push({ key: 'pendingMaintenance', severity: 'medium', count: pendingMaintenance });
    if (pendingPropertyRequests > 0) items.push({ key: 'pendingPropertyRequests', severity: 'low', count: pendingPropertyRequests });

    res.json({ items });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.post('/admin/create-user', auth, auth.requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const tamilRoleRaw = req.body?.tamilRole;
    const tamilRole = String(tamilRoleRaw || 'customers').trim();

    if (!name || !email) {
      return res.status(400).json({ msg: 'Name and email are required' });
    }

    if (!['owners', 'brokersBuilders', 'customers', 'admin'].includes(tamilRole)) {
      return res.status(400).json({ msg: 'Invalid tamilRole' });
    }

    const existing = await User.findOne({ email }).select('_id isVerified');
    if (existing) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const tempPassword =
      String(req.body?.password || '').trim() ||
      crypto
        .randomBytes(12)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 10);

    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      tamilRole,
      role: tamilRole === 'admin' ? 'admin' : 'user',
      approved: true,
      blocked: false,
      isVerified: true,
      phone: phone || undefined,
      otp: undefined,
      otpExpiry: undefined,
      otpPurpose: undefined,
      otpAttempts: 0
    });

    return res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        tamilRole: user.tamilRole,
        role: user.role,
        approved: user.approved,
        blocked: user.blocked,
        isVerified: user.isVerified,
        phone: user.phone
      },
      tempPassword
    });
  } catch (err) {
    console.error(err?.message || err);
    return res.status(500).send('Server Error');
  }
});

// Get all users (Admin only - simplified for now)
router.get('/', auth, auth.requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password -otp -otpExpiry -otpPurpose -otpAttempts');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Approve user
router.put('/:id/approve', auth, auth.requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.approved = true;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/:id/block', auth, auth.requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const blockedRaw = req.body?.blocked;
    const blocked =
      typeof blockedRaw === 'boolean' ? blockedRaw : blockedRaw === 'true' || blockedRaw === 'on';

    user.blocked = blocked;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/:id/unblock', auth, auth.requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.blocked = false;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/:id/role', auth, auth.requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const internalRole = req.body?.internalRole ?? req.body?.role;
    const tamilRole = req.body?.tamilRole;

    if (internalRole !== undefined) {
      const normalizedInternalRole = String(internalRole).trim();
      if (!['admin', 'user'].includes(normalizedInternalRole)) {
        return res.status(400).json({ msg: 'Invalid internalRole' });
      }
      user.role = normalizedInternalRole;
    }

    if (tamilRole !== undefined) {
      const normalizedTamilRole = String(tamilRole).trim();
      if (!['owners', 'brokersBuilders', 'customers', 'admin'].includes(normalizedTamilRole)) {
        return res.status(400).json({ msg: 'Invalid tamilRole' });
      }
      user.tamilRole = normalizedTamilRole;
    }

    await user.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/:id/tamilRole', auth, auth.requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const tamilRole = String(req.body?.tamilRole || '').trim();
    if (!['owners', 'brokersBuilders', 'customers', 'admin'].includes(tamilRole)) {
      return res.status(400).json({ msg: 'Invalid tamilRole' });
    }

    user.tamilRole = tamilRole;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/admin/announcement', auth, auth.requireAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!title || !message) {
      return res.status(400).json({ msg: 'title and message are required' });
    }

    const doc = {
      title,
      message,
      createdAt: new Date(),
      createdBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : null
    };

    await mongoose.connection.collection('announcements').insertOne(doc);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err?.message || err);
    return res.status(500).send('Server Error');
  }
});

// Update Profile
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      aadhar,
      gender,
      age,
      dateOfBirth,
      familyMembers,
      religion,
      occupation,
      companyName,
      monthlyIncome,
      maritalStatus,
      idType,
      idNumber,
      idProofImage,
      notificationsEnabled
    } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (aadhar) user.aadhar = aadhar;
    if (gender) user.gender = gender;
    // Optional tenant/owner profile fields
    if (age !== undefined) user.age = age;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (familyMembers !== undefined) user.familyMembers = familyMembers;
    if (religion) user.religion = religion;
    if (occupation) user.occupation = occupation;
    if (companyName) user.companyName = companyName;
    if (monthlyIncome !== undefined) user.monthlyIncome = monthlyIncome;
    if (maritalStatus) user.maritalStatus = maritalStatus;
    if (idType) user.idType = idType;
    if (idNumber) user.idNumber = idNumber;
    if (idProofImage) user.idProofImage = idProofImage;
    if (notificationsEnabled !== undefined) {
      if (typeof notificationsEnabled === 'boolean') {
        user.notificationsEnabled = notificationsEnabled;
      } else if (typeof notificationsEnabled === 'string') {
        user.notificationsEnabled = notificationsEnabled === 'true' || notificationsEnabled === 'on';
      }
    }

    const completionFields = [
      user.name,
      user.phone,
      user.address,
      user.dateOfBirth,
      user.gender,
      user.occupation,
      user.companyName,
      user.monthlyIncome,
      user.familyMembers,
      user.maritalStatus,
      user.aadhar || user.idNumber,
      user.idType,
      user.religion,
      user.age
    ];
    const totalFields = completionFields.length;
    const filledFields = completionFields.filter((value) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string') return value.trim() !== '';
      return true;
    }).length;
    const completionPercent = Math.round((filledFields / totalFields) * 100);
    user.profileCompletion = completionPercent;

    await user.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
