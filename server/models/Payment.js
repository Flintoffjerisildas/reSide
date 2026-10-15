const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    rentRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'RentRecord', required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    mode: {
        type: String,
        enum: ['UPI', 'Bank Transfer', 'Cash', 'Cheque'],
        required: true
    },
    transactionId: { type: String },
    screenshot: { type: String }, // URL or base64
    status: {
        type: String,
        enum: ['submitted', 'approved', 'rejected'],
        default: 'submitted'
    },
    receiptNumber: { type: String },
    receiptPdfUrl: { type: String },
    date: { type: Date, default: Date.now },
    approvedDate: { type: Date },
    rejectionReason: { type: String } // Reason for rejection
});

module.exports = mongoose.model('Payment', paymentSchema);
