const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  data: { type: String, required: true }, // base64 or URL
  category: {
    type: String,
    enum: ['agreement', 'receipt', 'condition_report', 'other'],
    default: 'agreement'
  },
  uploadedAt: { type: Date, default: Date.now }
});

const manualPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true, default: Date.now },
  periodMonth: { type: Date, required: true }, // Normalized 1st day of month (e.g. 2026-10-01)
  periodLabel: { type: String }, // e.g. "October 2026"
  mode: {
    type: String,
    default: 'Bank Transfer'
  },
  paymentMethod: { type: String, default: 'Bank Transfer' },
  transactionReference: { type: String, default: '' },
  reference: { type: String, default: '' },
  receiptNumber: { type: String, default: '' },
  receiptDocument: { type: String, default: '' }, // base64 or URL
  notes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['tenant_recorded'],
    default: 'tenant_recorded'
  },
  isTenantRecorded: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const maintenanceItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: {
    type: String,
    default: 'Other'
  },
  dateReported: { type: Date, default: Date.now },
  cost: { type: Number, default: 0, min: 0 },
  amountSpent: { type: Number, default: 0, min: 0 },
  receipt: { type: String, default: '' },
  status: {
    type: String,
    enum: ['logged', 'reported', 'in_progress', 'resolved', 'completed'],
    default: 'reported'
  },
  createdAt: { type: Date, default: Date.now }
});

const selfManagedRentalSchema = new mongoose.Schema({
  // Tenant identity: MUST be strictly scoped to the authenticated tenant
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Property Information (Private to this tenant, NOT a public property listing)
  propertyTitle: { type: String, required: true, trim: true },
  propertyType: {
    type: String,
    default: 'Apartment',
    trim: true
  },
  address: { type: String, required: true, trim: true },
  city: { type: String, trim: true, default: '' },
  postalCode: { type: String, trim: true, default: '' },
  geoLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  image: { type: String, default: '' }, // base64 or URL
  description: { type: String, default: '' },

  // Rental Agreement Details
  monthlyRent: { type: Number, required: true, min: 1 },
  securityDeposit: { type: Number, default: 0, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null }, // Null represents month-to-month or ongoing tenancy
  rentDueDay: { type: Number, default: 5, min: 1, max: 31 },
  paymentFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  moveInDate: { type: Date, default: null },
  notes: { type: String, default: '' },

  // Landlord Contact (Optional, Tenant-entered tracking info ONLY. Not proof of identity or ownership)
  landlord: {
    name: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },
    connectedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    connectionStatus: {
      type: String,
      enum: ['unconnected', 'invited', 'pending_verification', 'connected'],
      default: 'unconnected'
    },
    invitedAt: { type: Date, default: null }
  },

  // Attached Documents (Private, secure tenant documents)
  documents: [documentSchema],

  // Payment Tracking Ledger (Manual, tenant-recorded external payments)
  payments: [manualPaymentSchema],

  // Personal Maintenance Logs & Expenses
  maintenance: [maintenanceItemSchema],

  // Personal Move-out & Vacate Planning
  vacate: {
    plannedDate: { type: Date, default: null },
    noticeDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    checklist: [
      {
        item: { type: String, required: true },
        completed: { type: Boolean, default: false }
      }
    ],
    documents: [documentSchema]
  },

  rentalMode: {
    type: String,
    enum: ['self_managed'],
    default: 'self_managed'
  },
  status: {
    type: String,
    enum: ['active', 'past'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Composite indexes for fast tenant queries
selfManagedRentalSchema.index({ tenant: 1, status: 1 });
selfManagedRentalSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model('SelfManagedRental', selfManagedRentalSchema);
