# Auth & Billing Service

**Technology:** NestJS + TypeScript  
**Port:** 3001  
**Database:** PostgreSQL (users, subscriptions, usage_ledger)

## Responsibilities
- User registration and authentication (JWT + refresh tokens)
- RBAC (Role-Based Access Control)
- Stripe subscription integration
- Webhook handling for payment events
- Usage tracking and quota enforcement

## Status
✅ **Implemented** (Phase 2 Complete)

## Features

### Authentication
- **User Registration** - Creates user with 7-day free trial
- **Login** - Email/password authentication with JWT tokens
- **JWT + Refresh Tokens** - 15-minute access tokens, 7-day refresh tokens
- **Profile Endpoint** - Get user data with subscription status
- **Password Hashing** - Secure bcrypt hashing

### Authorization
- **RBAC** - Three roles: student, subscriber, admin
- **JWT Guard** - Protect endpoints with JWT authentication
- **User Context** - Access user ID, email, role in protected routes

### Billing
- **Stripe Checkout** - Create subscription checkout sessions (Basic $9/mo, Pro $29/mo)
- **Webhook Handling** - Process Stripe events (subscription created, updated, canceled)
- **Customer Portal** - Generate Stripe portal links for subscription management
- **Usage Tracking** - Log resource consumption (tokens, memory, agent minutes)

## API Endpoints

### Authentication
```
POST   /auth/register        - Register new user
POST   /auth/login           - Login and get tokens
POST   /auth/refresh         - Refresh access token
GET    /auth/me              - Get current user (protected)
```

### Billing
```
POST   /billing/create-checkout   - Create Stripe checkout session (protected)
POST   /billing/webhooks          - Stripe webhook handler
GET    /billing/portal            - Get customer portal URL (protected)
GET    /billing/usage             - Get usage statistics (protected)
```

### Health
```
GET    /health               - Service health check
```

## Environment Variables

```bash
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/noble_novacore
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_BASIC_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
FRONTEND_URL=http://localhost:5000
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Run in production
npm start
```

## Docker

```bash
# Build image
docker build -t noble-auth-billing .

# Run container
docker run -p 3001:3001 --env-file .env noble-auth-billing
```
