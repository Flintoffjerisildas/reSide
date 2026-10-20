const mongoose = require('mongoose');

const vacateRequestSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  requestedVacateDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'Agreement' }
}, { timestamps: true });

module.exports = mongoose.model('VacateRequest', vacateRequestSchema);

