const express = require('express');
const router = express.Router();
const SelfManagedRental = require('../models/SelfManagedRental');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * Normalizes a date to the first day of that month (UTC or local midnight)
 */
function normalizeToFirstOfMonth(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Formats a month date into a human readable label e.g. "October 2026"
 */
function formatMonthLabel(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// 1. Create a new self-managed rental
router.post('/', auth, async (req, res) => {
  try {
    const {
      propertyTitle,
      propertyType,
      address,
      city,
      postalCode,
      geoLocation,
      image,
      description,
      monthlyRent,
      securityDeposit,
      startDate,
      endDate,
      rentDueDay,
      paymentFrequency,
      moveInDate,
      notes,
      landlord,
      documents
    } = req.body;

    // Server-side validation
    if (!propertyTitle || !propertyTitle.trim()) {
      return res.status(400).json({ msg: 'Rental or property display name is required' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ msg: 'Full address is required' });
    }

    const rentNum = Number(monthlyRent);
    if (isNaN(rentNum) || rentNum <= 0) {
      return res.status(400).json({ msg: 'Monthly rent must be a valid positive amount' });
    }

    if (!startDate) {
      return res.status(400).json({ msg: 'Lease or rental start date is required' });
    }
    const parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({ msg: 'Invalid rental start date' });
    }

    let parsedEndDate = null;
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ msg: 'Invalid rental end date' });
      }
      if (parsedEndDate < parsedStartDate) {
        return res.status(400).json({ msg: 'Lease end date cannot precede the start date' });
      }
    }

    let parsedDueDay = Number(rentDueDay);
    if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      parsedDueDay = 5;
    }

    const newRental = new SelfManagedRental({
      tenant: req.user.id,
      propertyTitle: propertyTitle.trim(),
      propertyType: propertyType || 'Apartment',
      address: address.trim(),
      city: city ? city.trim() : '',
      postalCode: postalCode ? postalCode.trim() : '',
      geoLocation: geoLocation || { latitude: null, longitude: null },
      image: image || '',
      description: description ? description.trim() : '',
      monthlyRent: rentNum,
      securityDeposit: Number(securityDeposit) >= 0 ? Number(securityDeposit) : 0,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      rentDueDay: parsedDueDay,
      paymentFrequency: paymentFrequency || 'monthly',
      moveInDate: moveInDate ? new Date(moveInDate) : null,
      notes: notes ? notes.trim() : '',
      landlord: {
        name: landlord?.name ? landlord.name.trim() : '',
        phone: landlord?.phone ? landlord.phone.trim() : '',
        email: landlord?.email ? landlord.email.trim().toLowerCase() : '',
        notes: landlord?.notes ? landlord.notes.trim() : '',
        connectionStatus: 'unconnected'
      },
      documents: Array.isArray(documents) ? documents : []
    });

    await newRental.save();
    return res.status(201).json(newRental);
  } catch (err) {
    console.error('Error creating self-managed rental:', err);
    return res.status(500).json({ msg: 'Failed to create self-managed rental' });
  }
});

// 2. Get all self-managed rentals for the authenticated tenant
router.get('/', auth, async (req, res) => {
  try {
    const rentals = await SelfManagedRental.find({ tenant: req.user.id })
      .sort({ createdAt: -1 });
    return res.json(rentals);
  } catch (err) {
    console.error('Error fetching self-managed rentals:', err);
    return res.status(500).json({ msg: 'Failed to fetch self-managed rentals' });
  }
});

// 3. Get a single self-managed rental by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    // Scoped strictly to the authenticated tenant
    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to access this rental record' });
    }

    return res.json(rental);
  } catch (err) {
    console.error('Error fetching self-managed rental by id:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

// 4. Update an existing self-managed rental
router.put('/:id', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to update this rental record' });
    }

    const {
      propertyTitle,
      propertyType,
      address,
      city,
      postalCode,
      geoLocation,
      image,
      description,
      monthlyRent,
      securityDeposit,
      startDate,
      endDate,
      rentDueDay,
      paymentFrequency,
      moveInDate,
      notes,
      landlord,
      status
    } = req.body;

    if (propertyTitle !== undefined) rental.propertyTitle = propertyTitle.trim();
    if (propertyType !== undefined) rental.propertyType = propertyType;
    if (address !== undefined) rental.address = address.trim();
    if (city !== undefined) rental.city = city.trim();
    if (postalCode !== undefined) rental.postalCode = postalCode.trim();
    if (geoLocation !== undefined) rental.geoLocation = geoLocation;
    if (image !== undefined) rental.image = image;
    if (description !== undefined) rental.description = description;

    if (monthlyRent !== undefined) {
      const num = Number(monthlyRent);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ msg: 'Monthly rent must be a positive number' });
      }
      rental.monthlyRent = num;
    }

    if (securityDeposit !== undefined) {
      const num = Number(securityDeposit);
      if (!isNaN(num) && num >= 0) rental.securityDeposit = num;
    }

    if (startDate !== undefined) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) return res.status(400).json({ msg: 'Invalid start date' });
      rental.startDate = d;
    }

    if (endDate !== undefined) {
      if (endDate) {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) return res.status(400).json({ msg: 'Invalid end date' });
        if (d < rental.startDate) {
          return res.status(400).json({ msg: 'End date cannot precede start date' });
        }
        rental.endDate = d;
      } else {
        rental.endDate = null;
      }
    }

    if (rentDueDay !== undefined) {
      const num = Number(rentDueDay);
      if (!isNaN(num) && num >= 1 && num <= 31) rental.rentDueDay = num;
    }

    if (paymentFrequency !== undefined) rental.paymentFrequency = paymentFrequency;
    if (moveInDate !== undefined) rental.moveInDate = moveInDate ? new Date(moveInDate) : null;
    if (notes !== undefined) rental.notes = notes;

    if (landlord && typeof landlord === 'object') {
      if (landlord.name !== undefined) rental.landlord.name = landlord.name.trim();
      if (landlord.phone !== undefined) rental.landlord.phone = landlord.phone.trim();
      if (landlord.email !== undefined) rental.landlord.email = landlord.email.trim().toLowerCase();
      if (landlord.notes !== undefined) rental.landlord.notes = landlord.notes.trim();
    }

    if (status !== undefined) rental.status = status;

    await rental.save();
    return res.json(rental);
  } catch (err) {
    console.error('Error updating self-managed rental:', err);
    return res.status(500).json({ msg: 'Failed to update self-managed rental' });
  }
});

// 5. Delete a self-managed rental
router.delete('/:id', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to delete this rental record' });
    }

    await SelfManagedRental.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Self-managed rental deleted successfully' });
  } catch (err) {
    console.error('Error deleting self-managed rental:', err);
    return res.status(500).json({ msg: 'Failed to delete self-managed rental' });
  }
});

// 6. Record an external manual rent payment
router.post('/:id/payments', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to record payments for this rental' });
    }

    const {
      amount,
      paymentDate,
      periodMonth,
      mode,
      paymentMethod,
      transactionReference,
      reference,
      receiptNumber,
      receiptDocument,
      notes
    } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ msg: 'Payment amount must be a positive number' });
    }

    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(parsedPaymentDate.getTime())) {
      return res.status(400).json({ msg: 'Invalid payment date' });
    }

    const normalizedPeriodMonth = normalizeToFirstOfMonth(periodMonth || parsedPaymentDate);
    const label = formatMonthLabel(normalizedPeriodMonth);

    const refString = (transactionReference || reference || '').trim();
    const effectiveMode = (mode || paymentMethod || 'Bank Transfer').trim();

    // Prevent accidental duplicate submission for the exact same transaction reference if provided
    if (refString) {
      const duplicate = rental.payments.find((p) => {
        const pRef = (p.transactionReference || p.reference || '').trim().toLowerCase();
        return pRef && pRef === refString.toLowerCase();
      });
      if (duplicate) {
        return res.status(409).json({ msg: `A payment with transaction reference "${refString}" already exists.` });
      }
    }

    const newPayment = {
      amount: parsedAmount,
      paymentDate: parsedPaymentDate,
      periodMonth: normalizedPeriodMonth,
      periodLabel: label,
      mode: effectiveMode,
      paymentMethod: effectiveMode,
      transactionReference: refString,
      reference: refString,
      receiptNumber: receiptNumber ? receiptNumber.trim() : '',
      receiptDocument: receiptDocument || '',
      notes: notes ? notes.trim() : '',
      status: 'tenant_recorded',
      isTenantRecorded: true,
      recordedBy: req.user.id,
      createdAt: new Date()
    };

    rental.payments.unshift(newPayment);
    await rental.save();

    return res.status(201).json({
      msg: 'Payment recorded successfully',
      payment: rental.payments[0],
      payments: rental.payments
    });
  } catch (err) {
    console.error('Error recording rent payment:', err);
    return res.status(500).json({ msg: 'Failed to record payment' });
  }
});

// 7. Delete / Correct a tenant-recorded rent payment
router.delete('/:id/payments/:paymentId', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const initialLen = rental.payments.length;
    rental.payments = rental.payments.filter((p) => p._id.toString() !== req.params.paymentId);

    if (rental.payments.length === initialLen) {
      return res.status(404).json({ msg: 'Payment entry not found' });
    }

    await rental.save();
    return res.json({ msg: 'Payment record removed', payments: rental.payments });
  } catch (err) {
    console.error('Error deleting payment entry:', err);
    return res.status(500).json({ msg: 'Failed to delete payment entry' });
  }
});

// 8. Attach a rental document (agreement, receipt, condition report)
router.post('/:id/documents', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { name, data, category } = req.body;
    if (!name || !data) {
      return res.status(400).json({ msg: 'Document name and data are required' });
    }

    const doc = {
      name: name.trim(),
      data,
      category: category || 'agreement',
      uploadedAt: new Date()
    };

    rental.documents.push(doc);
    await rental.save();

    return res.status(201).json({
      msg: 'Document attached successfully',
      document: rental.documents[rental.documents.length - 1],
      documents: rental.documents
    });
  } catch (err) {
    console.error('Error attaching document:', err);
    return res.status(500).json({ msg: 'Failed to attach document' });
  }
});

// 9. Remove an attached document
router.delete('/:id/documents/:docId', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    rental.documents = rental.documents.filter((d) => d._id.toString() !== req.params.docId);
    await rental.save();

    return res.json({ msg: 'Document removed', documents: rental.documents });
  } catch (err) {
    console.error('Error removing document:', err);
    return res.status(500).json({ msg: 'Failed to remove document' });
  }
});

// 10. Record a personal maintenance issue or expense
router.post('/:id/maintenance', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { title, description, category, dateReported, cost, amountSpent, receipt, status } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ msg: 'Maintenance title/issue is required' });
    }

    const spent = Number(amountSpent !== undefined ? amountSpent : cost) >= 0 ? Number(amountSpent !== undefined ? amountSpent : cost) : 0;
    const item = {
      title: title.trim(),
      description: description ? description.trim() : '',
      category: category || 'Other',
      dateReported: dateReported ? new Date(dateReported) : new Date(),
      cost: spent,
      amountSpent: spent,
      receipt: receipt || '',
      status: status || 'reported',
      createdAt: new Date()
    };

    rental.maintenance.unshift(item);
    await rental.save();

    return res.status(201).json({
      msg: 'Maintenance entry logged successfully',
      maintenance: rental.maintenance[0],
      allMaintenance: rental.maintenance
    });
  } catch (err) {
    console.error('Error recording maintenance entry:', err);
    return res.status(500).json({ msg: 'Failed to record maintenance entry' });
  }
});

// 11. Update status or details of a maintenance entry
router.put('/:id/maintenance/:maintenanceId', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const item = rental.maintenance.find((m) => m._id.toString() === req.params.maintenanceId);
    if (!item) {
      return res.status(404).json({ msg: 'Maintenance entry not found' });
    }

    const { title, description, category, cost, status } = req.body;
    if (title !== undefined) item.title = title.trim();
    if (description !== undefined) item.description = description.trim();
    if (category !== undefined) item.category = category;
    if (cost !== undefined) item.cost = Number(cost) >= 0 ? Number(cost) : 0;
    if (status !== undefined) item.status = status;

    await rental.save();
    return res.json({ msg: 'Maintenance entry updated', maintenance: item, allMaintenance: rental.maintenance });
  } catch (err) {
    console.error('Error updating maintenance entry:', err);
    return res.status(500).json({ msg: 'Failed to update maintenance entry' });
  }
});

// 12. Delete a maintenance entry
router.delete('/:id/maintenance/:maintenanceId', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    rental.maintenance = rental.maintenance.filter((m) => m._id.toString() !== req.params.maintenanceId);
    await rental.save();

    return res.json({ msg: 'Maintenance entry removed', allMaintenance: rental.maintenance });
  } catch (err) {
    console.error('Error deleting maintenance entry:', err);
    return res.status(500).json({ msg: 'Failed to delete maintenance entry' });
  }
});

// 13. Update personal move-out / vacate plan
router.put('/:id/vacate', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { plannedDate, noticeDate, notes, checklist } = req.body;

    if (!rental.vacate) {
      rental.vacate = { checklist: [], documents: [] };
    }

    if (plannedDate !== undefined) {
      rental.vacate.plannedDate = plannedDate ? new Date(plannedDate) : null;
    }
    if (noticeDate !== undefined) {
      rental.vacate.noticeDate = noticeDate ? new Date(noticeDate) : null;
    }
    if (notes !== undefined) {
      rental.vacate.notes = notes;
    }
    if (Array.isArray(checklist)) {
      rental.vacate.checklist = checklist;
    }

    await rental.save();
    return res.json({ msg: 'Vacate plan updated successfully', vacate: rental.vacate });
  } catch (err) {
    console.error('Error updating vacate plan:', err);
    return res.status(500).json({ msg: 'Failed to update vacate plan' });
  }
});

// 14. Optional Landlord Connection invitation / check
router.post('/:id/connect-landlord', auth, async (req, res) => {
  try {
    const rental = await SelfManagedRental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ msg: 'Self-managed rental not found' });
    }

    if (rental.tenant.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const { email, phone, name } = req.body;
    const lookupEmail = (email || rental.landlord?.email || '').trim().toLowerCase();

    if (!lookupEmail) {
      return res.status(400).json({ msg: 'Landlord email is required to send an invitation or connect.' });
    }

    // Check if landlord exists on reSide
    const potentialLandlord = await User.findOne({ email: lookupEmail }).select('_id name email phone role');

    if (name) rental.landlord.name = name.trim();
    if (phone) rental.landlord.phone = phone.trim();
    rental.landlord.email = lookupEmail;
    rental.landlord.invitedAt = new Date();

    if (potentialLandlord) {
      rental.landlord.connectedUser = potentialLandlord._id;
      rental.landlord.connectionStatus = 'pending_verification';
      await rental.save();
      return res.json({
        msg: `A reSide account was found for ${lookupEmail}. Connection request is pending landlord identity and property verification.`,
        connectionStatus: 'pending_verification',
        landlord: rental.landlord
      });
    } else {
      rental.landlord.connectionStatus = 'invited';
      await rental.save();
      return res.json({
        msg: `Invitation sent to ${lookupEmail}. When your landlord registers on reSide and verifies property ownership, you can link this rental.`,
        connectionStatus: 'invited',
        landlord: rental.landlord
      });
    }
  } catch (err) {
    console.error('Error connecting landlord:', err);
    return res.status(500).json({ msg: 'Failed to initiate landlord connection' });
  }
});

module.exports = router;
