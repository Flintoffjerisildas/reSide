const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'new_request',
      'request_accepted',
      'request_rejected',
      'counteroffer_received',
      'counteroffer_accepted',
      'terms_update',
      'terms_confirmed',
      'payment_submitted',
      'payment_verified',
      'payment_rejected',
      'transaction_completed',
      'request_cancelled',
      'ownership_transferred'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  transactionType: { type: String, enum: ['rent', 'buy'], default: 'rent' },
  actionUrl: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
