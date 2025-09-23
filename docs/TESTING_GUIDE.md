# 🧪 Testing Guide for Stripe Deposit API

This guide covers comprehensive testing of the Stripe Deposit API, including test cards, payment scenarios, and validation procedures.

## 📋 Overview

The testing suite includes:
- **API Authorization Testing** - Bearer token validation
- **Webhook Testing** - Stripe webhook signature verification
- **Test Card Testing** - Various Stripe test card scenarios
- **Payment Scenario Testing** - End-to-end payment flows
- **Demo API Testing** - Mock payment functionality

## 🔧 Setup

### Prerequisites

1. **Environment Variables**
   ```bash
   API_AUTH_TOKEN=your-secure-api-token
   STRIPE_SECRET_KEY=sk_test_your_stripe_test_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

2. **Dependencies**
   ```bash
   npm install
   ```

3. **Stripe Dashboard Access**
   - Test mode enabled
   - Webhook endpoint configured
   - Test API keys available

## 🧪 Test Scripts

### 1. Authorization Testing

```bash
# Test API authorization
node scripts/test-authorization.js

# Test enhanced auth middleware
node scripts/test-enhanced-auth.js

# Generate secure API tokens
node scripts/generate-api-token.js --quick
```

**What it tests:**
- Bearer token validation
- Invalid token rejection
- Missing authorization handling
- Header format validation
- Client IP logging

### 2. Webhook Testing

```bash
# Test webhook functionality
node scripts/test-webhook.js

# Setup webhook interactively
node scripts/setup-stripe-webhook.js --interactive
```

**What it tests:**
- Webhook signature verification
- Event payload processing
- Invalid request rejection
- Security validation

### 3. API Endpoint Testing

```bash
# Test all API endpoints
node scripts/test-api-endpoints.js

# Test specific endpoint
node scripts/test-api-endpoints.js /api/deposits
```

**What it tests:**
- Public endpoints (health check)
- Protected endpoints (deposits, metrics)
- Demo API functionality
- Error handling

### 4. Stripe Test Cards

```bash
# Test all card scenarios
node scripts/test-stripe-cards.js

# Test specific card types
node scripts/test-stripe-cards.js --successful
node scripts/test-stripe-cards.js --declined
node scripts/test-stripe-cards.js --auth

# Show test card reference
node scripts/test-stripe-cards.js --reference
```

**Test Card Categories:**

#### ✅ Successful Cards
- **Visa**: `4242424242424242` - Always succeeds
- **Mastercard**: `5555555555554444` - Always succeeds
- **Amex**: `378282246310005` - Always succeeds
- **Visa Debit**: `4000056655665556` - Always succeeds

#### 🔐 Authentication Required
- **3D Secure**: `4000000000003220` - Requires authentication

#### ❌ Declined Cards
- **Generic Decline**: `4000000000000002` - Always declined
- **Insufficient Funds**: `4000000000009995` - Insufficient funds
- **Lost Card**: `4000000000009987` - Lost card
- **Stolen Card**: `4000000000009979` - Stolen card

#### ⚠️ Special Scenarios
- **Expired Card**: `4000000000000069` - Expired card error
- **Incorrect CVC**: `4000000000000127` - CVC error
- **Processing Error**: `4000000000000119` - Processing error

### 5. Payment Scenarios

```bash
# Test all payment scenarios
node scripts/test-payment-scenarios.js

# Test specific scenario
node scripts/test-payment-scenarios.js successful_visa
```

**Scenario Types:**
- **Successful Flows**: Create → Authorize → Capture
- **Authentication Required**: 3D Secure flows
- **Declined Payments**: Various decline reasons
- **Hold and Release**: Authorization without capture
- **Partial Capture**: Capture less than authorized

## 📊 Expected Results

### Successful Test Results

#### Authorization Tests
```
✅ Valid tokens: Access granted
✅ Invalid tokens: 401 Unauthorized
✅ Missing tokens: 401 Unauthorized
✅ Malformed headers: 401 Unauthorized
```

#### Webhook Tests
```
✅ Valid signatures: Event processed
✅ Invalid signatures: 400 Bad Request
✅ Missing signatures: 400 Bad Request
✅ GET requests: 405 Method Not Allowed
```

#### Card Tests
```
✅ Successful cards: Deposit created and capturable
🔐 Auth cards: Requires additional authentication
❌ Declined cards: Specific decline reasons
⚠️ Special cards: Validation errors
```

#### Payment Scenarios
```
✅ Complete flows: Create → Authorize → Capture
🔐 Auth flows: Create → Requires Action
❌ Declined flows: Create → Failed
🔄 Release flows: Create → Authorize → Release
```

## 🔍 Troubleshooting

### Common Issues

#### 1. 401 Unauthorized
```
Cause: Invalid or missing API_AUTH_TOKEN
Solution: Set correct token in environment variables
```

#### 2. 404 Not Found
```
Cause: Endpoint not available or deployment pending
Solution: Check deployment status and URL paths
```

#### 3. Webhook Signature Verification Failed
```
Cause: Incorrect STRIPE_WEBHOOK_SECRET
Solution: Copy correct secret from Stripe Dashboard
```

#### 4. Test Cards Not Working
```
Cause: Using live keys instead of test keys
Solution: Ensure STRIPE_SECRET_KEY starts with sk_test_
```

### Debug Commands

```bash
# Check environment configuration
node scripts/check-stripe-keys.js

# Validate webhook setup
node scripts/setup-stripe-webhook.js

# Test specific endpoints
curl -H "Authorization: Bearer $API_AUTH_TOKEN" \
     https://stripe-deposit.vercel.app/api/deposits
```

## 📈 Test Coverage

### API Endpoints
- [x] Health check (`/healthz`)
- [x] Metrics (`/metrics`)
- [x] Deposits list (`/api/deposits`)
- [x] Create holds (`/api/deposits/hold/{amount}`)
- [x] Capture deposits (`/api/deposits/{id}/capture`)
- [x] Release deposits (`/api/deposits/{id}/release`)
- [x] Webhook receiver (`/api/stripe/webhook`)
- [x] Demo API (`/api/demo/*`)

### Security Features
- [x] Bearer token authentication
- [x] Webhook signature verification
- [x] Rate limiting validation
- [x] Input sanitization
- [x] Error handling

### Payment Flows
- [x] Successful payments
- [x] Declined payments
- [x] Authentication required
- [x] Partial captures
- [x] Hold and release
- [x] Error scenarios

## 🚀 Continuous Testing

### Pre-deployment Checklist

1. **Run Full Test Suite**
   ```bash
   npm test
   node scripts/test-authorization.js
   node scripts/test-webhook.js
   node scripts/test-stripe-cards.js --demo
   ```

2. **Validate Configuration**
   ```bash
   node scripts/check-stripe-keys.js
   node scripts/setup-stripe-webhook.js
   ```

3. **Check Deployment**
   ```bash
   curl https://stripe-deposit.vercel.app/healthz
   ```

### Monitoring

- **Stripe Dashboard**: Monitor test payments
- **Vercel Logs**: Check function execution
- **Webhook Deliveries**: Verify event processing
- **Error Tracking**: Monitor failed requests

## 📚 Additional Resources

- [Stripe Test Cards Documentation](https://stripe.com/docs/testing#cards)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [API Authentication Best Practices](https://stripe.com/docs/keys)
- [Testing Payment Flows](https://stripe.com/docs/testing#payment-flows)

## 🎯 Next Steps

After successful testing:

1. **Production Deployment**
   - Switch to live Stripe keys
   - Update webhook endpoints
   - Configure production tokens

2. **Monitoring Setup**
   - Error tracking
   - Performance monitoring
   - Security alerts

3. **Documentation**
   - API documentation
   - Integration guides
   - Troubleshooting guides
