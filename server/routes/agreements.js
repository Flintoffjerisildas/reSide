const express = require('express');
const router = express.Router();
const Agreement = require('../models/Agreement');
const jwt = require('jsonwebtoken');

// Middleware to verify token (copied from other routes)
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Get agreements for Tenant
router.get('/tenant', auth, async (req, res) => {
  try {
    const agreements = await Agreement.find({ tenant: req.user.id })
      .populate('property', 'title location price propertyType images geoLocatedImage')
      .populate('owner', 'name email phone address')
      .sort({ createdAt: -1 });
    res.json(agreements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get agreements for Owner
router.get('/owner', auth, async (req, res) => {
  try {
    const agreements = await Agreement.find({ owner: req.user.id })
      .populate('property', 'title location price propertyType images geoLocatedImage')
      .populate('tenant', 'name email phone address')
      .sort({ createdAt: -1 });
    res.json(agreements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get agreements by Property ID (Owner/Customer views)
router.get('/property/:propertyId', auth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const agreements = await Agreement.find({ property: propertyId })
      .populate('property', 'title location price propertyType location images geoLocatedImage')
      .populate('tenant', 'name email phone')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(agreements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Tenant fills and signs agreement
router.put('/:id/fill', auth, async (req, res) => {
  try {
    const { startDate, durationMonths, terms } = req.body;
    let agreement = await Agreement.findById(req.params.id);

    if (!agreement) return res.status(404).json({ msg: 'Agreement not found' });

    // Ensure user is the tenant
    if (agreement.tenant.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (agreement.status !== 'pending_tenant') {
      return res.status(400).json({ msg: 'Agreement is not in pending state' });
    }

    // Update fields
    if (startDate) agreement.startDate = new Date(startDate);
    if (durationMonths) {
      const start = agreement.startDate || new Date();
      agreement.endDate = new Date(new Date(start).setMonth(new Date(start).getMonth() + parseInt(durationMonths)));
    }
    if (terms) agreement.terms = terms;

    agreement.status = 'active'; // Activate agreement
    await agreement.save();

    res.json(agreement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Tenant uploads agreement document
router.put('/:id/documents', auth, async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ msg: 'Name and data are required' });
    }

    const agreement = await Agreement.findById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ msg: 'Agreement not found' });
    }

    if (agreement.tenant.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (!Array.isArray(agreement.documents)) {
      agreement.documents = [];
    }

    agreement.documents.push({
      name,
      data,
      uploadedAt: new Date()
    });

    await agreement.save();

    res.json(agreement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
