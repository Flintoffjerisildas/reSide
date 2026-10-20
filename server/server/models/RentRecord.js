const mongoose = require('mongoose');

const rentRecordSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'Agreement', required: true },
    month: { type: Date, required: true }, // First day of the month
    dueDate: { type: Date, required: true },
    rentAmount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'partially_paid', 'paid', 'overdue'],
        default: 'pending'
    },
    totalPaid: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Ensure only one record per agreement per month
rentRecordSchema.index({ agreement: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('RentRecord', rentRecordSchema);
