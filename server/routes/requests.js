const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const RentRecord = require('../models/RentRecord');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');
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

// Helper to normalize transaction type
function normalizeTxType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (['buy', 'purchase', 'sale', 'sell'].includes(t)) return 'buy';
  return 'rent';
}

// Create a new request (Buyer/Tenant -> Owner)
router.post('/', auth, async (req, res) => {
  try {
    const { propertyId, type, message, offerAmount } = req.body;

    if (!propertyId) {
      return res.status(400).json({ msg: 'Property ID is required' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    // Ownership check: owner cannot request own property
    if (property.owner && property.owner.toString() === req.user.id) {
      return res.status(400).json({ msg: 'You cannot submit a request for your own property' });
    }

    const requestedType = normalizeTxType(type);
    const propertyType = normalizeTxType(property.transactionType);

    // Validate that requested type matches property transaction type
    if (requestedType !== propertyType) {
      return res.status(400).json({
        msg: `This property is listed for ${propertyType === 'buy' ? 'sale' : 'rent'} only. Cannot submit a ${requestedType} request.`
      });
    }

    // Check if property is already sold or occupied
    if (requestedType === 'buy' && property.saleStatus === 'sold') {
      return res.status(400).json({ msg: 'This property has already been sold.' });
    }
    if (requestedType === 'rent' && property.occupancyStatus === 'occupied') {
      return res.status(400).json({ msg: 'This property is currently occupied.' });
    }

    // Check for existing active request by this user for this property
    const existingActiveRequest = await Request.findOne({
      property: propertyId,
      tenant: req.user.id,
      status: { $in: ['pending', 'counteroffer', 'accepted', 'approved', 'terms_confirmed', 'payment_pending'] }
    });

    if (existingActiveRequest) {
      return res.status(400).json({ msg: 'You already have an active request in progress for this property.' });
    }

    const initialAmount = Number(offerAmount) > 0 ? Number(offerAmount) : Number(property.price) || 0;

    const newRequest = new Request({
      property: propertyId,
      owner: property.owner,
      tenant: req.user.id,
      type: requestedType,
      message: message ? String(message).trim() : '',
      offerAmount: initialAmount,
      agreedAmount: initialAmount,
      status: 'pending'
    });

    const savedRequest = await newRequest.save();

    // Send in-app notification to property owner
    const requesterName = req.user.name || 'A user';
    const notifTitle = requestedType === 'buy' ? 'New Purchase Offer' : 'New Rental Request';
    const notifMsg = requestedType === 'buy'
      ? `${requesterName} submitted a purchase offer of ₹${initialAmount.toLocaleString('en-IN')} for "${property.title}".`
      : `${requesterName} submitted a rental request for "${property.title}".`;

    await sendNotification({
      recipient: property.owner,
      sender: req.user.id,
      type: 'new_request',
      title: notifTitle,
      message: notifMsg,
      property: property._id,
      request: savedRequest._id,
      transactionType: requestedType,
      actionUrl: '/dashboard?tab=incoming-requests'
    });

    const populatedRequest = await Request.findById(savedRequest._id)
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populatedRequest);
  } catch (err) {
    console.error('Error creating request:', err.message);
    res.status(500).send('Server Error');
  }
});

// Get requests for Owner (Received requests)
router.get('/owner', auth, async (req, res) => {
  try {
    const requests = await Request.find({ owner: req.user.id })
      .populate('tenant', 'name email phone address idType idNumber age dateOfBirth gender maritalStatus familyMembers religion occupation companyName monthlyIncome idProofImage')
      .populate('agreement')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error('Error fetching owner requests:', err.message);
    res.status(500).send('Server Error');
  }
});

// Get requests for Tenant/Buyer (Sent requests)
router.get('/tenant', auth, async (req, res) => {
  try {
    const requests = await Request.find({ tenant: req.user.id })
      .populate('owner', 'name email phone')
      .populate('agreement')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error('Error fetching tenant requests:', err.message);
    res.status(500).send('Server Error');
  }
});

// Get single request by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone address idType idNumber age dateOfBirth gender maritalStatus familyMembers religion occupation companyName monthlyIncome idProofImage')
      .populate('agreement')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // Authorization: only owner or tenant can view
    const isOwner = request.owner && request.owner._id.toString() === req.user.id;
    const isTenant = request.tenant && request.tenant._id.toString() === req.user.id;
    if (!isOwner && !isTenant) {
      return res.status(403).json({ msg: 'Not authorized to view this request' });
    }

    res.json(request);
  } catch (err) {
    console.error('Error fetching request:', err.message);
    res.status(500).send('Server Error');
  }
});

// Counteroffer (Owner -> Buyer/Tenant)
router.put('/:id/counteroffer', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only the property owner can make a counteroffer' });
    }

    if (!['pending', 'counteroffer'].includes(request.status)) {
      return res.status(400).json({ msg: `Cannot counteroffer a request with status "${request.status}"` });
    }

    const { counterOfferAmount, note } = req.body;
    const numericAmount = Number(counterOfferAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ msg: 'A valid positive counteroffer amount is required' });
    }

    request.counterOfferAmount = numericAmount;
    request.counterOfferNote = note ? String(note).trim() : '';
    request.status = 'counteroffer';
    request.termsConfirmedByOwner = false;
    request.termsConfirmedByBuyer = false;
    request.updatedAt = new Date();
    await request.save();

    const property = await Property.findById(request.property);

    await sendNotification({
      recipient: request.tenant,
      sender: req.user.id,
      type: 'counteroffer_received',
      title: 'Counteroffer Received',
      message: `The owner proposed a counteroffer of ₹${numericAmount.toLocaleString('en-IN')} for "${property?.title || 'property'}".`,
      property: request.property,
      request: request._id,
      transactionType: request.type
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error submitting counteroffer:', err.message);
    res.status(500).send('Server Error');
  }
});

// Accept Counteroffer (Buyer/Tenant -> Owner)
router.put('/:id/accept-counter', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only the requesting buyer/tenant can accept the counteroffer' });
    }

    if (request.status !== 'counteroffer') {
      return res.status(400).json({ msg: 'No active counteroffer to accept' });
    }

    if (!request.counterOfferAmount) {
      return res.status(400).json({ msg: 'Invalid counteroffer record' });
    }

    request.agreedAmount = request.counterOfferAmount;
    request.status = 'accepted';
    request.termsConfirmedByBuyer = true;
    request.updatedAt = new Date();
    await request.save();

    const property = await Property.findById(request.property);
    if (property && request.type === 'buy') {
      property.saleStatus = 'under_contract';
      await property.save();
    }

    await sendNotification({
      recipient: request.owner,
      sender: req.user.id,
      type: 'counteroffer_accepted',
      title: 'Counteroffer Accepted',
      message: `Buyer accepted your counteroffer of ₹${request.agreedAmount.toLocaleString('en-IN')} for "${property?.title || 'property'}".`,
      property: request.property,
      request: request._id,
      transactionType: request.type
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error accepting counteroffer:', err.message);
    res.status(500).send('Server Error');
  }
});

// Accept / Approve Request (Owner -> Buyer/Tenant)
// Supports both PUT /:id/approve (existing contract) and PUT /:id/accept
const handleAcceptOrApprove = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized: only property owner can accept requests' });
    }

    if (!['pending', 'counteroffer'].includes(request.status)) {
      return res.status(400).json({ msg: `Request is already in status "${request.status}"` });
    }

    const property = await Property.findById(request.property);
    if (!property) return res.status(404).json({ msg: 'Associated property not found' });

    // Validate property availability
    if (request.type === 'buy' && property.saleStatus === 'sold') {
      return res.status(400).json({ msg: 'This property has already been sold.' });
    }
    if (request.type === 'rent' && property.occupancyStatus === 'occupied') {
      return res.status(400).json({ msg: 'This property is currently occupied.' });
    }

    // Safety check: Prevent concurrent conflicting requests from overselling or double-booking
    const conflictingRequest = await Request.findOne({
      property: property._id,
      _id: { $ne: request._id },
      status: { $in: ['accepted', 'payment_pending'] }
    });
    if (conflictingRequest) {
      return res.status(400).json({
        msg: 'Another request for this property has already been accepted and is currently in progress.'
      });
    }

    // Simplified, consistent workflow for both Buy and Rent:
    // Acceptance transitions directly to 'accepted', unlocking immediate payment for customer.
    request.status = 'accepted';
    request.agreedAmount = request.counterOfferAmount || request.offerAmount || property.price;
    request.termsConfirmedByOwner = true;
    request.termsConfirmedByBuyer = true;
    request.terms = request.terms || (request.type === 'buy'
      ? 'Standard purchase agreement. Payment of agreed purchase amount/token advance required to finalize ownership transfer.'
      : 'Standard 11-month rental agreement. Monthly rent due on 5th. Payment of initial rent required to activate lease.');
    request.updatedAt = new Date();
    await request.save();

    if (request.type === 'buy') {
      property.saleStatus = 'under_contract';
      await property.save();
    }

    // Send notification to customer (buyer/tenant)
    const isBuy = request.type === 'buy';
    await sendNotification({
      recipient: request.tenant,
      sender: req.user.id,
      type: 'request_accepted',
      title: isBuy ? 'Purchase Offer Accepted — Payment Required' : 'Rental Request Accepted — Payment Required',
      message: isBuy
        ? `Your purchase offer for "${property.title}" has been accepted! Please submit your payment of ₹${request.agreedAmount.toLocaleString('en-IN')} to proceed.`
        : `Your rental application for "${property.title}" has been accepted! Please submit your payment of ₹${request.agreedAmount.toLocaleString('en-IN')} to activate your lease.`,
      property: property._id,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=my-requests'
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error approving request:', err.message);
    res.status(500).send('Server Error');
  }
};

router.put('/:id/approve', auth, handleAcceptOrApprove);
router.put('/:id/accept', auth, handleAcceptOrApprove);

// Confirm Terms (Buyer or Owner) - retained for backward compatibility
router.put('/:id/confirm-terms', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const isOwner = request.owner.toString() === req.user.id;
    const isTenant = request.tenant.toString() === req.user.id;
    if (!isOwner && !isTenant) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (!['accepted', 'approved', 'terms_confirmed'].includes(request.status)) {
      return res.status(400).json({ msg: `Cannot confirm terms while request status is "${request.status}"` });
    }

    const { terms } = req.body;
    if (terms && typeof terms === 'string') {
      request.terms = terms.trim();
    }

    if (isOwner) request.termsConfirmedByOwner = true;
    if (isTenant) request.termsConfirmedByBuyer = true;

    request.updatedAt = new Date();
    await request.save();

    const otherPartyId = isOwner ? request.tenant : request.owner;
    const property = await Property.findById(request.property);

    await sendNotification({
      recipient: otherPartyId,
      sender: req.user.id,
      type: 'terms_confirmed',
      title: 'Closing / Transaction Terms Confirmed',
      message: `Terms confirmed for "${property?.title || 'property'}". Ready for payment and closing.`,
      property: request.property,
      request: request._id,
      transactionType: request.type
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error confirming terms:', err.message);
    res.status(500).send('Server Error');
  }
});

// Submit Payment (Buyer/Tenant -> Owner)
router.put('/:id/payment', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only the requesting buyer/tenant can submit payment' });
    }

    if (request.status === 'completed') {
      return res.status(400).json({ msg: 'This transaction is already completed.' });
    }

    if (request.status === 'payment_pending' && request.paymentDetails?.status === 'submitted') {
      return res.status(400).json({ msg: 'Payment is already submitted and pending owner verification.' });
    }

    // Must be in acceptable status (accepted, terms_confirmed, approved, or payment_pending if resubmitting after rejection)
    if (!['accepted', 'approved', 'terms_confirmed', 'payment_pending'].includes(request.status)) {
      return res.status(400).json({ msg: `Transaction is not eligible for payment in status "${request.status}"` });
    }

    const { amount, mode, transactionId, screenshot } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ msg: 'A valid payment amount is required' });
    }

    let formattedMode = mode;
    if (typeof mode === 'string') {
      const lower = mode.trim().toLowerCase();
      if (lower === 'upi') formattedMode = 'UPI';
      else if (lower === 'bank_transfer' || lower === 'bank transfer') formattedMode = 'Bank Transfer';
      else if (lower === 'cash') formattedMode = 'Cash';
      else if (lower === 'cheque' || lower === 'check') formattedMode = 'Cheque';
    }

    const validModes = ['UPI', 'Bank Transfer', 'Cash', 'Cheque'];
    if (!validModes.includes(formattedMode)) {
      return res.status(400).json({ msg: `Invalid payment mode. Must be one of: ${validModes.join(', ')}` });
    }

    // Update Request paymentDetails and status
    request.paymentDetails = {
      amount: numericAmount,
      mode: formattedMode,
      transactionId: transactionId || '',
      screenshot: screenshot || '',
      submittedAt: new Date(),
      status: 'submitted'
    };
    request.status = 'payment_pending';
    request.updatedAt = new Date();
    await request.save();

    // Create or update persistent Payment record in DB
    let payment = await Payment.findOne({ request: request._id });
    if (!payment) {
      payment = new Payment({
        rentRecord: null,
        request: request._id,
        property: request.property,
        paymentType: request.type === 'buy' ? 'purchase_advance' : 'rent',
        tenant: request.tenant,
        owner: request.owner,
        amount: numericAmount,
        mode: formattedMode,
        transactionId: transactionId || '',
        screenshot: screenshot || '',
        status: 'submitted'
      });
    } else {
      payment.amount = numericAmount;
      payment.mode = formattedMode;
      payment.transactionId = transactionId || '';
      payment.screenshot = screenshot || '';
      payment.status = 'submitted';
      payment.date = new Date();
      payment.rejectionReason = undefined;
    }
    await payment.save();

    const property = await Property.findById(request.property);

    // Notify owner
    await sendNotification({
      recipient: request.owner,
      sender: req.user.id,
      type: 'payment_submitted',
      title: 'Payment Submitted for Verification',
      message: `${req.user.name || 'Customer'} submitted a payment of ₹${numericAmount.toLocaleString('en-IN')} via ${formattedMode} for "${property?.title || 'property'}". Please review and verify.`,
      property: request.property,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=incoming-requests'
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error submitting payment:', err.message);
    res.status(500).send('Server Error');
  }
});

// Verify Payment (Owner)
router.put('/:id/verify-payment', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only the property owner can verify payments' });
    }

    if (request.status === 'completed') {
      return res.status(400).json({ msg: 'Payment has already been verified and transaction is completed.' });
    }

    if (request.status !== 'payment_pending') {
      return res.status(400).json({ msg: `Payment cannot be verified for request with status "${request.status}"` });
    }

    // Generate official receipt number
    const count = (await Payment.countDocuments({ status: 'approved' })) + 1;
    const date = new Date();
    const receiptNumber = `RES-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${count.toString().padStart(5, '0')}`;

    request.paymentDetails.status = 'verified';
    request.paymentDetails.verifiedAt = new Date();
    request.paymentDetails.receiptNumber = receiptNumber;
    request.status = 'completed';
    request.updatedAt = new Date();

    // Update Payment record in DB
    const payment = (await Payment.findOne({ request: request._id, status: 'submitted' })) || (await Payment.findOne({ request: request._id }));
    if (payment) {
      payment.status = 'approved';
      payment.approvedDate = new Date();
      payment.receiptNumber = receiptNumber;
      await payment.save();
    }

    const property = await Property.findById(request.property);

    if (request.type === 'buy' && property) {
      // Transfer property ownership to the buyer!
      const previousOwnerId = property.owner;
      property.previousOwner = previousOwnerId;
      if (!Array.isArray(property.previousOwners)) {
        property.previousOwners = [];
      }
      property.previousOwners.push({
        owner: previousOwnerId,
        transferredAt: new Date(),
        price: request.agreedAmount || request.offerAmount || property.price
      });

      // The buyer is now the owner of the property
      property.owner = request.tenant;
      property.buyer = request.tenant;
      property.tenant = null; // Buyer owns the property, they are not a tenant!
      property.saleStatus = 'sold';
      property.occupancyStatus = 'occupied';
      property.listingStatus = 'unlisted';
      property.isListed = false;
      property.unlistedAt = new Date();
      property.soldDate = new Date();
      property.finalPrice = request.agreedAmount || request.offerAmount || property.price;
      await property.save();

      // Reject all other competing requests for this property
      await Request.updateMany(
        { property: request.property, _id: { $ne: request._id }, status: { $in: ['pending', 'counteroffer', 'accepted'] } },
        { status: 'rejected', rejectionReason: 'Property has been sold to another buyer.' }
      );
    } else if (request.type === 'rent' && property) {
      // Rental workflow: Create active Agreement and RentRecord upon verified payment
      let agreement = request.agreement ? await Agreement.findById(request.agreement) : null;
      if (!agreement) {
        agreement = new Agreement({
          tenant: request.tenant,
          owner: request.owner,
          property: request.property,
          rentAmount: request.agreedAmount || property.price,
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 11)),
          status: 'active',
          terms: request.terms || 'Standard rental agreement terms and conditions apply.'
        });
        await agreement.save();
        request.agreement = agreement._id;
      } else {
        agreement.status = 'active';
        await agreement.save();
      }

      // Auto-generate / update initial rent record for agreement
      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      currentMonth.setHours(0, 0, 0, 0);

      let rentRecord = await RentRecord.findOne({ agreement: agreement._id, month: currentMonth });
      const paidAmount = request.paymentDetails.amount || agreement.rentAmount;
      if (!rentRecord) {
        const dueDate = new Date(currentMonth);
        dueDate.setDate(agreement.duesDay || 5);
        const balance = Math.max(0, agreement.rentAmount - paidAmount);
        rentRecord = new RentRecord({
          tenant: agreement.tenant,
          owner: agreement.owner,
          property: agreement.property,
          agreement: agreement._id,
          month: currentMonth,
          dueDate: dueDate,
          rentAmount: agreement.rentAmount,
          totalPaid: paidAmount,
          balance: balance,
          status: balance === 0 ? 'paid' : 'partially_paid'
        });
        await rentRecord.save();
      } else {
        rentRecord.totalPaid = (rentRecord.totalPaid || 0) + paidAmount;
        rentRecord.balance = Math.max(0, rentRecord.rentAmount - rentRecord.totalPaid);
        rentRecord.status = rentRecord.balance === 0 ? 'paid' : 'partially_paid';
        await rentRecord.save();
      }

      if (payment) {
        payment.rentRecord = rentRecord._id;
        await payment.save();
      }

      // Update property occupancy
      property.tenant = request.tenant;
      property.currentTenantId = request.tenant;
      property.currentAgreementId = agreement._id;
      property.occupancyStatus = 'occupied';
      property.listingStatus = 'unavailable';
      property.isListed = false;
      await property.save();

      // Reject competing pending requests for this rental property
      await Request.updateMany(
        { property: request.property, _id: { $ne: request._id }, status: { $in: ['pending', 'counteroffer', 'accepted'] } },
        { status: 'rejected', rejectionReason: 'Property has been leased to another applicant.' }
      );
    }

    await request.save();

    // Send confirmation notification to customer (buyer / tenant)
    await sendNotification({
      recipient: request.tenant,
      sender: req.user.id,
      type: 'payment_verified',
      title: request.type === 'buy' ? 'Payment Verified — You Own the Property!' : 'Payment Verified — Rental Lease Active!',
      message: request.type === 'buy'
        ? `Your payment of ₹${request.paymentDetails.amount?.toLocaleString('en-IN')} for "${property?.title || 'property'}" was verified! You are now the official owner. Receipt: ${receiptNumber}.`
        : `Your payment of ₹${request.paymentDetails.amount?.toLocaleString('en-IN')} for "${property?.title || 'property'}" was verified! Your lease is active. Receipt: ${receiptNumber}.`,
      property: request.property,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=my-requests'
    });

    // Send confirmation notification to owner
    const customerUser = await User.findById(request.tenant).select('name email');
    await sendNotification({
      recipient: request.owner,
      sender: req.user.id,
      type: request.type === 'buy' ? 'ownership_transferred' : 'transaction_completed',
      title: request.type === 'buy' ? 'Property Sold & Ownership Transferred' : 'Rental Payment Verified & Tenancy Confirmed',
      message: request.type === 'buy'
        ? `Payment verified. Ownership of "${property?.title || 'property'}" has officially been transferred to ${customerUser?.name || 'the buyer'}. Receipt: ${receiptNumber}.`
        : `Payment verified. Rental tenancy for "${property?.title || 'property'}" has officially commenced with ${customerUser?.name || 'the tenant'}. Receipt: ${receiptNumber}.`,
      property: request.property,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=incoming-requests'
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('agreement')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error verifying payment:', err.message);
    res.status(500).send('Server Error');
  }
});

// Complete transaction (Owner marks handover / tenancy / sale finalized)
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only the property owner can complete this transaction' });
    }

    if (request.status !== 'completed' && request.paymentDetails?.status !== 'verified') {
      return res.status(400).json({ msg: 'Cannot complete transaction before payment is verified' });
    }

    request.status = 'completed';
    request.updatedAt = new Date();
    await request.save();

    const property = await Property.findById(request.property);

    if (request.type === 'buy' && property) {
      if (property.owner.toString() !== request.tenant.toString()) {
        const previousOwnerId = property.owner;
        property.previousOwner = previousOwnerId;
        if (!Array.isArray(property.previousOwners)) {
          property.previousOwners = [];
        }
        property.previousOwners.push({
          owner: previousOwnerId,
          transferredAt: new Date(),
          price: request.agreedAmount || request.offerAmount || property.price
        });
        property.owner = request.tenant; // Transfer ownership to buyer!
      }
      property.buyer = request.tenant;
      property.tenant = null;
      property.saleStatus = 'sold';
      property.occupancyStatus = 'occupied';
      property.listingStatus = 'unlisted';
      property.isListed = false;
      property.unlistedAt = new Date();
      property.soldDate = property.soldDate || new Date();
      property.finalPrice = request.agreedAmount || request.offerAmount || property.price;
      await property.save();

      await Request.updateMany(
        { property: request.property, _id: { $ne: request._id }, status: { $in: ['pending', 'counteroffer', 'accepted'] } },
        { status: 'rejected', rejectionReason: 'Property has been sold to another buyer.' }
      );
    }

    await sendNotification({
      recipient: request.tenant,
      sender: req.user.id,
      type: 'transaction_completed',
      title: request.type === 'buy' ? 'Property Ownership Transferred!' : 'Rental Handover Complete!',
      message: request.type === 'buy'
        ? `Congratulations! Ownership of "${property?.title || 'property'}" is officially transferred to you!`
        : `Your rental lease for "${property?.title || 'property'}" is active and handover is complete!`,
      property: request.property,
      request: request._id,
      transactionType: request.type
    });

    if (request.type === 'buy') {
      const buyerUser = await User.findById(request.tenant).select('name email');
      await sendNotification({
        recipient: request.owner,
        sender: req.user.id,
        type: 'ownership_transferred',
        title: 'Property Sold & Ownership Transferred',
        message: `Sale finalized. Ownership of "${property?.title || 'property'}" has officially been transferred to ${buyerUser?.name || 'the buyer'}.`,
        property: request.property,
        request: request._id,
        transactionType: 'buy'
      });
    }

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('agreement')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error completing transaction:', err.message);
    res.status(500).send('Server Error');
  }
});

// Reject Payment (Owner)
router.put('/:id/reject-payment', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only the property owner can reject payments' });
    }

    if (request.status !== 'payment_pending') {
      return res.status(400).json({ msg: `No pending payment to reject for request status "${request.status}"` });
    }

    const reason = req.body.reason ? String(req.body.reason).trim() : 'Invalid transaction details or verification failed.';

    request.paymentDetails.status = 'rejected';
    request.status = 'accepted'; // Return to awaiting valid payment
    request.updatedAt = new Date();
    await request.save();

    // Update payment record in DB
    const payment = (await Payment.findOne({ request: request._id, status: 'submitted' })) || (await Payment.findOne({ request: request._id }));
    if (payment) {
      payment.status = 'rejected';
      payment.rejectionReason = reason;
      await payment.save();
    }

    const property = await Property.findById(request.property);

    // Notify buyer/tenant
    await sendNotification({
      recipient: request.tenant,
      sender: req.user.id,
      type: 'payment_rejected',
      title: 'Payment Verification Failed',
      message: `Payment verification for "${property?.title || 'property'}" was rejected. Reason: ${reason}. Please submit a valid transaction receipt.`,
      property: request.property,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=my-requests'
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error rejecting payment:', err.message);
    res.status(500).send('Server Error');
  }
});

// Reject Request (Owner)
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized: only property owner can reject requests' });
    }

    if (request.status === 'completed') {
      return res.status(400).json({ msg: 'Cannot reject a completed transaction' });
    }

    const reason = req.body.reason || req.body.rejectionReason || 'Request declined by property owner.';

    request.status = 'rejected';
    request.rejectionReason = String(reason).trim();
    request.updatedAt = new Date();
    await request.save();

    // If property was marked under_contract by this request, release it
    const property = await Property.findById(request.property);
    if (property && property.saleStatus === 'under_contract') {
      // Check if any other request is active
      const otherActive = await Request.findOne({
        property: property._id,
        _id: { $ne: request._id },
        status: { $in: ['accepted', 'terms_confirmed', 'payment_pending'] }
      });
      if (!otherActive) {
        property.saleStatus = 'available';
        await property.save();
      }
    }

    // Send notification to buyer/tenant
    await sendNotification({
      recipient: request.tenant,
      sender: req.user.id,
      type: 'request_rejected',
      title: 'Request Declined',
      message: `Your ${request.type} request for "${property?.title || 'property'}" was declined. Reason: ${request.rejectionReason}`,
      property: request.property,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=my-requests'
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error rejecting request:', err.message);
    res.status(500).send('Server Error');
  }
});

// Cancel / Withdraw Request (Buyer/Tenant)
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized: only the requesting user can cancel this request' });
    }

    if (['completed', 'rejected', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ msg: `Cannot cancel a request that is already ${request.status}` });
    }

    const reason = req.body.reason ? String(req.body.reason).trim() : 'Cancelled by requester.';

    request.status = 'cancelled';
    request.cancelledReason = reason;
    request.updatedAt = new Date();
    await request.save();

    const property = await Property.findById(request.property);
    if (property && property.saleStatus === 'under_contract') {
      const otherActive = await Request.findOne({
        property: property._id,
        _id: { $ne: request._id },
        status: { $in: ['accepted', 'terms_confirmed', 'payment_pending'] }
      });
      if (!otherActive) {
        property.saleStatus = 'available';
        await property.save();
      }
    }

    // Send notification to owner
    await sendNotification({
      recipient: request.owner,
      sender: req.user.id,
      type: 'request_cancelled',
      title: 'Request Withdrawn',
      message: `The ${request.type} request for "${property?.title || 'property'}" was withdrawn by the applicant.`,
      property: request.property,
      request: request._id,
      transactionType: request.type,
      actionUrl: '/dashboard?tab=incoming-requests'
    });

    const populated = await Request.findById(request._id)
      .populate('owner', 'name email phone')
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images transactionType propertyType saleStatus occupancyStatus');

    res.json(populated);
  } catch (err) {
    console.error('Error cancelling request:', err.message);
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
    const propertyId = req.body.propertyId || req.body.property;
    const { issue, description } = req.body;

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
