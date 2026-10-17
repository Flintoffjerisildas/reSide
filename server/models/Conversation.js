const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

ConversationSchema.index({ property: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
