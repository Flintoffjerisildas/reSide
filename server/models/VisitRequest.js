const mongoose = require('mongoose');

const VisitRequestSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slot: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    notes: { type: String }
  },
  { timestamps: true }
);

VisitRequestSchema.index({ owner: 1, createdAt: -1 });
VisitRequestSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model('VisitRequest', VisitRequestSchema);
