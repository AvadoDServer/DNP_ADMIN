# AVADO Priority Support - Integration Guide

This guide explains how to integrate the Priority Support system end-to-end, from Shopify purchase to user activation in the AVADO admin UI.

## System Overview

The Priority Support system consists of three main components:

1. **Shopify Store** - Where users purchase subscriptions
2. **Backend API** - Manages subscriptions and codes
3. **AVADO Admin UI** - Where users activate and view their subscriptions

## Flow Diagram

```
User Purchase Flow:
1. Customer visits AVADO shop (Shopify)
2. Customer purchases Priority Support (monthly/yearly)
3. Shopify sends webhook to Backend API
4. Backend generates unique subscription code
5. Backend sends code to customer via email (optional)
6. Customer enters code in AVADO Admin UI
7. Backend validates and activates subscription
8. UI shows active subscription status
```

## Setup Guide

### Part 1: Backend API Setup

#### 1.1 Deploy the Backend

**Option A: Deploy to a VPS (DigitalOcean, Linode, etc.)**

```bash
# SSH into your server
ssh user@your-server.com

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone or copy the backend code
git clone <your-backend-repo> priority-support-backend
cd priority-support-backend

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env  # Edit with your values

# Initialize database
npm run init-db

# Install PM2 for process management
sudo npm install -g pm2

# Start the service
pm2 start src/index.js --name priority-support-api
pm2 save
pm2 startup  # Follow instructions to auto-start on reboot
```

**Option B: Deploy to Railway/Render/Heroku**

1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically

#### 1.2 Configure Environment Variables

```bash
PORT=3001
NODE_ENV=production
DB_PATH=/var/data/subscriptions.db  # Persistent storage path
JWT_SECRET=<generate-strong-random-string>
API_KEY=<generate-strong-random-string>
ALLOWED_ORIGINS=https://my.ava.do,https://admin.avado.cloud
SHOPIFY_WEBHOOK_SECRET=<from-shopify-later>
```

**Generate secure secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 1.3 Set Up HTTPS

Use nginx or Caddy as reverse proxy:

**Caddy (easiest):**
```caddy
api.avado.cloud {
    reverse_proxy localhost:3001
}
```

**nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name api.avado.cloud;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 1.4 Test the Backend

```bash
# Health check
curl https://api.avado.cloud/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Part 2: Shopify Integration

#### 2.1 Create Priority Support Products

In Shopify Admin:

1. Go to **Products** > **Add product**
2. Create two products:

**Product 1: Monthly Priority Support**
- Title: "AVADO Priority Support - Monthly"
- Price: €12.00
- Description: Include all benefits listed
- SKU: AVADO-PRIORITY-MONTHLY (optional but recommended)

**Product 2: Yearly Priority Support**
- Title: "AVADO Priority Support - Annual"
- Price: €100.00
- Description: Include all benefits + savings notice
- SKU: AVADO-PRIORITY-YEARLY (optional but recommended)

#### 2.2 Configure Webhook

1. In Shopify Admin, go to **Settings** > **Notifications**
2. Scroll down to **Webhooks**
3. Click **Create webhook**
4. Configure:
   - **Event**: Order creation
   - **Format**: JSON
   - **URL**: `https://api.avado.cloud/api/webhook/shopify`
   - **Webhook API version**: 2024-01 (or latest)
5. Click **Save**
6. **Copy the webhook secret** that Shopify shows
7. Add it to your backend `.env` file:
   ```bash
   SHOPIFY_WEBHOOK_SECRET=<paste-secret-here>
   ```
8. Restart your backend API

#### 2.3 Test Webhook Integration

**Create a test order in Shopify:**

1. Go to **Orders** > **Create order**
2. Add one of your Priority Support products
3. Fill in customer details (use your email for testing)
4. Click **Collect payment** and mark as paid
5. Create the order

**Verify webhook received:**

```bash
# Check backend logs
pm2 logs priority-support-api

# Should see: "Generated subscription code: XXXX-XXXX-XXXX-XXXX for order..."
```

**Check database:**

```bash
sqlite3 /var/data/subscriptions.db
SELECT * FROM subscription_codes ORDER BY created_at DESC LIMIT 1;
.quit
```

#### 2.4 Email Integration (Optional)

To automatically email codes to customers, integrate an email service:

**SendGrid Example:**

```bash
npm install @sendgrid/mail
```

Edit `src/routes/webhook.js` and add:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// After generating code:
const msg = {
  to: customer.email,
  from: 'support@avado.cloud',
  subject: 'Your AVADO Priority Support Subscription',
  html: `
    <h2>Thank you for purchasing AVADO Priority Support!</h2>
    <p>Your subscription code is:</p>
    <h1 style="letter-spacing: 2px;">${code}</h1>
    <p>To activate:</p>
    <ol>
      <li>Log in to your AVADO admin panel</li>
      <li>Go to Priority tab</li>
      <li>Enter this code and click Activate</li>
    </ol>
  `
};

await sgMail.send(msg);
```

Add to `.env`:
```bash
SENDGRID_API_KEY=<your-key>
EMAIL_FROM=support@avado.cloud
```

### Part 3: Frontend (AVADO Admin UI) Integration

#### 3.1 Update Frontend API Configuration

The frontend needs to call your backend API. Update the Priority page component:

Edit `/home/runner/work/DNP_ADMIN/DNP_ADMIN/build/src/src/pages/priority/components/Priority.jsx`:

Replace the mock API call with a real one:

```javascript
// Add at top of file
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_PRIORITY_API_URL || 'https://api.avado.cloud';
const API_KEY = process.env.REACT_APP_PRIORITY_API_KEY;

// In the component, replace handleActivateSubscription:
const handleActivateSubscription = async () => {
  if (!subscriptionCode.trim()) {
    setErrorMessage("Please enter a subscription code");
    return;
  }

  setIsLoading(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    // Get user ID from your auth system
    const userId = getUserId(); // Implement this based on your auth
    
    const response = await axios.post(
      `${API_BASE_URL}/api/subscription/activate`,
      {
        userId,
        code: subscriptionCode
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      const endDate = new Date(response.data.subscription.endDate);
      setHasSubscription(true);
      setSubscriptionEndDate(endDate);
      setSuccessMessage("Subscription activated successfully!");
      setSubscriptionCode("");
    }
  } catch (error) {
    setErrorMessage(
      error.response?.data?.error || 
      "Failed to activate subscription. Please check your code and try again."
    );
  } finally {
    setIsLoading(false);
  }
};

// Add useEffect to check subscription status on mount:
useEffect(() => {
  const checkSubscriptionStatus = async () => {
    try {
      const userId = getUserId();
      const response = await axios.get(
        `${API_BASE_URL}/api/subscription/status/${userId}`,
        {
          headers: {
            'X-API-Key': API_KEY
          }
        }
      );

      if (response.data.hasSubscription) {
        setHasSubscription(true);
        setSubscriptionEndDate(new Date(response.data.subscription.endDate));
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  checkSubscriptionStatus();
}, []);
```

#### 3.2 Add Environment Variables

Create or update `.env` file in the frontend build directory:

```bash
REACT_APP_PRIORITY_API_URL=https://api.avado.cloud
REACT_APP_PRIORITY_API_KEY=<your-api-key>
```

#### 3.3 Rebuild and Deploy Frontend

```bash
cd /home/runner/work/DNP_ADMIN/DNP_ADMIN/build/src
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

Deploy the built files to your AVADO admin UI.

### Part 4: Testing End-to-End

#### 4.1 Complete Purchase Flow Test

1. **Purchase:**
   - Go to Shopify store
   - Add "AVADO Priority Support - Annual" to cart
   - Complete checkout
   - Check email for subscription code

2. **Activation:**
   - Log in to AVADO admin panel
   - Navigate to Priority tab
   - Enter the subscription code
   - Click Activate
   - Verify success message appears

3. **Status Check:**
   - Refresh the page
   - Verify subscription status shows as Active
   - Check expiration date is correct (1 year from now)

4. **Backend Verification:**
   ```bash
   # Check subscriptions table
   sqlite3 /var/data/subscriptions.db
   SELECT * FROM subscriptions WHERE status='active';
   
   # Check audit log
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;
   .quit
   ```

#### 4.2 Error Case Testing

Test these scenarios:

1. **Invalid code:**
   - Try activating with "INVALID-CODE-1234"
   - Should show error: "Code not found"

2. **Already used code:**
   - Try activating same code twice
   - Should show error: "Code already used"

3. **Already has subscription:**
   - Try activating when user already has active subscription
   - Should show error: "User already has an active subscription"

## Production Checklist

- [ ] Backend deployed with HTTPS
- [ ] Database backups configured
- [ ] Environment variables set securely
- [ ] Rate limiting configured
- [ ] CORS origins restricted to your domains
- [ ] API keys are strong and secure
- [ ] JWT secret is strong and secure
- [ ] Shopify webhook secret configured
- [ ] Email service integrated (optional)
- [ ] Frontend environment variables set
- [ ] Frontend rebuilt with production settings
- [ ] All endpoints tested
- [ ] Monitoring/logging configured (PM2, Sentry, etc.)

## Monitoring

### Backend Health

```bash
# Check if service is running
pm2 status

# View logs
pm2 logs priority-support-api

# Monitor in real-time
pm2 monit
```

### Database Monitoring

```bash
# Check number of active subscriptions
sqlite3 /var/data/subscriptions.db "SELECT COUNT(*) FROM subscriptions WHERE status='active';"

# Check codes waiting to be used
sqlite3 /var/data/subscriptions.db "SELECT COUNT(*) FROM subscription_codes WHERE is_used=0;"

# View recent audit logs
sqlite3 /var/data/subscriptions.db "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;"
```

### Shopify Webhook Monitoring

In Shopify Admin:
1. Go to Settings > Notifications
2. Click on your webhook
3. View "Recent deliveries" to see success/failure status

## Troubleshooting

### Webhook Not Working

1. **Check webhook URL is accessible:**
   ```bash
   curl -X POST https://api.avado.cloud/api/webhook/shopify \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Should return 401 (signature validation) not connection error

2. **Check Shopify delivery logs:**
   - In Shopify webhook settings
   - View recent deliveries
   - Check error messages

3. **Verify webhook secret:**
   ```bash
   echo $SHOPIFY_WEBHOOK_SECRET  # Should match Shopify
   ```

### Frontend Not Connecting to API

1. **Check CORS:**
   - Verify ALLOWED_ORIGINS includes your frontend domain
   - Check browser console for CORS errors

2. **Check API key:**
   - Verify REACT_APP_PRIORITY_API_KEY matches backend API_KEY

3. **Test API directly:**
   ```bash
   curl https://api.avado.cloud/health
   ```

### Database Issues

1. **Database locked:**
   ```bash
   # Check if multiple processes accessing DB
   lsof /var/data/subscriptions.db
   
   # Kill conflicting processes and restart
   pm2 restart priority-support-api
   ```

2. **Backup database:**
   ```bash
   sqlite3 /var/data/subscriptions.db ".backup /backup/subscriptions-$(date +%Y%m%d).db"
   ```

## Maintenance

### Regular Tasks

**Weekly:**
- Check audit logs for suspicious activity
- Verify webhook is still functioning
- Check for expired subscriptions

**Monthly:**
- Backup database
- Review error logs
- Update dependencies if needed

**Quarterly:**
- Review and rotate API keys
- Security audit
- Performance review

## Support

For technical support or questions:
- Email: tech@avado.cloud
- Documentation: https://docs.avado.cloud

## Pricing Reference

- **Monthly**: €12/month
- **Yearly**: €100/year (save €44 per year!)

Based on DappNode Premium pricing model but focused on support rather than backup services.
