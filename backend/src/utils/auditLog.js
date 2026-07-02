const db = require('../db');

async function logAction(actorId, action, targetType = null, targetId = null, metadata = {}) {
  await db.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, targetType, targetId, metadata]
  );
}

module.exports = { logAction };
