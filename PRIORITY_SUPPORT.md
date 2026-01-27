# Priority Support Feature

This document describes the Priority Support feature added to AVADO Admin UI.

## Overview

The Priority Support feature allows AVADO users to:
- Purchase priority support subscriptions (monthly or yearly)
- Activate subscription codes
- View their subscription status and benefits
- Access priority support services

## What's New

### 1. Priority Tab in Admin UI

A new "Priority" tab has been added to the navigation menu (between "Remote Connect" and "Support").

**Features:**
- View subscription status (active/inactive)
- See subscription expiration date
- List of included benefits
- Purchase information and links
- Subscription code activation

### 2. Backend API Service

A complete backend service is provided in the `priority-support-backend/` directory.

**Key Features:**
- RESTful API for subscription management
- Shopify webhook integration
- Automatic code generation
- SQLite database
- Secure authentication
- Audit logging

## Quick Start

### Frontend (Already Integrated)

The Priority tab is already integrated into the AVADO Admin UI. After building and deploying:

1. Navigate to the Admin UI
2. Click on "Priority" in the left sidebar
3. You'll see the Priority Support page

### Backend Setup

The backend service needs to be deployed separately:

```bash
# Navigate to backend directory
cd priority-support-backend

# Run setup script
./setup.sh

# Start development server
npm run dev

# Or start production server
npm start
```

For detailed deployment instructions, see `priority-support-backend/INTEGRATION.md`.

## How It Works

### User Flow

1. **Purchase** - User buys subscription on Shopify
2. **Receive Code** - Shopify webhook generates and sends code
3. **Activate** - User enters code in Admin UI
4. **Enjoy** - User gets priority support access

### System Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Shopify   │─────▶│  Backend API │◀─────│  Admin UI   │
│    Shop     │      │   (Node.js)  │      │  (React)    │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Database   │
                     │   (SQLite)   │
                     └──────────────┘
```

## Pricing

- **Monthly**: €12/month
- **Yearly**: €100/year (save €44!)

## Benefits Included

✅ Priority email support (24-hour response time)
✅ Access to private support channels
✅ Personal 1-on-1 support sessions
✅ Advanced troubleshooting assistance
✅ Configuration optimization support
✅ Expert guidance for complex setups

## Files Changed

### Frontend (DNP_ADMIN)

**New Files:**
- `build/src/src/Icons/Priority.jsx`
- `build/src/src/pages/priority/` (complete module)

**Modified Files:**
- `build/src/src/pages/index.js`
- `build/src/src/components/navbar/navbarItems.js`

### Backend (New Service)

**Location:** `priority-support-backend/`

**All files are new** - See `priority-support-backend/README.md` for details.

## Documentation

- **Backend README**: `priority-support-backend/README.md`
- **Integration Guide**: `priority-support-backend/INTEGRATION.md`
- **Implementation Summary**: `priority-support-backend/IMPLEMENTATION_SUMMARY.md`

## Deployment

### Frontend

Already integrated. Just rebuild and deploy:

```bash
cd build/src
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

### Backend

Requires separate deployment:

1. Deploy to a server (VPS, cloud platform, etc.)
2. Configure environment variables
3. Set up Shopify webhook
4. Update frontend with backend URL

See `priority-support-backend/INTEGRATION.md` for step-by-step instructions.

## Testing

### Test the Frontend

After building:
```bash
cd build/src
npm start
# Visit http://localhost:3000/priority
```

### Test the Backend

```bash
cd priority-support-backend
npm run dev
# Visit http://localhost:3001/health
```

## Shopify Integration

Create products in Shopify with these naming patterns:
- "AVADO Priority Support - Monthly" (€12)
- "AVADO Priority Support - Annual" (€100)

Configure webhook:
- Event: Order creation
- URL: `https://your-backend.com/api/webhook/shopify`

The webhook automatically generates subscription codes when orders are created.

## API Endpoints

### Get Subscription Status
```
GET /api/subscription/status/:userId
```

### Validate Code
```
POST /api/subscription/validate
Body: { "code": "XXXX-XXXX-XXXX-XXXX" }
```

### Activate Subscription
```
POST /api/subscription/activate
Body: { "userId": "user-id", "code": "XXXX-XXXX-XXXX-XXXX" }
```

### Shopify Webhook
```
POST /api/webhook/shopify
(Called automatically by Shopify)
```

## Security

- JWT and API key authentication
- Rate limiting (100 req/15min)
- CORS protection
- Shopify webhook signature validation
- Audit logging
- Input validation

## Support

For issues or questions:
- Check documentation in `priority-support-backend/`
- Contact AVADO technical support

## License

GPL-3.0 (same as AVADO Admin UI)

---

**Note**: This feature requires both frontend and backend deployment. The frontend is integrated, but the backend needs to be deployed separately. See the integration guide for complete setup instructions.
