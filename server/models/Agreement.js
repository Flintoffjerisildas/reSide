const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  rentAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['active', 'notice_period', 'closed', 'terminated', 'expired', 'pending_tenant'],
    default: 'active'
  },
  vacateDate: { type: Date },
  terms: { type: String, default: 'Standard rental agreement terms and conditions apply.' },
  documents: [
    {
      name: { type: String, required: true },
      data: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Agreement', agreementSchema);
