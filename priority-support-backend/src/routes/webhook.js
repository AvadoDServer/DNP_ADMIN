const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const SubscriptionCode = require('../models/SubscriptionCode');
const { auditLog } = require('../utils/audit');

/**
 * POST /api/webhook/shopify
 * Handle Shopify webhook for new orders
 * 
 * This endpoint should be configured in Shopify to receive order creation webhooks
 * Shopify documentation: https://shopify.dev/docs/apps/webhooks
 */
router.post('/shopify', async (req, res, next) => {
  try {
    // Verify Shopify webhook signature
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (shopifySecret && hmac) {
      const hash = crypto
        .createHmac('sha256', shopifySecret)
        .update(JSON.stringify(req.body))
        .digest('base64');
      
      if (hash !== hmac) {
        console.error('Invalid Shopify webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const order = req.body;
    
    // Extract relevant information from the order
    const { id: orderId, line_items, customer } = order;
    
    // Process each line item to check for priority support subscriptions
    for (const item of line_items) {
      const productName = item.name.toLowerCase();
      let planType = null;
      
      // Determine plan type based on product name or SKU
      if (productName.includes('priority') && productName.includes('support')) {
        if (productName.includes('year') || productName.includes('annual')) {
          planType = 'yearly';
        } else if (productName.includes('month')) {
          planType = 'monthly';
        }
      }
      
      // If this is a priority support product, generate a code
      if (planType) {
        // Generate a unique subscription code
        const code = generateSubscriptionCode();
        
        // Store the code in the database
        SubscriptionCode.create(code, planType, orderId.toString());
        
        // Mask code for audit log (only if code is long enough)
        const maskedCode = code.length >= 4 ? code.substring(0, 4) + '***' : '***';
        
        auditLog(customer?.email || 'unknown', 'code_generated_from_shopify', {
          orderId,
          planType,
          code: maskedCode
        }, req.ip);
        
        // TODO: Send the code to the customer via email
        // This would integrate with your email service (SendGrid, Mailgun, etc.)
        console.log(`Generated subscription code: ${code} for order ${orderId}`);
        console.log(`Customer email: ${customer?.email}`);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    next(error);
  }
});

/**
 * Generate a unique subscription code
 * Format: XXXX-XXXX-XXXX-XXXX (16 characters)
 */
function generateSubscriptionCode(attempt = 0) {
  const MAX_ATTEMPTS = 10;
  
  if (attempt >= MAX_ATTEMPTS) {
    throw new Error('Failed to generate unique subscription code after maximum attempts');
  }
  
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing characters
  const segments = 4;
  const segmentLength = 4;
  
  let code = '';
  for (let i = 0; i < segments; i++) {
    if (i > 0) code += '-';
    for (let j = 0; j < segmentLength; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  // Check if code already exists (very unlikely but good practice)
  const existing = SubscriptionCode.getByCode(code);
  if (existing) {
    return generateSubscriptionCode(attempt + 1); // Recursive call with incremented attempt
  }
  
  return code;
}

module.exports = router;
