const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// Get all public properties (only explicitly listed, available properties)
router.get('/', async (req, res) => {
  try {
    const filter = {
      status: 'approved',
      listingStatus: 'listed',
      isListed: true,
      saleStatus: { $ne: 'sold' }
    };

    if (req.query.transactionType) {
      const tType = String(req.query.transactionType).trim().toLowerCase();
      if (tType === 'rent') {
        filter.transactionType = { $regex: /^rent$/i };
        filter.occupancyStatus = { $ne: 'occupied' };
        filter.tenant = null;
      } else if (tType === 'buy' || tType === 'purchase' || tType === 'sale') {
        filter.transactionType = { $regex: /^(buy|purchase|sale)$/i };
        // Sale properties can be listed even if occupied (tenant in place)
      }
    } else {
      // If no specific transactionType requested in query:
      // - Sale properties can be occupied or vacant (buyer purchases with tenant or for possession)
      // - Rent properties must be genuinely vacant and without tenant
      filter.$or = [
        { transactionType: { $regex: /^(buy|purchase|sale)$/i } },
        {
          transactionType: { $regex: /^rent$/i },
          occupancyStatus: { $ne: 'occupied' },
          tenant: null
        }
      ];
    }

    if (req.query.propertyType) {
      filter.propertyType = { $regex: new RegExp(`^${req.query.propertyType.trim()}$`, 'i') };
    }

    if (req.query.location) {
      filter.location = { $regex: req.query.location.trim(), $options: 'i' };
    }

    const properties = await Property.find(filter)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name') // Allow identifying occupancy without exposing sensitive tenant data
      .sort({ listedAt: -1, createdAt: -1 });

    res.json(properties);
  } catch (err) {
    console.error('Error fetching public properties:', err.message);
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
      .populate('buyer', 'name email phone')
      .sort({ createdAt: -1 });
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
      facing,
      listingStatus
    } = req.body;

    const initialListingStatus = listingStatus === 'unlisted' ? 'unlisted' : 'listed';
    
    const newProperty = new Property({
      title,
      propertyType,
      location,
      price,
      transactionType: transactionType || 'purchase',
      description,
      amenities,
      totalArea,
      bedrooms,
      facing,
      images,
      geoLocation,
      owner: req.user.id,
      status: 'approved', // Auto-approve for demo purposes
      listingStatus: initialListingStatus,
      isListed: initialListingStatus === 'listed',
      listedAt: initialListingStatus === 'listed' ? new Date() : null,
      occupancyStatus: 'vacant',
      saleStatus: 'available'
    });

    const property = await newProperty.save();
    res.json(property);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Change Property Listing Status (Owner Controlled)
router.put('/:id/listing-status', auth, async (req, res) => {
  try {
    const propertyId = req.params.id;
    if (!propertyId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ msg: 'Invalid Property ID' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    // Authorization: Must be authenticated owner or admin
    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ msg: 'Not authorized: only property owner can change listing status' });
    }

    const { listingStatus, transactionType, price, description } = req.body;
    if (!['listed', 'unlisted', 'unavailable'].includes(listingStatus)) {
      return res.status(400).json({ msg: 'Invalid listingStatus. Must be listed, unlisted, or unavailable' });
    }

    if (listingStatus === 'unlisted') {
      // Unlist property: Preserves historical records, agreements, payments, requests
      property.listingStatus = 'unlisted';
      property.isListed = false;
      property.unlistedAt = new Date();
      await property.save();
      return res.json(property);
    }

    if (listingStatus === 'unavailable') {
      // Mark as unavailable (e.g. maintenance, personal use)
      property.listingStatus = 'unavailable';
      property.isListed = false;
      await property.save();
      return res.json(property);
    }

    if (listingStatus === 'listed') {
      const effectiveTransactionType = String(transactionType || property.transactionType || '').trim().toLowerCase();
      if (!effectiveTransactionType) {
        return res.status(400).json({ msg: 'Transaction type is required before publishing (Sale or Rent)' });
      }

      const isRent = effectiveTransactionType === 'rent';

      // Transaction Safety Checks:
      if (isRent) {
        // 1. Rental Listings: An occupied property or active tenancy CANNOT be listed for a new rental
        if (property.occupancyStatus === 'occupied' || property.tenant != null || property.currentTenantId != null) {
          return res.status(400).json({
            msg: 'Cannot publish an occupied property for rent. Property must be vacant before listing for rent.'
          });
        }

        // Active Agreement check for rental listings
        const Agreement = require('../models/Agreement');
        const activeAgreement = await Agreement.findOne({
          property: property._id,
          status: { $in: ['active', 'pending_signature', 'notice_period'] }
        });
        if (activeAgreement) {
          return res.status(400).json({
            msg: 'Cannot publish property for rent while an active rental agreement exists.'
          });
        }
      } else {
        // 2. Sale Listings: Existing occupancy does NOT block sale publication.
        // Prospective buyers can purchase an occupied investment property or subject to lease.
        // However, we check if property is currently under contract for another purchase:
        if (property.saleStatus === 'under_contract') {
          return res.status(400).json({
            msg: 'Cannot publish property while under contract for purchase.'
          });
        }
      }

      // 3. Price validation
      const effectivePrice = price !== undefined ? Number(price) : property.price;
      if (isNaN(effectivePrice) || effectivePrice <= 0) {
        return res.status(400).json({ msg: 'A valid price greater than 0 is required to list property' });
      }

      // Update fields
      property.listingStatus = 'listed';
      property.isListed = true;
      property.transactionType = effectiveTransactionType;
      property.price = effectivePrice;
      if (typeof description === 'string') {
        property.description = description;
      }
      property.saleStatus = 'available';
      // If rent, ensure occupancyStatus is vacant. If sale, preserve existing occupancyStatus and tenant info!
      if (isRent) {
        property.occupancyStatus = 'vacant';
      }
      property.listedAt = new Date();

      await property.save();
      return res.json(property);
    }
  } catch (err) {
    console.error('Error changing listing status:', err.message);
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
      status,
      listingStatus
    } = req.body;

    let property = await Property.findById(req.params.id);
    console.log(`[DEBUG] Property search for ID: ${req.params.id}`);

    if (!property) {
      console.log(`[DEBUG] Property not found!`);
      return res.status(404).json({ msg: 'Property not found' });
    }
    console.log(`[DEBUG] Property found: ${property._id}`);

    // Make sure user owns property or is admin
    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      console.log(`[DEBUG] Authorization failed. Owner: ${property.owner}, User: ${req.user.id}`);
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Build property object
    const propertyFields = {};
    if (title) propertyFields.title = title;
    if (propertyType) propertyFields.propertyType = propertyType;
    if (location) propertyFields.location = location;
    if (price !== undefined) propertyFields.price = Number(price);
    if (transactionType) propertyFields.transactionType = transactionType;
    if (typeof description === 'string') propertyFields.description = description;
    if (Array.isArray(amenities)) propertyFields.amenities = amenities;
    if (images) propertyFields.images = images;
    if (geoLocation) propertyFields.geoLocation = geoLocation;
    if (totalArea !== undefined) propertyFields.totalArea = totalArea;
    if (bedrooms !== undefined) propertyFields.bedrooms = bedrooms;
    if (facing) propertyFields.facing = facing;
    if (status) propertyFields.status = status;

    if (listingStatus) {
      if (listingStatus === 'listed') {
        const targetType = String(transactionType || property.transactionType || '').trim().toLowerCase();
        if (targetType === 'rent' && (property.occupancyStatus === 'occupied' || property.tenant != null)) {
          return res.status(400).json({ msg: 'Cannot publish an occupied property for rent.' });
        }
        if (targetType !== 'rent' && property.saleStatus === 'under_contract') {
          return res.status(400).json({ msg: 'Cannot publish property while under contract for purchase.' });
        }
        propertyFields.listingStatus = 'listed';
        propertyFields.isListed = true;
        propertyFields.listedAt = new Date();
      } else if (listingStatus === 'unlisted') {
        propertyFields.listingStatus = 'unlisted';
        propertyFields.isListed = false;
        propertyFields.unlistedAt = new Date();
      } else if (listingStatus === 'unavailable') {
        propertyFields.listingStatus = 'unavailable';
        propertyFields.isListed = false;
      }
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
