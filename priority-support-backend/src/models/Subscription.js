const { getDb } = require('./database');

class Subscription {
  static create(userId, subscriptionCode, planType, shopifyOrderId = null) {
    const db = getDb();
    const now = new Date();
    const endDate = new Date(now);
    
    // Calculate end date based on plan type
    if (planType === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (planType === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const stmt = db.prepare(`
      INSERT INTO subscriptions (user_id, subscription_code, plan_type, status, start_date, end_date, shopify_order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      subscriptionCode,
      planType,
      'active',
      now.toISOString(),
      endDate.toISOString(),
      shopifyOrderId
    );

    return this.getById(result.lastInsertRowid);
  }

  static getById(id) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM subscriptions WHERE id = ?');
    return stmt.get(id);
  }

  static getByUserId(userId) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(userId);
  }

  static getByCode(subscriptionCode) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM subscriptions WHERE subscription_code = ?');
    return stmt.get(subscriptionCode);
  }

  static updateStatus(id, status) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE subscriptions 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(status, id);
  }

  static checkAndUpdateExpiredSubscriptions() {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE subscriptions 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP 
      WHERE end_date < ? AND status = 'active'
    `);
    return stmt.run(now);
  }

  static isActive(subscription) {
    if (!subscription) return false;
    if (subscription.status !== 'active') return false;
    
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    return endDate > now;
  }
}

module.exports = Subscription;
