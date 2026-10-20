const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const axios = require('axios');
const Property = require('../models/Property');
const RentRecord = require('../models/RentRecord');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Payment = require('../models/Payment');
const User = require('../models/User');

const aiCache = new Map();

function normalizeStartOfDay(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeEndOfDay(value, original) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  const raw = String(original || '').trim();
  if (raw.length <= 10) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function parseDateRange(query, { defaultDays = 30 } = {}) {
  const now = new Date();
  const fromRaw = query?.from;
  const toRaw = query?.to;

  const defaultFrom = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - defaultDays);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const normalizedTo = toRaw ? normalizeEndOfDay(toRaw, toRaw) : undefined;
  const to = normalizedTo || now;

  const normalizedFrom = fromRaw ? normalizeStartOfDay(fromRaw) : undefined;
  const from = normalizedFrom || defaultFrom;

  return { from, to };
}

async function getOwnerName(ownerId) {
  const owner = await User.findById(ownerId).select('name').lean();
  return String(owner?.name || '');
}

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isTruthyQueryFlag(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

function monthKeyFromIso(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function generateAiInsights({ report, locale, data }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { requested: true, generated: false, reason: 'OPENAI_API_KEY is not configured' };
  }

  const model = process.env.OPENAI_REPORT_MODEL || 'gpt-4o-mini';

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You generate concise insights for property management reports.\n\nReturn ONLY valid JSON with keys:\n- executiveSummary: string\n- insights: string[] (3-6 items)\n- recommendations: string[] (0-5 items)\n- risks: string[] (0-5 items)\n\nRules:\n- Use only the provided numeric/aggregated data.\n- Do NOT include names, emails, phone numbers, IDs, or exact addresses.\n- Keep each bullet under 140 characters.\n- If data is insufficient, say so briefly in executiveSummary and keep insights minimal.\n- Write in English unless locale is "ta", then write in Tamil.',
          },
          { role: 'user', content: JSON.stringify({ report, locale, data }) },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }

    const executiveSummary = typeof parsed?.executiveSummary === 'string' ? parsed.executiveSummary : '';
    const insights = Array.isArray(parsed?.insights) ? parsed.insights.filter((x) => typeof x === 'string') : [];
    const recommendations = Array.isArray(parsed?.recommendations)
      ? parsed.recommendations.filter((x) => typeof x === 'string')
      : [];
    const risks = Array.isArray(parsed?.risks) ? parsed.risks.filter((x) => typeof x === 'string') : [];

    return {
      requested: true,
      generated: Boolean(executiveSummary || insights.length || recommendations.length || risks.length),
      model,
      generatedAt: new Date().toISOString(),
      executiveSummary,
      insights,
      recommendations,
      risks,
    };
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data;
    console.error('report ai error:', status || err?.message || err, details || '');
    return { requested: true, generated: false, reason: 'AI generation failed' };
  }
}

async function getAiInsightsCached({ cacheKey, report, locale, data }) {
  const now = Date.now();
  const cached = aiCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await generateAiInsights({ report, locale, data });
  aiCache.set(cacheKey, { value, expiresAt: now + 5 * 60 * 1000 });
  return value;
}

router.get('/rent', auth, auth.requireOwner, async (req, res) => {
  try {
    const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
    const { from, to } = parseDateRange(req.query, { defaultDays: 30 });
    const aiRequested = isTruthyQueryFlag(req.query?.ai);
    const locale = req.query?.locale ? String(req.query.locale) : 'en';

    const propertyFilter = { owner: req.user.id };
    if (propertyId) propertyFilter._id = propertyId;

    const totalProperties = await Property.countDocuments(propertyFilter);

    const recordFilter = { owner: req.user.id };
    if (propertyId) recordFilter.property = propertyId;
    if (from || to) {
      const fromMonth = from ? new Date(from.getFullYear(), from.getMonth(), 1) : undefined;
      const toMonth = to ? new Date(to.getFullYear(), to.getMonth(), 1) : undefined;
      recordFilter.month = {};
      if (fromMonth) recordFilter.month.$gte = fromMonth;
      if (toMonth) recordFilter.month.$lte = toMonth;
    }

    const recordsRaw = await RentRecord.find(recordFilter)
      .populate('property', 'title location')
      .populate('tenant', 'name email')
      .sort({ dueDate: -1 })
      .lean();

    const records = recordsRaw.filter((r) => {
      const property = r?.property;
      if (!property) return false;
      if (typeof property === 'string') return false;
      return Boolean(property?._id);
    });

    const summary = {
      totalProperties,
      totalRentExpected: 0,
      totalRentCollected: 0,
      pendingAmount: 0
    };

    const rows = records.map((r) => {
      const rentAmount = Number(r?.rentAmount || 0);
      const paid = Number(r?.totalPaid || 0);
      const pending = Number(r?.balance || 0);
      summary.totalRentExpected += rentAmount;
      summary.totalRentCollected += paid;
      summary.pendingAmount += pending;

      return {
        rentRecordId: String(r?._id || ''),
        propertyId: String(r?.property?._id || r?.property || ''),
        propertyTitle: String(r?.property?.title || ''),
        tenantName: String(r?.tenant?.name || ''),
        tenantEmail: String(r?.tenant?.email || ''),
        month: toIsoOrNull(r?.month),
        dueDate: toIsoOrNull(r?.dueDate),
        rent: rentAmount,
        paid,
        pending,
        status: String(r?.status || '')
      };
    });

    const ownerName = await getOwnerName(req.user.id);

    let ai = { requested: aiRequested, generated: false };
    if (aiRequested) {
      const totalRecords = rows.length;
      const pendingCount = rows.filter((r) => Number(r?.pending ?? 0) > 0).length;
      const overdueCount = rows.filter((r) => String(r?.status || '') === 'overdue').length;
      const expected = Number(summary?.totalRentExpected ?? 0);
      const collected = Number(summary?.totalRentCollected ?? 0);
      const efficiencyPct = expected > 0 ? Number(((collected / expected) * 100).toFixed(2)) : 0;

      const monthly = new Map();
      rows.forEach((r) => {
        const key = monthKeyFromIso(r?.dueDate || r?.month);
        if (!key) return;
        const current = monthly.get(key) || { month: key, expected: 0, collected: 0, pending: 0 };
        current.expected += Number(r?.rent ?? 0);
        current.collected += Number(r?.paid ?? 0);
        current.pending += Number(r?.pending ?? 0);
        monthly.set(key, current);
      });

      const monthlySeries = Array.from(monthly.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)));

      const cacheKey = `rent|${req.user.id}|${propertyId || ''}|${from?.toISOString() || ''}|${to?.toISOString() || ''}|${expected}|${collected}|${pendingCount}|${overdueCount}|${totalRecords}`;
      ai = await getAiInsightsCached({
        cacheKey,
        report: 'rent',
        locale,
        data: {
          filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
          summary,
          derived: { efficiencyPct, pendingCount, overdueCount, totalRecords },
          monthlySeries,
        },
      });
    }

    res.json({
      report: 'rent',
      generatedAt: new Date().toISOString(),
      owner: { id: req.user.id, name: ownerName },
      filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
      summary,
      rows,
      ai
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/occupancy', auth, auth.requireOwner, async (req, res) => {
  try {
    const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
    const { from, to } = parseDateRange(req.query, { defaultDays: 30 });
    const aiRequested = isTruthyQueryFlag(req.query?.ai);
    const locale = req.query?.locale ? String(req.query.locale) : 'en';

    const filter = { owner: req.user.id };
    if (propertyId) filter._id = propertyId;

    const properties = await Property.find(filter)
      .populate('tenant', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const totalProperties = properties.length;
    const occupied = properties.filter((p) => Boolean(p?.tenant) || String(p?.occupancyStatus || '') === 'occupied').length;
    const vacant = Math.max(0, totalProperties - occupied);
    const occupancyRate = totalProperties > 0 ? Number(((occupied / totalProperties) * 100).toFixed(2)) : 0;

    const rows = properties.map((p) => {
      const tenantName = typeof p?.tenant === 'object' ? String(p?.tenant?.name || '') : '';
      const status = String(p?.occupancyStatus || (p?.tenant ? 'occupied' : 'vacant'));
      return {
        propertyId: String(p?._id || ''),
        propertyTitle: String(p?.title || ''),
        location: String(p?.location || ''),
        status,
        tenantName
      };
    });

    const ownerName = await getOwnerName(req.user.id);

    let ai = { requested: aiRequested, generated: false };
    if (aiRequested) {
      const cacheKey = `occupancy|${req.user.id}|${propertyId || ''}|${from?.toISOString() || ''}|${to?.toISOString() || ''}|${totalProperties}|${occupied}|${vacant}|${occupancyRate}`;
      ai = await getAiInsightsCached({
        cacheKey,
        report: 'occupancy',
        locale,
        data: {
          filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
          summary: { totalProperties, occupied, vacant, occupancyRate },
        },
      });
    }

    res.json({
      report: 'occupancy',
      generatedAt: new Date().toISOString(),
      owner: { id: req.user.id, name: ownerName },
      filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
      summary: { totalProperties, occupied, vacant, occupancyRate },
      rows,
      ai
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/maintenance', auth, auth.requireOwner, async (req, res) => {
  try {
    const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
    const { from, to } = parseDateRange(req.query, { defaultDays: 30 });
    const aiRequested = isTruthyQueryFlag(req.query?.ai);
    const locale = req.query?.locale ? String(req.query.locale) : 'en';

    const filter = { owner: req.user.id };
    if (propertyId) filter.property = propertyId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const requests = await MaintenanceRequest.find(filter)
      .populate('property', 'title location')
      .sort({ createdAt: -1 })
      .lean();

    const summary = {
      totalRequests: requests.length,
      completed: requests.filter((r) => r?.status === 'completed').length,
      pending: requests.filter((r) => r?.status === 'pending' || r?.status === 'in-progress').length
    };

    const rows = requests.map((r) => ({
      requestId: String(r?._id || ''),
      propertyId: String(r?.property?._id || r?.property || ''),
      propertyTitle: String(r?.property?.title || ''),
      issue: String(r?.issue || ''),
      category: String(r?.category || ''),
      createdAt: toIsoOrNull(r?.createdAt),
      status: String(r?.status || ''),
      cost: Number(r?.cost || 0)
    }));

    const ownerName = await getOwnerName(req.user.id);

    let ai = { requested: aiRequested, generated: false };
    if (aiRequested) {
      const byType = new Map();
      rows.forEach((r) => {
        const key = String(r?.category || r?.issue || '').trim();
        if (!key) return;
        byType.set(key, (byType.get(key) || 0) + 1);
      });

      const topTypes = Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([type, count]) => ({ type, count }));

      const cacheKey = `maintenance|${req.user.id}|${propertyId || ''}|${from?.toISOString() || ''}|${to?.toISOString() || ''}|${summary.totalRequests}|${summary.completed}|${summary.pending}|${rows.length}`;
      ai = await getAiInsightsCached({
        cacheKey,
        report: 'maintenance',
        locale,
        data: {
          filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
          summary,
          topTypes,
        },
      });
    }

    res.json({
      report: 'maintenance',
      generatedAt: new Date().toISOString(),
      owner: { id: req.user.id, name: ownerName },
      filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
      summary,
      rows,
      ai
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/tenant/payment-history', auth, async (req, res) => {
  try {
    const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
    const { from, to } = parseDateRange(req.query, { defaultDays: 180 });
    const aiRequested = isTruthyQueryFlag(req.query?.ai);
    const locale = req.query?.locale ? String(req.query.locale) : 'en';

    const paymentFilter = { tenant: req.user.id };
    if (from || to) {
      paymentFilter.date = {};
      if (from) paymentFilter.date.$gte = from;
      if (to) paymentFilter.date.$lte = to;
    }

    const paymentsRaw = await Payment.find(paymentFilter)
      .populate({
        path: 'rentRecord',
        populate: { path: 'property', select: 'title location' },
      })
      .sort({ date: -1 })
      .lean();

    const payments = propertyId
      ? paymentsRaw.filter((p) => String(p?.rentRecord?.property?._id || '') === String(propertyId))
      : paymentsRaw;

    const rows = payments.map((p) => ({
      paymentId: String(p?._id || ''),
      propertyId: String(p?.rentRecord?.property?._id || ''),
      propertyTitle: String(p?.rentRecord?.property?.title || ''),
      month: toIsoOrNull(p?.rentRecord?.month),
      dueDate: toIsoOrNull(p?.rentRecord?.dueDate),
      amount: Number(p?.amount || 0),
      mode: String(p?.mode || ''),
      status: String(p?.status || ''),
      paymentDate: toIsoOrNull(p?.date),
      approvedDate: toIsoOrNull(p?.approvedDate),
      receiptNumber: String(p?.receiptNumber || ''),
    }));

    const totalApproved = rows.reduce((acc, r) => (r.status === 'approved' ? acc + Number(r.amount || 0) : acc), 0);
    const totalSubmitted = rows.reduce((acc, r) => (r.status === 'submitted' ? acc + Number(r.amount || 0) : acc), 0);
    const totalRejected = rows.reduce((acc, r) => (r.status === 'rejected' ? acc + Number(r.amount || 0) : acc), 0);
    const failedPayments = rows.filter((r) => r.status === 'rejected').length;

    const rentRecordFilter = { tenant: req.user.id };
    if (propertyId) rentRecordFilter.property = propertyId;
    if (from || to) {
      rentRecordFilter.month = {};
      if (from) rentRecordFilter.month.$gte = new Date(from.getFullYear(), from.getMonth(), 1);
      if (to) rentRecordFilter.month.$lte = new Date(to.getFullYear(), to.getMonth(), 1);
    }

    const rentRecords = await RentRecord.find(rentRecordFilter).select('balance status').lean();
    const pendingDueAmount = rentRecords.reduce((acc, r) => acc + Math.max(0, Number(r?.balance || 0)), 0);
    const pendingDueCount = rentRecords.filter((r) => Number(r?.balance || 0) > 0).length;

    const byMonth = new Map();
    rows.forEach((r) => {
      const key = monthKeyFromIso(r?.month || r?.paymentDate);
      if (!key) return;
      const current = byMonth.get(key) || { key, name: key, amount: 0 };
      if (r.status === 'approved') current.amount += Number(r.amount || 0);
      byMonth.set(key, current);
    });
    const monthlyPaid = Array.from(byMonth.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));

    const byMode = new Map();
    rows.forEach((r) => {
      const key = String(r?.mode || '').trim();
      if (!key) return;
      if (r.status !== 'approved') return;
      byMode.set(key, (byMode.get(key) || 0) + Number(r.amount || 0));
    });
    const paymentMethodBreakdown = Array.from(byMode.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const summary = {
      totalPayments: rows.length,
      totalApproved,
      totalSubmitted,
      totalRejected,
      failedPayments,
      pendingDueAmount,
      pendingDueCount,
    };

    const tenantName = await User.findById(req.user.id).select('name').lean();
    let ai = { requested: aiRequested, generated: false };
    if (aiRequested) {
      const cacheKey = `tenant-payment-history|${req.user.id}|${propertyId || ''}|${from?.toISOString() || ''}|${to?.toISOString() || ''}|${rows.length}|${totalApproved}|${failedPayments}|${pendingDueAmount}`;
      ai = await getAiInsightsCached({
        cacheKey,
        report: 'tenant-payment-history',
        locale,
        data: {
          filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
          summary,
          monthlyPaid,
          paymentMethodBreakdown: paymentMethodBreakdown.slice(0, 6),
        },
      });
    }

    res.json({
      report: 'tenant-payment-history',
      generatedAt: new Date().toISOString(),
      tenant: { id: req.user.id, name: String(tenantName?.name || '') },
      filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
      summary,
      monthlyPaid,
      paymentMethodBreakdown,
      rows,
      ai,
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/tenant/expense-summary', auth, async (req, res) => {
  try {
    const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
    const { from, to } = parseDateRange(req.query, { defaultDays: 180 });
    const aiRequested = isTruthyQueryFlag(req.query?.ai);
    const locale = req.query?.locale ? String(req.query.locale) : 'en';

    const paymentFilter = { tenant: req.user.id, status: 'approved' };
    if (from || to) {
      paymentFilter.date = {};
      if (from) paymentFilter.date.$gte = from;
      if (to) paymentFilter.date.$lte = to;
    }

    const paymentsRaw = await Payment.find(paymentFilter)
      .populate({
        path: 'rentRecord',
        populate: { path: 'property', select: 'title location' },
      })
      .sort({ date: 1 })
      .lean();

    const payments = propertyId
      ? paymentsRaw.filter((p) => String(p?.rentRecord?.property?._id || '') === String(propertyId))
      : paymentsRaw;

    const maintenanceFilter = { tenant: req.user.id };
    if (propertyId) maintenanceFilter.property = propertyId;
    if (from || to) {
      maintenanceFilter.createdAt = {};
      if (from) maintenanceFilter.createdAt.$gte = from;
      if (to) maintenanceFilter.createdAt.$lte = to;
    }

    const maintenanceRows = await MaintenanceRequest.find(maintenanceFilter)
      .select('cost status createdAt completedAt category')
      .sort({ createdAt: 1 })
      .lean();

    const byMonth = new Map();
    payments.forEach((p) => {
      const key = monthKeyFromIso(p?.date);
      if (!key) return;
      const current = byMonth.get(key) || { key, name: key, rent: 0, maintenance: 0, utilities: 0, total: 0 };
      current.rent += Number(p?.amount || 0);
      byMonth.set(key, current);
    });

    maintenanceRows.forEach((m) => {
      const key = monthKeyFromIso(m?.createdAt);
      if (!key) return;
      const current = byMonth.get(key) || { key, name: key, rent: 0, maintenance: 0, utilities: 0, total: 0 };
      current.maintenance += Math.max(0, Number(m?.cost || 0));
      byMonth.set(key, current);
    });

    const rows = Array.from(byMonth.values())
      .map((r) => ({ ...r, total: Number(r.rent || 0) + Number(r.maintenance || 0) + Number(r.utilities || 0) }))
      .sort((a, b) => String(a.key).localeCompare(String(b.key)));

    const totals = rows.reduce(
      (acc, r) => {
        acc.rent += Number(r.rent || 0);
        acc.maintenance += Number(r.maintenance || 0);
        acc.utilities += Number(r.utilities || 0);
        acc.total += Number(r.total || 0);
        return acc;
      },
      { rent: 0, maintenance: 0, utilities: 0, total: 0 }
    );

    const summary = {
      months: rows.length,
      totalRent: totals.rent,
      totalMaintenance: totals.maintenance,
      totalUtilities: totals.utilities,
      totalExpenses: totals.total,
    };

    const tenantName = await User.findById(req.user.id).select('name').lean();
    let ai = { requested: aiRequested, generated: false };
    if (aiRequested) {
      const cacheKey = `tenant-expense-summary|${req.user.id}|${propertyId || ''}|${from?.toISOString() || ''}|${to?.toISOString() || ''}|${summary.totalExpenses}|${summary.totalRent}|${summary.totalMaintenance}`;
      ai = await getAiInsightsCached({
        cacheKey,
        report: 'tenant-expense-summary',
        locale,
        data: {
          filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
          summary,
          byMonth: rows,
        },
      });
    }

    res.json({
      report: 'tenant-expense-summary',
      generatedAt: new Date().toISOString(),
      tenant: { id: req.user.id, name: String(tenantName?.name || '') },
      filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
      summary,
      rows,
      ai,
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

router.get('/tenant/maintenance', auth, async (req, res) => {
  try {
    const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
    const { from, to } = parseDateRange(req.query, { defaultDays: 180 });
    const aiRequested = isTruthyQueryFlag(req.query?.ai);
    const locale = req.query?.locale ? String(req.query.locale) : 'en';

    const filter = { tenant: req.user.id };
    if (propertyId) filter.property = propertyId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const requests = await MaintenanceRequest.find(filter)
      .populate('property', 'title location')
      .sort({ createdAt: -1 })
      .lean();

    const rows = requests.map((r) => ({
      requestId: String(r?._id || ''),
      propertyId: String(r?.property?._id || r?.property || ''),
      propertyTitle: String(r?.property?.title || ''),
      issue: String(r?.issue || ''),
      category: String(r?.category || ''),
      status: String(r?.status || ''),
      requestDate: toIsoOrNull(r?.createdAt),
      resolutionDate: toIsoOrNull(r?.completedAt || (r?.status === 'completed' ? r?.updatedAt : null)),
    }));

    const summary = {
      totalRequests: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      inProgress: rows.filter((r) => r.status === 'in-progress').length,
      completed: rows.filter((r) => r.status === 'completed').length,
    };

    const byMonth = new Map();
    rows.forEach((r) => {
      const key = monthKeyFromIso(r?.requestDate);
      if (!key) return;
      const current = byMonth.get(key) || { key, name: key, count: 0 };
      current.count += 1;
      byMonth.set(key, current);
    });
    const monthlyRequests = Array.from(byMonth.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));

    const byCategory = new Map();
    rows.forEach((r) => {
      const key = String(r?.category || r?.issue || '').trim();
      if (!key) return;
      byCategory.set(key, (byCategory.get(key) || 0) + 1);
    });
    const topCategories = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const tenantName = await User.findById(req.user.id).select('name').lean();
    let ai = { requested: aiRequested, generated: false };
    if (aiRequested) {
      const cacheKey = `tenant-maintenance|${req.user.id}|${propertyId || ''}|${from?.toISOString() || ''}|${to?.toISOString() || ''}|${summary.totalRequests}|${summary.completed}|${summary.pending}|${summary.inProgress}`;
      ai = await getAiInsightsCached({
        cacheKey,
        report: 'tenant-maintenance',
        locale,
        data: {
          filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
          summary,
          monthlyRequests,
          topCategories,
        },
      });
    }

    res.json({
      report: 'tenant-maintenance',
      generatedAt: new Date().toISOString(),
      tenant: { id: req.user.id, name: String(tenantName?.name || '') },
      filters: { from: from?.toISOString(), to: to?.toISOString(), propertyId: propertyId || null },
      summary,
      monthlyRequests,
      topCategories,
      rows,
      ai,
    });
  } catch (err) {
    console.error(err?.message || err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
