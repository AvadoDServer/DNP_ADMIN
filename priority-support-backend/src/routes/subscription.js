const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const SubscriptionCode = require('../models/SubscriptionCode');
const { auditLog } = require('../utils/audit');
const { authenticateUser } = require('../middleware/auth');

/**
 * GET /api/subscription/status/:userId
 * Get subscription status for a user
 */
router.get('/status/:userId', authenticateUser, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Check if there are any expired subscriptions and update them
    Subscription.checkAndUpdateExpiredSubscriptions();
    
    const subscription = Subscription.getByUserId(userId);
    
    if (!subscription) {
      return res.json({
        hasSubscription: false,
        message: 'No active subscription found'
      });
    }
    
    const isActive = Subscription.isActive(subscription);
    
    auditLog(userId, 'subscription_status_check', {
      status: subscription.status,
      isActive
    }, req.ip);
    
    res.json({
      hasSubscription: isActive,
      subscription: isActive ? {
        planType: subscription.plan_type,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date
      } : null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscription/validate
 * Validate a subscription code
 */
router.post('/validate', authenticateUser, async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Subscription code is required' });
    }
    
    const validation = SubscriptionCode.validateCode(code);
    
    // Mask code for audit log (only if code is long enough)
    const maskedCode = code.length >= 4 ? code.substring(0, 4) + '***' : '***';
    
    auditLog(req.user?.userId, 'code_validation', {
      code: maskedCode,
      valid: validation.valid
    }, req.ip);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        valid: false, 
        error: validation.error 
      });
    }
    
    res.json({
      valid: true,
      planType: validation.planType
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscription/activate
 * Activate a subscription using a code
 */
router.post('/activate', authenticateUser, async (req, res, next) => {
  try {
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({ 
        error: 'User ID and subscription code are required' 
      });
    }
    
    // Check if user already has an active subscription
    const existingSubscription = Subscription.getByUserId(userId);
    if (existingSubscription && Subscription.isActive(existingSubscription)) {
      return res.status(400).json({ 
        error: 'User already has an active subscription' 
      });
    }
    
    // Validate the code
    const validation = SubscriptionCode.validateCode(code);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error 
      });
    }
    
    // Create the subscription
    const subscription = Subscription.create(
      userId,
      code,
      validation.planType
    );
    
    // Mark code as used
    SubscriptionCode.markAsUsed(code);
    
    auditLog(userId, 'subscription_activated', {
      planType: validation.planType,
      subscriptionId: subscription.id
    }, req.ip);
    
    res.json({
      success: true,
      subscription: {
        planType: subscription.plan_type,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
