const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  propertyType: { type: String, required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  transactionType: { type: String, required: true },
  description: { type: String },
  amenities: [{ type: String }],
  totalArea: { type: Number },
  bedrooms: { type: Number },
  facing: {
    type: String,
    enum: [
      'North',
      'South',
      'East',
      'West',
      'North-East',
      'North-West',
      'South-East',
      'South-West'
    ]
  },
  securityDeposit: { type: Number },
  monthlyMaintenance: { type: Number },
  reraNumber: { type: String },
  ownershipType: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'Pending_Payment'],
    default: 'pending'
  },
  images: [{ type: String }], // Store URLs or base64
  geoLocatedImage: { type: String },
  geoLocation: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Track assigned tenant
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  prospectiveBuyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tenantName: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Track buyer if sold
  occupancyStatus: {
    type: String,
    enum: ['vacant', 'occupied', 'maintenance'],
    default: 'vacant'
  },
  saleStatus: {
    type: String,
    enum: ['available', 'under_contract', 'Pending_Payment', 'sold'],
    default: 'available'
  },
  soldDate: { type: Date },
  finalPrice: { type: Number },
  previousOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  previousOwners: [{
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transferredAt: { type: Date, default: Date.now },
    price: { type: Number }
  }],
  currentTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  currentAgreementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agreement', default: null },
  listingStatus: {
    type: String,
    enum: ['listed', 'unlisted', 'unavailable'],
    default: 'unlisted'
  },
  isListed: {
    type: Boolean,
    default: false
  },
  listedAt: { type: Date },
  unlistedAt: { type: Date },
  showPrice: { type: Boolean, default: true },
  showAddress: { type: Boolean, default: true },
  showAmenities: { type: Boolean, default: true },
  acceptOffers: { type: Boolean, default: true },
  customDetails: [{
    key: { type: String },
    value: { type: String }
  }]
});

module.exports = mongoose.model('Property', propertySchema);
