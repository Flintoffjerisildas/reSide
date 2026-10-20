const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const VacateRequest = require('../models/VacateRequest');

// Helper to normalize dates to midnight for comparison
function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Tenant: create vacate request
exports.createVacateRequest = async (req, res) => {
  try {
    const { propertyId, reason, requestedVacateDate } = req.body;

    if (!propertyId || !reason || !requestedVacateDate) {
      return res.status(400).json({ msg: 'propertyId, reason and requestedVacateDate are required' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    const agreement = await Agreement.findOne({
      property: propertyId,
      tenant: req.user.id,
      status: 'active'
    });

    if (!agreement) {
      return res.status(400).json({ msg: 'No active agreement found for this property' });
    }

    const existingPending = await VacateRequest.findOne({
      property: propertyId,
      tenant: req.user.id,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ msg: 'You already have a pending vacate request for this property' });
    }

    const requestedDate = new Date(requestedVacateDate);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ msg: 'Invalid requestedVacateDate' });
    }

    const vacateRequest = new VacateRequest({
      property: propertyId,
      tenant: req.user.id,
      owner: property.owner,
      reason: reason.trim(),
      requestedVacateDate: requestedDate,
      status: 'pending',
      agreement: agreement._id
    });

    await vacateRequest.save();

    return res.status(201).json(vacateRequest);
  } catch (err) {
    console.error('createVacateRequest error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// Tenant: get own vacate requests
exports.getMyVacateRequests = async (req, res) => {
  try {
    const requests = await VacateRequest.find({ tenant: req.user.id })
      .populate('property', 'title location price')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    return res.json(requests);
  } catch (err) {
    console.error('getMyVacateRequests error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// Tenant: cancel pending vacate request
exports.cancelVacateRequest = async (req, res) => {
  try {
    const request = await VacateRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Vacate request not found' });
    }

    if (request.tenant.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ msg: 'Only pending requests can be cancelled' });
    }

    await request.deleteOne();
    return res.json({ msg: 'Vacate request cancelled successfully' });
  } catch (err) {
    console.error('cancelVacateRequest error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// Owner: get vacate requests for a property
exports.getVacateRequestsForProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const requests = await VacateRequest.find({ property: propertyId })
      .populate('tenant', 'name email phone')
      .sort({ createdAt: -1 });

    return res.json(requests);
  } catch (err) {
    console.error('getVacateRequestsForProperty error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// Owner: approve vacate request
exports.approveVacateRequest = async (req, res) => {
  try {
    const request = await VacateRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Vacate request not found' });
    }

    if (request.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ msg: 'Only pending requests can be approved' });
    }

    const agreement = await Agreement.findOne({
      _id: request.agreement || undefined,
      property: request.property,
      tenant: request.tenant
    }) || await Agreement.findOne({
      property: request.property,
      tenant: request.tenant,
      status: 'active'
    });

    if (!agreement) {
      return res.status(400).json({ msg: 'No active agreement found for this vacate request' });
    }

    agreement.status = 'notice_period';
    agreement.vacateDate = request.requestedVacateDate;
    await agreement.save();

    request.status = 'approved';
    await request.save();

    return res.json({ request, agreement });
  } catch (err) {
    console.error('approveVacateRequest error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// Owner: reject vacate request
exports.rejectVacateRequest = async (req, res) => {
  try {
    const request = await VacateRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Vacate request not found' });
    }

    if (request.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ msg: 'Only pending requests can be rejected' });
    }

    request.status = 'rejected';
    await request.save();

    return res.json(request);
  } catch (err) {
    console.error('rejectVacateRequest error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

// Owner: complete vacate (mark as vacated)
exports.completeVacateRequest = async (req, res) => {
  try {
    const request = await VacateRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Vacate request not found' });
    }

    if (request.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({ msg: 'Only approved requests can be completed' });
    }

    const today = normalizeDate(new Date());
    const requestedDate = normalizeDate(request.requestedVacateDate);

    if (today < requestedDate) {
      return res.status(400).json({ msg: 'Vacate date has not been reached yet' });
    }

    const agreement = await Agreement.findOne({
      _id: request.agreement || undefined,
      property: request.property,
      tenant: request.tenant
    }) || await Agreement.findOne({
      property: request.property,
      tenant: request.tenant
    });

    if (!agreement) {
      return res.status(400).json({ msg: 'Agreement not found for this vacate request' });
    }

    agreement.status = 'closed';
    if (!agreement.endDate) {
      agreement.endDate = new Date();
    }
    await agreement.save();

    const property = await Property.findById(request.property);
    if (!property) {
      return res.status(404).json({ msg: 'Property not found' });
    }

    property.tenant = null;
    property.currentTenantId = null;
    property.currentAgreementId = null;
    property.occupancyStatus = 'vacant';
    await property.save();

    request.status = 'completed';
    await request.save();

    return res.json({ request, agreement, property });
  } catch (err) {
    console.error('completeVacateRequest error:', err);
    return res.status(500).json({ msg: 'Server Error' });
  }
};
