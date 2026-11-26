const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

async function logAudit({ req, actor, action, targetType, targetId = '', details = {} }) {
  try {
    let actorId = actor?._id || actor?.id || req?.user?.id || req?.user?._id;
    let actorName = actor?.name || actor?.username || actor?.email || req?.user?.name;
    let actorRole = actor?.role || req?.user?.role || 'unknown';

    if (actorId && !actorName) {
      const dbActor = await User.findById(actorId).select('name username email role').lean();
      if (dbActor) {
        actorName = dbActor.name || dbActor.username || dbActor.email || 'Unknown';
        actorRole = dbActor.role || actorRole;
      }
    }

    if (!actorId) return null;

    return await AuditLog.create({
      actor: actorId,
      actorName: String(actorName || 'System'),
      actorRole: String(actorRole),
      action: String(action),
      targetType: String(targetType),
      targetId: targetId ? String(targetId) : '',
      details,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit entry:', err?.message || err);
    return null;
  }
}

module.exports = { logAudit };
