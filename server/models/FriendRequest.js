const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema(
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
    propertyTitle: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on senderId and receiverId
friendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });
friendRequestSchema.index({ receiverId: 1, status: 1 });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
