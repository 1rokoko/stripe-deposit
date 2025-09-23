# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Stripe Account**: Get your API keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
# or use npx
npx vercel --version
```

### 2. Login to Vercel
```bash
npx vercel login
```
Follow the browser authentication flow.

### 3. Deploy the Project
```bash
npx vercel
```

During first deployment, you'll be asked:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account/team
- **Link to existing project?** → No (for new deployment)
- **Project name?** → stripe-deposit (or your preferred name)
- **Directory?** → ./ (current directory)
- **Override settings?** → No (use vercel.json)

### 4. Configure Environment Variables

After deployment, set these **required** environment variables in Vercel Dashboard:

#### Required Variables:
- `STRIPE_SECRET_KEY` → Your Stripe secret key (sk_live_... or sk_test_...)
- `STRIPE_WEBHOOK_SECRET` → Your Stripe webhook secret (whsec_...)
- `API_AUTH_TOKEN` → A secure random token for API authentication

#### Optional Variables:
- `ALERT_WEBHOOK_URL` → External webhook URL for notifications
- `RATE_LIMIT_MAX_REQUESTS` → Max requests per window (default: 120)
- `RATE_LIMIT_WINDOW_MS` → Rate limit window in ms (default: 60000)

### 5. Set Environment Variables via Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable for **Production**, **Preview**, and **Development** environments

### 6. Set Environment Variables via CLI (Alternative)

```bash
# Production environment
npx vercel env add STRIPE_SECRET_KEY production
npx vercel env add STRIPE_WEBHOOK_SECRET production
npx vercel env add API_AUTH_TOKEN production

# Preview environment
npx vercel env add STRIPE_SECRET_KEY preview
npx vercel env add STRIPE_WEBHOOK_SECRET preview
npx vercel env add API_AUTH_TOKEN preview
```

### 7. Configure Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Create a new webhook endpoint
3. Set URL to: `https://your-vercel-domain.vercel.app/api/stripe/webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.requires_action`
5. Copy the webhook secret and set it as `STRIPE_WEBHOOK_SECRET`

### 8. Test the Deployment

#### Health Check:
```bash
curl https://your-vercel-domain.vercel.app/healthz
```

#### API Test (with authentication):
```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://your-vercel-domain.vercel.app/api/deposits
```

#### Metrics:
```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://your-vercel-domain.vercel.app/metrics
```

## API Endpoints

All endpoints except `/healthz` and `/api/stripe/webhook` require authentication:
```
Authorization: Bearer YOUR_API_TOKEN
```

### Available Endpoints:
- `GET /healthz` - Health check (public)
- `POST /api/stripe/webhook` - Stripe webhook receiver (public)
- `GET /api/deposits` - List deposits
- `POST /api/deposits/hold/100` - Create $100 hold
- `POST /api/deposits/hold/200` - Create $200 hold
- `GET /api/deposits/{id}` - Get deposit details
- `POST /api/deposits/{id}/capture` - Capture deposit
- `POST /api/deposits/{id}/release` - Release deposit
- `POST /api/deposits/{id}/reauthorize` - Reauthorize deposit
- `POST /api/deposits/{id}/resolve` - Resolve requires_action
- `GET /metrics` - System metrics

## Important Notes

### Serverless Limitations:
- **No persistent storage**: Uses memory-based repositories (data lost between requests)
- **No background jobs**: Reauthorization worker not available in serverless
- **No file system**: Logs and queues are memory-based

### Production Considerations:
- For persistent storage, consider integrating with:
  - **Vercel KV** (Redis-compatible)
  - **PlanetScale** (MySQL)
  - **Supabase** (PostgreSQL)
  - **MongoDB Atlas**

### Security:
- Use strong, random `API_AUTH_TOKEN`
- Use production Stripe keys for live deployment
- Enable HTTPS (automatic with Vercel)
- Monitor `/metrics` endpoint for system health

## Troubleshooting

### Common Issues:

1. **401 Unauthorized**: Check `API_AUTH_TOKEN` is set correctly
2. **Webhook verification failed**: Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. **Function timeout**: Increase `maxDuration` in `vercel.json` if needed
4. **Memory issues**: Increase `memory` allocation in `vercel.json`

### Logs:
```bash
npx vercel logs
```

### Redeploy:
```bash
npx vercel --prod
```

## Support

For issues with this deployment:
1. Check Vercel function logs
2. Verify environment variables are set
3. Test with Stripe test keys first
4. Monitor `/metrics` endpoint for errors
