const { getDb } = require('./database');

class SubscriptionCode {
  static create(code, planType, shopifyOrderId = null) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO subscription_codes (code, plan_type, shopify_order_id)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(code, planType, shopifyOrderId);
    return this.getById(result.lastInsertRowid);
  }

  static getById(id) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM subscription_codes WHERE id = ?');
    return stmt.get(id);
  }

  static getByCode(code) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM subscription_codes WHERE code = ?');
    return stmt.get(code);
  }

  static markAsUsed(code) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE subscription_codes 
      SET is_used = 1, used_at = CURRENT_TIMESTAMP 
      WHERE code = ?
    `);
    return stmt.run(code);
  }

  static validateCode(code) {
    const codeData = this.getByCode(code);
    
    if (!codeData) {
      return { valid: false, error: 'Code not found' };
    }
    
    if (codeData.is_used) {
      return { valid: false, error: 'Code already used' };
    }
    
    return { valid: true, planType: codeData.plan_type };
  }
}

module.exports = SubscriptionCode;
