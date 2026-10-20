const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Helpful for filtering by owner
  issue: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['Plumbing', 'Electrical', 'Appliance', 'Structural', 'Cleaning', 'Other'],
    default: 'Other'
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Low'
  },
  summary: { type: String },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  cost: { type: Number, default: 0 },
  assignedTo: { type: String },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  updatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
