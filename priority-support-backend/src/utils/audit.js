const { getDb } = require('../models/database');

/**
 * Log audit events to the database
 */
function auditLog(userId, action, details, ipAddress = null) {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO audit_log (user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(
      userId || 'anonymous',
      action,
      JSON.stringify(details),
      ipAddress
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

module.exports = {
  auditLog
};
