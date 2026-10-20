const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Property = require('../models/Property');
const VisitRequest = require('../models/VisitRequest');

// Create visit request (tenant)
router.post('/', auth, async (req, res) => {
  try {
    const { propertyId, slot, notes } = req.body;
    if (!propertyId || !slot) return res.status(400).json({ msg: 'propertyId and slot are required' });

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    const ownerId = property.owner.toString();
    const tenantId = req.user.id;
    if (ownerId === tenantId) return res.status(400).json({ msg: 'Owner cannot request a visit on own property' });

    const visit = await VisitRequest.create({
      property: propertyId,
      owner: ownerId,
      tenant: tenantId,
      slot: new Date(slot),
      notes
    });

    res.json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// List my visit requests (tenant)
router.get('/tenant', auth, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const visits = await VisitRequest.find({ tenant: tenantId })
      .sort({ createdAt: -1 })
      .populate('property', 'title location images')
      .lean();
    res.json(visits);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// List visit requests for my properties (owner)
router.get('/owner', auth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const visits = await VisitRequest.find({ owner: ownerId })
      .sort({ createdAt: -1 })
      .populate('property', 'title location images')
      .lean();
    res.json(visits);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Approve visit (owner only)
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const visit = await VisitRequest.findById(req.params.id);
    if (!visit) return res.status(404).json({ msg: 'Visit request not found' });
    if (visit.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
    if (visit.status !== 'pending') return res.status(400).json({ msg: 'Visit is not pending' });
    visit.status = 'approved';
    await visit.save();
    res.json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Reject visit (owner only)
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const visit = await VisitRequest.findById(req.params.id);
    if (!visit) return res.status(404).json({ msg: 'Visit request not found' });
    if (visit.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
    if (visit.status !== 'pending') return res.status(400).json({ msg: 'Visit is not pending' });
    visit.status = 'rejected';
    await visit.save();
    res.json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
