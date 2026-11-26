const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true },
  targetId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
