const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema({
  canonicalPropertyId: { type: String, index: true },
  propertyId: { type: String, required: true, unique: true, sparse: true, index: true },
  rentalId: { type: String, index: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  rentAmount: { type: Number, default: 0 },
  status: {
    type: String,
    default: 'PENDING'
  },
  verificationStatus: { type: String, default: 'PENDING' },
  vacateDate: { type: Date },
  terms: { type: String, default: 'Standard rental agreement terms and conditions apply.' },
  fileName: { type: String },
  fileType: { type: String },
  fileSizeLabel: { type: String },
  fileDataUrl: { type: String },
  fileUrl: { type: String },
  tenantName: { type: String },
  ownerName: { type: String },
  propertyTitle: { type: String },
  propertyLocation: { type: String },
  uploadedAt: { type: String },
  reviewedAt: { type: String },
  ownerNote: { type: String, default: '' },
  ownerMessage: { type: String, default: '' },
  documents: [
    {
      name: { type: String, required: true },
      data: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Agreement', agreementSchema);
