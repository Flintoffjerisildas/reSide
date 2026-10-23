const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// Get all properties (return ALL for dev/demo purposes)
router.get('/', async (req, res) => {
  try {
    // For demo purposes, returning all properties regardless of status
    // In production, this should be: { status: 'approved' }
    const properties = await Property.find(); 
    res.json(properties);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get MY properties (all currently owned by user)
router.get('/my', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id })
      .populate(
        'tenant',
        'name email phone address aadhar gender age dateOfBirth familyMembers religion occupation companyName monthlyIncome maritalStatus idType idNumber idProofImage'
      )
      .populate('previousOwner', 'name email phone')
      .populate('buyer', 'name email phone');
    res.json(properties);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get properties previously owned and sold by user
router.get('/sold-history', auth, async (req, res) => {
  try {
    const properties = await Property.find({
      $or: [
        { previousOwner: req.user.id },
        { 'previousOwners.owner': req.user.id }
      ]
    })
      .populate('owner', 'name email phone')
      .populate('buyer', 'name email phone');
    res.json(properties);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add Property
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      propertyType,
      location,
      price,
      transactionType,
      description,
      amenities,
      images,
      geoLocation,
      totalArea,
      bedrooms,
      facing
    } = req.body;
    
    const newProperty = new Property({
      title,
      propertyType,
      location,
      price,
      transactionType,
      description,
      amenities,
      totalArea,
      bedrooms,
      facing,
      images,
      geoLocation,
      owner: req.user.id,
      status: 'approved' // Auto-approve for demo purposes
    });

    const property = await newProperty.save();
    res.json(property);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update Property
router.put('/:id', auth, async (req, res) => {
  try {
    const propertyId = req.params.id;
    console.log(`[DEBUG] PUT /api/properties/${propertyId} - Start`);
    console.log(`[DEBUG] User ID from token: ${req.user.id}`);
    
    // Validate ID format
    if (!propertyId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log(`[DEBUG] Invalid Property ID format: ${propertyId}`);
        return res.status(400).json({ msg: 'Invalid Property ID' });
    }

    const {
      title,
      propertyType,
      location,
      price,
      transactionType,
      description,
      amenities,
      images,
      geoLocation,
      totalArea,
      bedrooms,
      facing,
      status
    } = req.body;

    // Build property object
    const propertyFields = {};
    if (title) propertyFields.title = title;
    if (propertyType) propertyFields.propertyType = propertyType;
    if (location) propertyFields.location = location;
    if (price) propertyFields.price = price;
    if (transactionType) propertyFields.transactionType = transactionType;
    if (typeof description === 'string') propertyFields.description = description;
    if (Array.isArray(amenities)) propertyFields.amenities = amenities;
    if (images) propertyFields.images = images;
    if (geoLocation) propertyFields.geoLocation = geoLocation;
    if (totalArea) propertyFields.totalArea = totalArea;
    if (bedrooms) propertyFields.bedrooms = bedrooms;
    if (facing) propertyFields.facing = facing;
    if (status) propertyFields.status = status;

    let property = await Property.findById(req.params.id);
    console.log(`[DEBUG] Property search for ID: ${req.params.id}`);

    if (!property) {
      console.log(`[DEBUG] Property not found!`);
      return res.status(404).json({ msg: 'Property not found' });
    }
    console.log(`[DEBUG] Property found: ${property._id}`);

    // Make sure user owns property
    if (property.owner.toString() !== req.user.id) {
      console.log(`[DEBUG] Authorization failed. Owner: ${property.owner}, User: ${req.user.id}`);
      return res.status(401).json({ msg: 'Not authorized' });
    }

    property = await Property.findByIdAndUpdate(
      req.params.id,
      { $set: propertyFields },
      { new: true }
    );

    res.json(property);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete Property
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) return res.status(404).json({ msg: 'Property not found' });

    // Make sure user owns property
    if (property.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Property removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/admin', auth, auth.requireAdmin, async (req, res) => {
  try {
    const status = req.query?.status;
    const occupancyStatus = req.query?.occupancyStatus;

    const filter = {};
    if (status) filter.status = String(status);
    if (occupancyStatus) filter.occupancyStatus = String(occupancyStatus);

    const properties = await Property.find(filter)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .sort({ createdAt: -1 });

    res.json(properties);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/admin', auth, auth.requireAdmin, async (req, res) => {
  try {
    const {
      ownerId,
      title,
      propertyType,
      location,
      price,
      transactionType,
      description,
      amenities,
      images,
      geoLocation,
      totalArea,
      bedrooms,
      facing,
      status,
      tenantId,
      occupancyStatus
    } = req.body;

    if (!ownerId) {
      return res.status(400).json({ msg: 'ownerId is required' });
    }

    const newProperty = new Property({
      title,
      propertyType,
      location,
      price,
      transactionType,
      description,
      amenities,
      totalArea,
      bedrooms,
      facing,
      images,
      geoLocation,
      owner: ownerId,
      status: status || 'approved',
      tenant: tenantId || null,
      occupancyStatus: occupancyStatus || (tenantId ? 'occupied' : 'vacant'),
      currentTenantId: tenantId || null
    });

    const property = await newProperty.save();
    res.json(property);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.put('/admin/:id', auth, auth.requireAdmin, async (req, res) => {
  try {
    const propertyId = req.params.id;
    if (!propertyId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ msg: 'Invalid Property ID' });
    }

    const allowed = [
      'title',
      'propertyType',
      'location',
      'price',
      'transactionType',
      'description',
      'amenities',
      'images',
      'geoLocation',
      'totalArea',
      'bedrooms',
      'facing',
      'status',
      'occupancyStatus',
      'tenant',
      'currentTenantId',
      'currentAgreementId',
      'owner'
    ];

    const update = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) update[key] = req.body[key];
    }

    if (req.body?.tenantId !== undefined) {
      update.tenant = req.body.tenantId || null;
      update.currentTenantId = req.body.tenantId || null;
    }

    const property = await Property.findByIdAndUpdate(propertyId, { $set: update }, { new: true });
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    res.json(property);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.delete('/admin/:id', auth, auth.requireAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    await Property.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Property removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get Property by ID
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('buyer', 'name email phone');
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }
    res.json(property);
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Property not found' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
