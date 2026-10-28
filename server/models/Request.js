const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'Agreement', default: null },
  status: {
    type: String,
    enum: [
      'pending',
      'counteroffer',
      'accepted',
      'approved',
      'terms_confirmed',
      'payment_pending',
      'completed',
      'rejected',
      'cancelled'
    ],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['rent', 'buy'], // Corresponds to transactionType of property
    required: true
  },
  message: { type: String }, // Optional message from buyer/tenant to owner
  offerAmount: { type: Number }, // Buyer initial purchase offer or agreed rent
  counterOfferAmount: { type: Number }, // Owner counteroffer amount
  counterOfferNote: { type: String }, // Owner counteroffer note
  agreedAmount: { type: Number }, // Mutually agreed purchase or rental amount
  terms: { type: String }, // Agreed transaction/closing terms
  termsConfirmedByBuyer: { type: Boolean, default: false },
  termsConfirmedByOwner: { type: Boolean, default: false },
  rejectionReason: { type: String },
  cancelledReason: { type: String },
  paymentDetails: {
    amount: { type: Number },
    mode: { type: String },
    transactionId: { type: String },
    screenshot: { type: String },
    receiptNumber: { type: String },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    status: {
      type: String,
      enum: ['unpaid', 'submitted', 'verified', 'rejected'],
      default: 'unpaid'
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', requestSchema);
