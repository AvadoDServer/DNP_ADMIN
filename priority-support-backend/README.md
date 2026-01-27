# AVADO Priority Support Backend API

This is the backend service for managing AVADO Priority Support subscriptions. It provides a REST API for subscription validation, activation, and status checking, with integration support for Shopify.

## Features

- ✅ Subscription code generation and validation
- ✅ Subscription activation and management
- ✅ SQLite database for reliable data storage
- ✅ Shopify webhook integration for automated code generation
- ✅ Secure API with JWT authentication
- ✅ Rate limiting for API protection
- ✅ Audit logging for all actions
- ✅ RESTful API design

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT + API Keys
- **Security**: Helmet, CORS, Rate Limiting

## Project Structure

```
priority-support-backend/
├── src/
│   ├── index.js                 # Main application entry point
│   ├── init-db.js               # Database initialization script
│   ├── models/
│   │   ├── database.js          # Database connection and schema
│   │   ├── Subscription.js      # Subscription model
│   │   └── SubscriptionCode.js  # Subscription code model
│   ├── routes/
│   │   ├── subscription.js      # Subscription API routes
│   │   └── webhook.js           # Shopify webhook handler
│   ├── middleware/
│   │   └── auth.js              # Authentication middleware
│   └── utils/
│       └── audit.js             # Audit logging utilities
├── data/                        # SQLite database files (created on init)
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd priority-support-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and set your values
   ```

4. **Initialize the database:**
   ```bash
   npm run init-db
   ```

5. **Start the server:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `DB_PATH`: Path to SQLite database file
- `JWT_SECRET`: Secret key for JWT tokens
- `API_KEY`: API key for authentication
- `SHOPIFY_WEBHOOK_SECRET`: Secret for validating Shopify webhooks
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T09:00:00.000Z"
}
```

### Get Subscription Status

```
GET /api/subscription/status/:userId
```

Get the subscription status for a specific user.

**Headers:**
- `X-API-Key`: Your API key
- OR `Authorization`: Bearer <jwt-token>

**Response (Active):**
```json
{
  "hasSubscription": true,
  "subscription": {
    "planType": "yearly",
    "status": "active",
    "startDate": "2026-01-27T09:00:00.000Z",
    "endDate": "2027-01-27T09:00:00.000Z"
  }
}
```

**Response (No Subscription):**
```json
{
  "hasSubscription": false,
  "message": "No active subscription found"
}
```

### Validate Subscription Code

```
POST /api/subscription/validate
```

Validate a subscription code without activating it.

**Headers:**
- `X-API-Key`: Your API key
- OR `Authorization`: Bearer <jwt-token>

**Request Body:**
```json
{
  "code": "ABCD-EFGH-IJKL-MNOP"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "planType": "yearly"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Code not found"
}
```

### Activate Subscription

```
POST /api/subscription/activate
```

Activate a subscription using a code.

**Headers:**
- `X-API-Key`: Your API key
- OR `Authorization`: Bearer <jwt-token>

**Request Body:**
```json
{
  "userId": "user-unique-id",
  "code": "ABCD-EFGH-IJKL-MNOP"
}
```

**Response (Success):**
```json
{
  "success": true,
  "subscription": {
    "planType": "yearly",
    "status": "active",
    "startDate": "2026-01-27T09:00:00.000Z",
    "endDate": "2027-01-27T09:00:00.000Z"
  }
}
```

**Response (Error):**
```json
{
  "error": "User already has an active subscription"
}
```

### Shopify Webhook

```
POST /api/webhook/shopify
```

Receives Shopify order webhooks and automatically generates subscription codes.

**Headers:**
- `X-Shopify-Hmac-Sha256`: Shopify signature (automatically added by Shopify)

This endpoint is called automatically by Shopify when configured. It:
1. Validates the webhook signature
2. Processes the order
3. Generates subscription codes for priority support products
4. Stores codes in the database
5. (TODO) Sends codes to customers via email

## Shopify Integration

### Setup Steps

1. **In Shopify Admin:**
   - Go to Settings > Notifications > Webhooks
   - Click "Create webhook"
   - Event: `Order creation`
   - Format: `JSON`
   - URL: `https://your-domain.com/api/webhook/shopify`
   - API version: Latest

2. **Configure webhook secret:**
   - Copy the webhook secret from Shopify
   - Add it to your `.env` file as `SHOPIFY_WEBHOOK_SECRET`

3. **Create Priority Support products:**
   - Create products with names including "Priority Support"
   - For monthly: Include "monthly" or "month" in the name
   - For yearly: Include "yearly", "annual", or "year" in the name
   - Set prices: €12/month or €100/year

### Product Naming Examples

- "AVADO Priority Support - Monthly"
- "AVADO Priority Support - Annual"
- "Priority Support Subscription (1 Year)"
- "Monthly Priority Support Package"

## Database Schema

### subscriptions

Stores active subscriptions.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | TEXT | Unique user identifier |
| subscription_code | TEXT | The activation code used |
| plan_type | TEXT | 'monthly' or 'yearly' |
| status | TEXT | 'active', 'expired', or 'cancelled' |
| start_date | TEXT | ISO 8601 date |
| end_date | TEXT | ISO 8601 date |
| shopify_order_id | TEXT | Original Shopify order ID |
| created_at | TEXT | ISO 8601 timestamp |
| updated_at | TEXT | ISO 8601 timestamp |

### subscription_codes

Stores generated codes that haven't been used yet.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| code | TEXT | The subscription code |
| plan_type | TEXT | 'monthly' or 'yearly' |
| is_used | INTEGER | 0 or 1 |
| shopify_order_id | TEXT | Original Shopify order ID |
| created_at | TEXT | ISO 8601 timestamp |
| used_at | TEXT | ISO 8601 timestamp |

### audit_log

Stores audit logs for security and debugging.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | TEXT | User identifier |
| action | TEXT | Action performed |
| details | TEXT | JSON details |
| ip_address | TEXT | Client IP address |
| created_at | TEXT | ISO 8601 timestamp |

## Security

### Authentication

The API supports two authentication methods:

1. **API Key** (Simple, good for server-to-server):
   ```
   X-API-Key: your-api-key
   ```

2. **JWT Token** (Better for client apps):
   ```
   Authorization: Bearer <jwt-token>
   ```

### Rate Limiting

- API endpoints are rate-limited to 100 requests per 15 minutes per IP
- Adjust limits in `src/index.js`

### CORS

- Configure allowed origins in `.env`
- Default allows all origins in development

### Webhook Signature Validation

- Shopify webhooks are validated using HMAC-SHA256
- Invalid signatures are rejected

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` for auto-reload on file changes.

### Testing the API

Use curl, Postman, or any HTTP client:

```bash
# Health check
curl http://localhost:3001/health

# Get subscription status (development mode)
curl http://localhost:3001/api/subscription/status/user123

# Validate a code (with API key)
curl -X POST http://localhost:3001/api/subscription/validate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"code":"DEMO-CODE-123"}'
```

## Deployment

### Option 1: VPS/Cloud Server

1. Copy files to server
2. Install Node.js (v14 or higher)
3. Run `npm install --production`
4. Set environment variables
5. Initialize database: `npm run init-db`
6. Use PM2 or similar for process management:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name priority-support-api
   pm2 save
   ```

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run init-db
EXPOSE 3001
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t priority-support-api .
docker run -p 3001:3001 --env-file .env priority-support-api
```

### Option 3: Platform as a Service

Deploy to Heroku, Railway, Render, or similar:

1. Connect your repository
2. Set environment variables in the platform dashboard
3. The platform will auto-detect Node.js and install dependencies
4. Ensure database is initialized on first deploy

## Maintenance

### Check Expired Subscriptions

The system automatically checks and updates expired subscriptions when status is requested. To manually check:

```javascript
const Subscription = require('./src/models/Subscription');
Subscription.checkAndUpdateExpiredSubscriptions();
```

### Generate Manual Codes

You can manually generate codes using the database:

```bash
sqlite3 data/subscriptions.db
INSERT INTO subscription_codes (code, plan_type) VALUES ('XXXX-XXXX-XXXX-XXXX', 'yearly');
```

### View Audit Logs

```bash
sqlite3 data/subscriptions.db
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Database locked error

- Ensure only one process is accessing the database
- Check file permissions on the database file

### Webhook not receiving data

- Verify the webhook URL is accessible from the internet
- Check Shopify webhook logs in Shopify admin
- Verify SHOPIFY_WEBHOOK_SECRET matches Shopify configuration

### Authentication errors

- Check API_KEY or JWT_SECRET is correctly set
- Verify authentication headers are being sent
- Check the authentication method matches your configuration

## License

GPL-3.0

## Support

For issues or questions, contact: support@avado.cloud
