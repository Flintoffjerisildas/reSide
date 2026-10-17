const express = require('express');
const router = express.Router();
const RentRecord = require('../models/RentRecord');
const Payment = require('../models/Payment');
const Agreement = require('../models/Agreement');
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// 1. Generate Rent (Utility / Admin / Cron)
// For demo, we can call this endpoint to generate rent for current month
// 1. Generate Rent (Manual Trigger by Owner)
router.post('/generate', auth, async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // 1. Find active agreements for THIS owner
        const activeAgreements = await Agreement.find({ owner: req.user.id, status: 'active' });
        let createdCount = 0;
        let errors = 0;

        console.log(`[Manual Gen] Owner ${req.user.id} triggered generation. Found ${activeAgreements.length} active agreements.`);

        for (const agreement of activeAgreements) {
            try {
                // Determine start date for iteration
                let iteratorDate = agreement.startDate ? new Date(agreement.startDate) : (agreement.createdAt ? new Date(agreement.createdAt) : new Date(currentMonth));

                if (isNaN(iteratorDate.getTime())) {
                    console.warn(`[Manual Gen] Invalid Start Date for Agreement ${agreement._id}, skipping backfill.`);
                    iteratorDate = new Date(currentMonth);
                }

                // Normalize to 1st of month
                iteratorDate.setDate(1);
                iteratorDate.setHours(0, 0, 0, 0);

                // Iterate from start date until current month
                while (iteratorDate <= currentMonth) {
                    const loopMonth = new Date(iteratorDate);

                    const existing = await RentRecord.findOne({
                        agreement: agreement._id,
                        month: loopMonth
                    });

                    if (!existing) {
                        const dueDate = new Date(loopMonth);
                        dueDate.setDate(agreement.duesDay || 5);

                        // Check if overdue
                        let status = 'pending';
                        if (dueDate < new Date() && status === 'pending') {
                            status = 'overdue';
                        }

                        const newRecord = new RentRecord({
                            tenant: agreement.tenant,
                            owner: agreement.owner,
                            property: agreement.property,
                            agreement: agreement._id,
                            month: loopMonth,
                            dueDate: dueDate,
                            rentAmount: agreement.rentAmount,
                            balance: agreement.rentAmount,
                            status: status
                        });
                        await newRecord.save();
                        createdCount++;
                        console.log(`[Manual Gen] Created rent for Agreement ${agreement._id} Month: ${loopMonth.toISOString().substring(0, 7)}`);
                    }

                    // Move to next month
                    iteratorDate.setMonth(iteratorDate.getMonth() + 1);
                }
            } catch (innerErr) {
                console.error(`[Manual Gen] Error processing agreement ${agreement._id}:`, innerErr);
                errors++;
            }
        }

        res.json({ msg: `Generation complete. Created ${createdCount} new rent record(s).` + (errors > 0 ? ` (${errors} errors)` : '') });
    } catch (err) {
        console.error('Server Error in /generate:', err);
        res.status(500).send('Server Error');
    }
});

// 2. Tenant: Submit Payment
router.post('/submit', auth, async (req, res) => {
    try {
        const { rentRecordId, amount, mode, transactionId, screenshot } = req.body;
        // Screenshot is expected to be a Base64 string or URL


        const rentRecord = await RentRecord.findById(rentRecordId);
        if (!rentRecord) return res.status(404).json({ msg: 'Rent record not found' });

        if (rentRecord.tenant.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const newPayment = new Payment({
            rentRecord: rentRecordId,
            tenant: req.user.id,
            owner: rentRecord.owner,
            amount,
            mode,
            transactionId,
            screenshot,
            status: 'submitted'
        });

        await newPayment.save();

        // Update rent record status? Maybe just keep it pending until approved?
        // Requirement says: Status should automatically change to "Payment Submitted – Waiting for Owner Approval"
        // We don't have a specific status for that on RentRecord, but we can query pending payments.
        // Or we can add a 'submitted' status to RentRecord? 
        // Let's keep RentRecord as 'pending' (or maybe 'processing'?) until approved.
        // Or just rely on the Payment status.

        res.json(newPayment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 3. Owner: Approve Payment
router.put('/:id/approve', auth, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ msg: 'Payment not found' });

        if (payment.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        if (payment.status === 'approved') {
            return res.status(400).json({ msg: 'Payment already approved' });
        }

        payment.status = 'approved';
        payment.approvedDate = new Date();

        // Generate Receipt Number
        const count = await Payment.countDocuments({ status: 'approved' }) + 1;
        const date = new Date();
        const receiptNum = `RES-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${count.toString().padStart(5, '0')}`;
        payment.receiptNumber = receiptNum;

        await payment.save();

        // Update Rent Record
        const rentRecord = await RentRecord.findById(payment.rentRecord);
        rentRecord.totalPaid += payment.amount;
        rentRecord.balance = rentRecord.rentAmount - rentRecord.totalPaid;

        if (rentRecord.balance <= 0) {
            rentRecord.status = 'paid';
            rentRecord.balance = 0; // Prevent negative
        } else {
            rentRecord.status = 'partially_paid';
        }

        await rentRecord.save();

        res.json({ payment, rentRecord });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 4. Owner: Reject Payment
router.put('/:id/reject', auth, async (req, res) => {
    try {
        const { reason } = req.body;
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ msg: 'Payment not found' });

        if (payment.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        payment.status = 'rejected';
        payment.rejectionReason = reason || 'No reason provided';
        await payment.save();

        // Also update rent record status back to pending or overdue?
        // If rejected, rent is still pending.
        // Or keep it 'pending' and maybe notify tenant.
        // We don't change RentRecord status here as it's separate, but tenant dashboard should reflect rejection.

        res.json(payment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 5. Get Rent Records (Tenant) - With Lazy Generation
router.get('/tenant/records', auth, async (req, res) => {
    try {
        // --- Lazy Rent Generation Start ---
        const today = new Date();
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Find active agreements for this tenant
        const activeAgreements = await Agreement.find({ tenant: req.user.id, status: 'active' });
        console.log(`[DEBUG] Found ${activeAgreements.length} active agreements for user ${req.user.id}`);

        for (const agreement of activeAgreements) {
            console.log(`[DEBUG] Processing Agreement ${agreement._id}, StartDate: ${agreement.startDate}`);

            // Start from agreement start date, fallback to createdAt, or fallback to current month
            let iteratorDate = agreement.startDate ? new Date(agreement.startDate) : (agreement.createdAt ? new Date(agreement.createdAt) : new Date(currentMonth));

            if (isNaN(iteratorDate.getTime())) {
                console.log(`[DEBUG] Invalid Start Date for ${agreement._id}, defaulting to current month`);
                iteratorDate = new Date(currentMonth);
            }

            // Normalise to 1st of month
            iteratorDate.setDate(1);
            iteratorDate.setHours(0, 0, 0, 0);

            // If start date is in future, don't generate rent yet? 
            // Agreement status 'active' implies it started.

            // Loop until iterator > currentMonth
            while (iteratorDate <= currentMonth) {
                const loopMonth = new Date(iteratorDate);

                const existing = await RentRecord.findOne({
                    agreement: agreement._id,
                    month: loopMonth
                });

                if (!existing) {
                    const dueDate = new Date(loopMonth);
                    dueDate.setDate(agreement.duesDay || 5);

                    // Check if overdue
                    let status = 'pending';
                    if (dueDate < new Date() && status === 'pending') {
                        status = 'overdue';
                    }

                    const newRecord = new RentRecord({
                        tenant: agreement.tenant,
                        owner: agreement.owner,
                        property: agreement.property,
                        agreement: agreement._id,
                        month: loopMonth,
                        dueDate: dueDate,
                        rentAmount: agreement.rentAmount,
                        balance: agreement.rentAmount,
                        status: status
                    });
                    await newRecord.save();
                    console.log(`Auto-generated rent for Agreement ${agreement._id} - ${loopMonth.toISOString()}`);
                } else {
                    // console.log(`[DEBUG] Record already exists for ${loopMonth.toISOString()}`);
                }

                // Move to next month
                iteratorDate.setMonth(iteratorDate.getMonth() + 1);
            }
        }
        // --- Lazy Rent Generation End ---

        const records = await RentRecord.find({ tenant: req.user.id })
            .populate('property', 'title location')
            .populate('owner', 'name phone')
            .populate('tenant', 'name email')
            .sort({ month: -1 });

        // For each record, find payments?
        // Could attach payments.
        const recordsWithPayments = await Promise.all(records.map(async (record) => {
            const payments = await Payment.find({ rentRecord: record._id });
            return { ...record.toObject(), payments };
        }));

        res.json(recordsWithPayments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 9. Get Rent History (Owner) - For Graph
router.get('/owner/rent-history', auth, async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const records = await RentRecord.find({
            owner: req.user.id,
            month: { $gte: sixMonthsAgo }
        }).sort({ month: 1 });

        // Aggregate by month
        const history = {};
        records.forEach(r => {
            const dateObj = new Date(r.month);
            const m = dateObj.toLocaleString('default', { month: 'short' });
            // We use a sort key like "2024-02" to sort correctly, but display "Feb"
            const sortKey = dateObj.toISOString().slice(0, 7); 
            
            if (!history[sortKey]) {
                history[sortKey] = { name: m, fullDate: r.month, amount: 0, expected: 0 };
            }
            history[sortKey].amount += (r.totalPaid || 0);
            history[sortKey].expected += (r.rentAmount || 0);
        });

        const result = Object.values(history).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));

        // Also get last 3 approved payments
        const lastPayments = await Payment.find({
            owner: req.user.id,
            status: 'approved'
        })
            .sort({ date: -1 })
            .limit(3)
            .populate('tenant', 'name')
            .populate({
                path: 'rentRecord',
                populate: { path: 'property', select: 'title' }
            });

        res.json({ graph: result, lastPayments });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 10. Get Rent History (Tenant) - For Graph
router.get('/tenant/rent-history', auth, async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const records = await RentRecord.find({
            tenant: req.user.id,
            month: { $gte: sixMonthsAgo }
        }).sort({ month: 1 });

        const history = {};
        records.forEach(r => {
            const dateObj = new Date(r.month);
            const m = dateObj.toLocaleString('default', { month: 'short' });
            const sortKey = dateObj.toISOString().slice(0, 7);

            if (!history[sortKey]) {
                history[sortKey] = { name: m, fullDate: r.month, amount: 0, due: 0 };
            }
            history[sortKey].amount += (r.totalPaid || 0);
            history[sortKey].due += (r.rentAmount || 0);
        });

        const result = Object.values(history).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));

        const lastPayments = await Payment.find({
            tenant: req.user.id,
            status: { $in: ['approved', 'submitted'] }
        })
            .sort({ date: -1 })
            .limit(3)
            .populate('owner', 'name')
            .populate({
                path: 'rentRecord',
                populate: { path: 'property', select: 'title' }
            });

        res.json({ graph: result, lastPayments });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 6. Get Payment Requests (Owner)
router.get('/owner/requests', auth, async (req, res) => {
    try {
        // specific payments that are submitted
        const payments = await Payment.find({ owner: req.user.id, status: 'submitted' })
            .populate('tenant', 'name email')
            // cannot deeply populate property from rentRecord easily in one go without aggregate
            // but we can populate rentRecord
            .populate({
                path: 'rentRecord',
                populate: { path: 'property', select: 'title location' }
            })
            .sort({ date: -1 });

        res.json(payments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 7. Dashboard Summary (Owner)
router.get('/owner/summary', auth, async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // --- Lazy Generation for Owner Start ---
        // Ensure rent records exist for all active agreements owned by this user
        const activeAgreements = await Agreement.find({ owner: req.user.id, status: 'active' });
        console.log(`[DEBUG] Owner Summary: Found ${activeAgreements.length} active agreements for owner ${req.user.id}`);

        for (const agreement of activeAgreements) {
            let iteratorDate = agreement.startDate ? new Date(agreement.startDate) : (agreement.createdAt ? new Date(agreement.createdAt) : new Date(today));
            if (isNaN(iteratorDate.getTime())) iteratorDate = new Date(today);

            iteratorDate.setDate(1);
            iteratorDate.setHours(0, 0, 0, 0);

            while (iteratorDate <= currentMonth) {
                const loopMonth = new Date(iteratorDate);
                const existing = await RentRecord.findOne({
                    agreement: agreement._id,
                    month: loopMonth
                });

                if (!existing) {
                    const dueDate = new Date(loopMonth);
                    dueDate.setDate(agreement.duesDay || 5);

                    // Check if overdue
                    let status = 'pending';
                    if (dueDate < new Date() && status === 'pending') {
                        status = 'overdue';
                    }

                    const newRecord = new RentRecord({
                        tenant: agreement.tenant,
                        owner: agreement.owner,
                        property: agreement.property,
                        agreement: agreement._id,
                        month: loopMonth,
                        dueDate: dueDate,
                        rentAmount: agreement.rentAmount,
                        balance: agreement.rentAmount,
                        status: status
                    });
                    await newRecord.save();
                    console.log(`[DEBUG] Auto-generated rent (Owner View) for Agreement ${agreement._id} - ${loopMonth.toISOString()}`);
                }
                iteratorDate.setMonth(iteratorDate.getMonth() + 1);
            }
        }
        // --- Lazy Generation End ---

        // Only consider currently occupied properties for expected and pending
        const occupiedProps = await Property.find({
            owner: req.user.id,
            tenant: { $ne: null }
        }).select('_id');
        const occupiedIds = occupiedProps.map(p => p._id);

        let records = [];

        if (occupiedIds.length === 0) {
            records = [];
        } else {
            records = await RentRecord.find({
                owner: req.user.id,
                month: currentMonth,
                property: { $in: occupiedIds }
            }).populate('property', 'title location');
        }

        let expected = 0;
        let collected = 0;
        let pending = 0;
        let overdue = 0;

        const breakdown = [];

        records.forEach(r => {
            expected += r.rentAmount;
            collected += r.totalPaid;
            pending += r.balance;
            if (r.status === 'overdue') overdue++;
            breakdown.push({
                propertyId: r.property && r.property._id ? r.property._id : r.property,
                propertyTitle: r.property && r.property.title ? r.property.title : '',
                propertyLocation: r.property && r.property.location ? r.property.location : '',
                rentAmount: r.rentAmount,
                totalPaid: r.totalPaid,
                balance: r.balance,
                status: r.status
            });
        });

        // Also count total overdue regardless of month
        const allOverdue = await RentRecord.countDocuments({ owner: req.user.id, status: 'overdue' });

        res.json({ expected, collected, pending, overdue: allOverdue, currentMonth, breakdown });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 8. Get Rent Records by Property ID (Owner View) with lazy generation
router.get('/property/:propertyId/records', auth, async (req, res) => {
    try {
        const today = new Date();
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const agreements = await Agreement.find({
            owner: req.user.id,
            property: req.params.propertyId,
            status: 'active'
        });

        for (const agreement of agreements) {
            let iteratorDate = agreement.startDate ? new Date(agreement.startDate) : (agreement.createdAt ? new Date(agreement.createdAt) : new Date(currentMonth));
            if (isNaN(iteratorDate.getTime())) {
                iteratorDate = new Date(currentMonth);
            }

            iteratorDate.setDate(1);
            iteratorDate.setHours(0, 0, 0, 0);

            while (iteratorDate <= currentMonth) {
                const loopMonth = new Date(iteratorDate);

                const existing = await RentRecord.findOne({
                    agreement: agreement._id,
                    month: loopMonth
                });

                if (!existing) {
                    const dueDate = new Date(loopMonth);
                    dueDate.setDate(agreement.duesDay || 5);

                    let status = 'pending';
                    if (dueDate < new Date() && status === 'pending') {
                        status = 'overdue';
                    }

                    const newRecord = new RentRecord({
                        tenant: agreement.tenant,
                        owner: agreement.owner,
                        property: agreement.property,
                        agreement: agreement._id,
                        month: loopMonth,
                        dueDate: dueDate,
                        rentAmount: agreement.rentAmount,
                        balance: agreement.rentAmount,
                        status: status
                    });
                    await newRecord.save();
                }

                iteratorDate.setMonth(iteratorDate.getMonth() + 1);
            }
        }

        const records = await RentRecord.find({
            owner: req.user.id,
            property: req.params.propertyId
        })
            .populate('tenant', 'name email')
            .sort({ month: -1 });

        const recordsWithPayments = await Promise.all(
            records.map(async (record) => {
                const payments = await Payment.find({ rentRecord: record._id }).sort({ date: -1 });
                return { ...record.toObject(), payments };
            })
        );

        res.json(recordsWithPayments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/admin/payments', auth, auth.requireAdmin, async (req, res) => {
    try {
        const status = req.query?.status;
        const filter = {};
        if (status) filter.status = String(status);

        const payments = await Payment.find(filter)
            .populate('tenant', 'name email phone')
            .populate('owner', 'name email phone')
            .populate({
                path: 'rentRecord',
                populate: { path: 'property', select: 'title location' }
            })
            .sort({ date: -1 });

        res.json(payments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/admin/overdue', auth, auth.requireAdmin, async (req, res) => {
    try {
        const records = await RentRecord.find({ status: 'overdue' })
            .populate('tenant', 'name email phone')
            .populate('owner', 'name email phone')
            .populate('property', 'title location')
            .sort({ dueDate: -1 });

        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
