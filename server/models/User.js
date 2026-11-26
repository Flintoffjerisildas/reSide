const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: false, unique: true, sparse: true, trim: true, lowercase: true },
  username: { type: String, trim: true, unique: true, sparse: true },
  password: { type: String, required: true }, // For MERN simple auth
  name: { type: String, required: true },
  tamilRole: {
    type: String,
    enum: ['owners', 'brokersBuilders', 'customers', 'admin'],
    default: 'customers'
  },
  registrationPurpose: {
    type: String,
    enum: ['Owner', 'Builder', 'Dealer', 'Customer'],
    default: 'Customer'
  },
  approved: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  securityPinHash: { type: String, select: false },
  role: { type: String, enum: ['user', 'tenant', 'landlord', 'admin', 'superadmin'], default: 'user' }, // System role
  phone: { type: String, trim: true, default: '' },
  isPhoneVerified: { type: Boolean, default: false },
  phoneOtpHash: { type: String, default: null },
  phoneOtpExpires: { type: Date, default: null },
  address: { type: String },
  aadhar: { type: String },
  gender: { type: String },
  age: { type: Number },
  dateOfBirth: { type: Date },
  familyMembers: { type: Number },
  religion: { type: String },
  occupation: { type: String },
  companyName: { type: String },
  monthlyIncome: { type: Number },
  maritalStatus: { type: String },
  idType: { type: String },
  idNumber: { type: String },
  idProofType: { type: String, default: 'Aadhaar Card' },
  idDocumentNumber: { type: String, trim: true, default: '' },
  isAadhaarVerified: { type: Boolean, default: false },
  aadhaarRefId: { type: String, default: null },
  aadhaarVerifiedName: { type: String, default: '' },
  idProofImage: { type: String },
  notificationsEnabled: { type: Boolean, default: true },
  profileCompletion: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailOtpHash: { type: String },
  emailOtpExpires: { type: Date },
  otp: { type: String },
  otpExpiry: { type: Date },
  otpPurpose: { type: String },
});

userSchema.pre('save', function () {
  // Sync idProofType with idType
  if (this.idProofType && !this.idType) {
    this.idType = this.idProofType;
  } else if (this.idType && !this.idProofType) {
    this.idProofType = this.idType;
  }

  // Sync idDocumentNumber with idNumber and aadhar
  if (this.idDocumentNumber) {
    if (!this.idNumber) this.idNumber = this.idDocumentNumber;
    if (!this.aadhar) this.aadhar = this.idDocumentNumber;
  } else if (this.idNumber || this.aadhar) {
    this.idDocumentNumber = this.idNumber || this.aadhar;
  }

  // Synchronize registrationPurpose and legacy tamilRole
  if (this.registrationPurpose) {
    if (this.registrationPurpose === 'Owner') this.tamilRole = 'owners';
    else if (this.registrationPurpose === 'Builder') this.tamilRole = 'brokersBuilders';
    else if (this.registrationPurpose === 'Dealer') this.tamilRole = 'brokersBuilders';
    else if (this.registrationPurpose === 'Customer') this.tamilRole = 'customers';
  } else if (this.tamilRole) {
    if (this.tamilRole === 'owners') this.registrationPurpose = 'Owner';
    else if (this.tamilRole === 'brokersBuilders') this.registrationPurpose = 'Builder';
    else if (this.tamilRole === 'customers') this.registrationPurpose = 'Customer';
  }

  // Preserve explicit superadmin/admin/landlord/tenant roles; only default when missing
  if (this.role === 'superadmin') {
    this.role = 'superadmin';
  } else if (this.tamilRole === 'admin') {
    this.role = 'admin';
  } else if (!this.role || !['user', 'tenant', 'landlord', 'admin', 'superadmin'].includes(this.role)) {
    this.role = 'user';
  }
});

module.exports = mongoose.model('User', userSchema);
