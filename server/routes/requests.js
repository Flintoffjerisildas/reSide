const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const RentRecord = require('../models/RentRecord');
const auth = require('../middleware/auth');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSummary(issue, description) {
  const i = String(issue || '').trim();
  const d = String(description || '').trim();
  const base = [i, d].filter(Boolean).join(' - ').replace(/\s+/g, ' ').trim();
  if (!base) return '';
  if (base.length <= 140) return base;
  return `${base.slice(0, 137).trimEnd()}...`;
}

function includesAny(text, needles) {
  for (const n of needles) {
    if (n instanceof RegExp) {
      if (n.test(text)) return true;
    } else if (text.includes(n)) {
      return true;
    }
  }
  return false;
}

function classifyMaintenanceRequest(issue, description) {
  const text = normalizeText(`${issue || ''} ${description || ''}`);

  const high = includesAny(text, [
    'gas leak',
    'smell gas',
    'smoke',
    'fire',
    'sparking',
    'short circuit',
    'electric shock',
    'power failure',
    'no power',
    'electricity outage',
    'water leakage',
    'water leak',
    'leaking',
    'flood',
    'burst pipe',
    'sewage',
    'overflow',
    'no water'
  ]);

  const medium = includesAny(text, [
    'ac not cooling',
    'air conditioner not cooling',
    'ac not working',
    'fan not working',
    'light not working',
    'geyser not working',
    'water heater not working',
    'refrigerator not working',
    'fridge not working',
    'washing machine not working',
    'microwave not working',
    'oven not working'
  ]);

  const low = includesAny(text, ['painting', 'paint', 'small repair', 'minor repair', 'loose handle', 'hinge', 'cosmetic']);

  let priority = 'Low';
  if (high) priority = 'High';
  else if (medium) priority = 'Medium';
  else if (low) priority = 'Low';

  const plumbing = includesAny(text, [
    'plumb',
    'pipe',
    'tap',
    'faucet',
    'sink',
    'toilet',
    'flush',
    'drain',
    'drainage',
    'clog',
    'blocked',
    'shower',
    'water leak',
    'water leakage',
    'leaking',
    'sewage',
    'overflow'
  ]);
  const electrical = includesAny(text, [
    'electrical',
    'power',
    'electric',
    'socket',
    'switch',
    'wiring',
    'fuse',
    'breaker',
    'mcb',
    'short circuit',
    'sparking',
    'bulb',
    'light',
    'fan'
  ]);
  const appliance = includesAny(text, [
    'appliance',
    /\bac\b/,
    /a\/c/,
    'air conditioner',
    'fridge',
    'refrigerator',
    'washing machine',
    'microwave',
    'oven',
    'stove',
    'cooktop',
    'chimney',
    'geyser',
    'water heater'
  ]);
  const structural = includesAny(text, [
    'structural',
    'wall',
    'ceiling',
    'crack',
    'roof',
    'floor',
    'tile',
    'tiles',
    'door',
    'window',
    'lock',
    'broken door',
    'broken window',
    'plaster',
    'damp',
    'seepage'
  ]);
  const cleaning = includesAny(text, [
    'clean',
    'cleaning',
    'deep clean',
    'garbage',
    'trash',
    'pest',
    'cockroach',
    'termite',
    /\brats?\b/,
    'mosquito',
    'mold',
    'mould'
  ]);

  let category = 'Other';
  if (plumbing) category = 'Plumbing';
  else if (electrical) category = 'Electrical';
  else if (appliance) category = 'Appliance';
  else if (structural) category = 'Structural';
  else if (cleaning) category = 'Cleaning';

  const summary = buildSummary(issue, description);

  return { category, priority, summary };
}

// Create a new request (Tenant -> Owner)
router.post('/', auth, async (req, res) => {
  try {
    const { propertyId, type, message } = req.body;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    // Check if request already exists
    const existingRequest = await Request.findOne({
      property: propertyId,
      tenant: req.user.id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ msg: 'Request already sent for this property' });
    }

    const newRequest = new Request({
      property: propertyId,
      owner: property.owner,
      tenant: req.user.id,
      type,
      message
    });

    const request = await newRequest.save();
    res.json(request);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get requests for Owner (Received requests)
router.get('/owner', auth, async (req, res) => {
  try {
    const requests = await Request.find({ owner: req.user.id })
      .populate('tenant', '-password')
      .populate('property', 'title location price')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get requests for Tenant (Sent requests)
router.get('/tenant', auth, async (req, res) => {
  try {
    const requests = await Request.find({ tenant: req.user.id })
      .populate('property', 'title location price')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Approve Request
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // Ensure logged in user is the owner
    if (request.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    request.status = 'approved';
    await request.save();

    // Create Agreement automatically (for rent requests) before updating property
    let newAgreement = null;
    if (request.type === 'rent') {
      newAgreement = new Agreement({
        tenant: request.tenant,
        owner: request.owner,
        property: request.property,
        rentAmount: undefined,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 11)), // Default 11 months
        status: 'active'
      });

      const propertyForPrice = await Property.findById(request.property);
      if (!propertyForPrice) {
        return res.status(404).json({ msg: 'Property not found' });
      }
      newAgreement.rentAmount = propertyForPrice.price;

      await newAgreement.save();

      // Auto-generate initial rent records for this agreement so payments appear immediately

      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      let iteratorDate = newAgreement.startDate ? new Date(newAgreement.startDate) : new Date(currentMonth);
      if (isNaN(iteratorDate.getTime())) {
        iteratorDate = new Date(currentMonth);
      }

      iteratorDate.setDate(1);
      iteratorDate.setHours(0, 0, 0, 0);

      while (iteratorDate <= currentMonth) {
        const loopMonth = new Date(iteratorDate);

        const existing = await RentRecord.findOne({
          agreement: newAgreement._id,
          month: loopMonth
        });

        if (!existing) {
          const dueDate = new Date(loopMonth);
          dueDate.setDate(newAgreement.duesDay || 5);

          let status = 'pending';
          if (dueDate < new Date() && status === 'pending') {
            status = 'overdue';
          }

          const newRecord = new RentRecord({
            tenant: newAgreement.tenant,
            owner: newAgreement.owner,
            property: newAgreement.property,
            agreement: newAgreement._id,
            month: loopMonth,
            dueDate: dueDate,
            rentAmount: newAgreement.rentAmount,
            balance: newAgreement.rentAmount,
            status: status
          });

          await newRecord.save();
        }

        iteratorDate.setMonth(iteratorDate.getMonth() + 1);
      }
    }

    // Update Property to assign tenant and track current agreement
    const property = await Property.findByIdAndUpdate(
      request.property,
      {
        tenant: request.tenant,
        currentTenantId: request.tenant,
        currentAgreementId: newAgreement ? newAgreement._id : null,
        occupancyStatus: 'occupied'
      },
      { new: true }
    );

    // Reject other pending requests for the same property?
    // Optional, but good practice.
    await Request.updateMany(
      { property: request.property, _id: { $ne: request._id }, status: 'pending' },
      { status: 'rejected' }
    );

    res.json(request);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Reject Request
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    request.status = 'rejected';
    await request.save();

    res.json(request);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Maintenance Requests ---

router.post('/maintenance/classify', auth, async (req, res) => {
  try {
    const raw = req.body?.maintenance_request;
    const issue = req.body?.issue;
    const description = req.body?.description;

    const text = typeof raw === 'string' ? raw : `${issue || ''} ${description || ''}`;
    const result = classifyMaintenanceRequest(text, '');
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Create Maintenance Request (Tenant -> Owner)
router.post('/maintenance', auth, async (req, res) => {
  try {
    const { propertyId, issue, description } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    // Verify tenant is actually the tenant of this property?
    // Assuming req.user.id should match property.tenant
    // if (property.tenant.toString() !== req.user.id) {
    //   return res.status(401).json({ msg: 'Not authorized' });
    // }

    const classification = classifyMaintenanceRequest(issue, description);

    const newRequest = new MaintenanceRequest({
      property: propertyId,
      tenant: req.user.id,
      owner: property.owner,
      issue,
      description,
      category: classification.category,
      priority: classification.priority,
      summary: classification.summary,
      status: 'pending'
    });

    await newRequest.save();
    res.json(newRequest);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get Maintenance Requests for Owner (Received)
router.get('/maintenance/owner', auth, async (req, res) => {
  try {
    const requests = await MaintenanceRequest.find({ owner: req.user.id })
      .populate('tenant', 'name email phone')
      .populate('property', 'title location')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get Maintenance Requests for Tenant (Sent)
router.get('/maintenance/tenant', auth, async (req, res) => {
  try {
    const requests = await MaintenanceRequest.find({ tenant: req.user.id })
      .populate('property', 'title location')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get Maintenance Requests for a Property (Owner View / Tenant View)
router.get('/property/:propertyId/maintenance', auth, async (req, res) => {
  try {
    const requests = await MaintenanceRequest.find({ property: req.params.propertyId })
      .populate('tenant', '-password')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update Maintenance Request Status (Owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, cost } = req.body;
    // We can also support update by tenant? For now assume owner updates status.
    
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // Verify owner
    if (request.owner.toString() !== req.user.id) {
       // Allow tenant to cancel? 
       return res.status(401).json({ msg: 'Not authorized' });
    }

    if (status !== undefined) {
      const normalizedStatus = String(status);
      if (!['pending', 'in-progress', 'completed'].includes(normalizedStatus)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      request.status = normalizedStatus;
      if (normalizedStatus === 'completed') {
        request.completedAt = new Date();
      }
    }

    if (cost !== undefined) {
      const numericCost = Number(cost);
      if (!Number.isFinite(numericCost) || numericCost < 0) {
        return res.status(400).json({ msg: 'Invalid cost' });
      }
      request.cost = numericCost;
    }
    
    request.updatedAt = new Date();
    
    await request.save();
    res.json(request);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/admin/maintenance', auth, auth.requireAdmin, async (req, res) => {
  try {
    const status = req.query?.status;
    const filter = {};
    if (status) filter.status = String(status);

    const requests = await MaintenanceRequest.find(filter)
      .populate('tenant', 'name email phone')
      .populate('owner', 'name email phone')
      .populate('property', 'title location')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/admin/maintenance/:id', auth, auth.requireAdmin, async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const status = req.body?.status;
    const assignedTo = req.body?.assignedTo;
    const cost = req.body?.cost;

    if (status !== undefined) {
      const normalizedStatus = String(status);
      if (!['pending', 'in-progress', 'completed'].includes(normalizedStatus)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      request.status = normalizedStatus;
      if (normalizedStatus === 'completed') request.completedAt = new Date();
    }

    if (assignedTo !== undefined) {
      request.assignedTo = String(assignedTo);
      request.assignedBy = req.user.id;
      request.assignedAt = new Date();
    }

    if (cost !== undefined) {
      const numericCost = Number(cost);
      if (!Number.isFinite(numericCost) || numericCost < 0) {
        return res.status(400).json({ msg: 'Invalid cost' });
      }
      request.cost = numericCost;
    }

    request.updatedAt = new Date();

    await request.save();
    res.json(request);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
