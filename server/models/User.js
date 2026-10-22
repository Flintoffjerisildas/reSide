const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
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
  role: { type: String, enum: ['admin', 'user'], default: 'user' }, // System role: 'admin' | 'user'
  phone: { type: String },
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
  idProofImage: { type: String },
  notificationsEnabled: { type: Boolean, default: true },
  profileCompletion: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: true },
  otp: { type: String },
  otpExpiry: { type: Date },
  otpPurpose: { type: String },
});

userSchema.pre('save', function () {
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

  // Ensure system role is strictly 'admin' or 'user'
  if (this.tamilRole === 'admin') {
    this.role = 'admin';
  } else if (!this.role || this.role !== 'admin') {
    this.role = 'user';
  }
});

module.exports = mongoose.model('User', userSchema);
