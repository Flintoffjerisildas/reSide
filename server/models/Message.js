const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast chronological thread retrieval
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
