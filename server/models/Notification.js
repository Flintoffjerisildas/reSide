const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
      'ownership_transferred',
      'agreement_uploaded',
      'agreement_verified',
      'agreement_synced',
      'AGREEMENT_UPLOADED',
      'AGREEMENT_VERIFIED',
      'AGREEMENT_SYNCED',
      'friend_request',
      'friend_request_received',
      'friend_request_accepted',
      'system',
      'admin_governance',
      'platform_alert',
      'security_alert'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  propertyId: { type: String, index: true },
  propertyTitle: { type: String },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  transactionType: { type: String, enum: ['rent', 'buy'], default: 'rent' },
  actionUrl: { type: String },
  recipientRole: { type: String, index: true },
  forRole: { type: String, index: true },
  isGlobal: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
