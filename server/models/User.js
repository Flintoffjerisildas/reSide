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
  approved: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false },
  role: { type: String, default: 'user' }, // internal role (admin/user)
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
  otpAttempts: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
