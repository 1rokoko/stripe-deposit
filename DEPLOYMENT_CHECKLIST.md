# Deployment Verification Checklist

## Pre-Deployment Verification

### ✅ Code Preparation
- [x] Serverless functions created in `/api` directory
- [x] `vercel.json` configuration file created
- [x] Memory-based repositories implemented
- [x] HTTP API tests passing
- [x] Environment variables documented

### ✅ Local Testing
- [x] HTTP API smoke test passes
- [x] Server starts with memory fallback
- [x] All endpoints respond correctly
- [x] Authentication works

## Deployment Steps

### 1. Authentication
```bash
npx vercel login
# Follow browser authentication flow
```

### 2. Initial Deployment
```bash
npx vercel
# Answer setup questions
# Wait for deployment to complete
```

### 3. Environment Variables Setup
Set in Vercel Dashboard or via CLI:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` 
- `API_AUTH_TOKEN`

### 4. Production Deployment
```bash
npx vercel --prod
```

## Post-Deployment Verification

### 1. Check Deployment Logs
```bash
# View recent logs
npx vercel logs

# View logs for specific deployment
npx vercel logs [deployment-url]

# Follow live logs
npx vercel logs --follow
```

### 2. Health Check Tests
```bash
# Basic health check
curl https://your-domain.vercel.app/healthz

# Expected response:
# {"status":"ok","timestamp":"2025-09-23T...","service":"stripe-deposit"}
```

### 3. API Authentication Test
```bash
# Test without auth (should fail)
curl https://your-domain.vercel.app/api/deposits

# Expected: 401 Unauthorized

# Test with auth (should succeed)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain.vercel.app/api/deposits

# Expected: {"deposits":[]}
```

### 4. Metrics Endpoint Test
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain.vercel.app/metrics

# Expected: JSON with system metrics
```

### 5. Stripe Webhook Test
```bash
# This will be tested automatically by Stripe
# Check webhook logs in Stripe Dashboard
```

## Common Issues and Solutions

### Issue: Function Timeout
**Symptoms**: 504 Gateway Timeout errors
**Solution**: 
- Check `maxDuration` in `vercel.json`
- Optimize slow operations
- Check function logs for bottlenecks

### Issue: Memory Limit Exceeded
**Symptoms**: Function crashes, out of memory errors
**Solution**:
- Increase `memory` in `vercel.json`
- Optimize memory usage
- Check for memory leaks

### Issue: Environment Variables Not Set
**Symptoms**: 500 errors, missing configuration
**Solution**:
- Verify variables in Vercel Dashboard
- Redeploy after setting variables
- Check variable names match exactly

### Issue: Stripe Webhook Verification Failed
**Symptoms**: Webhook events rejected
**Solution**:
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check webhook URL is correct
- Ensure webhook endpoint is accessible

### Issue: Authentication Failures
**Symptoms**: 401 errors on protected endpoints
**Solution**:
- Verify `API_AUTH_TOKEN` is set
- Check Authorization header format
- Ensure token matches exactly

## Monitoring Commands

### View Function Performance
```bash
# Get deployment info
npx vercel inspect [deployment-url]

# List all deployments
npx vercel ls

# Get project info
npx vercel project ls
```

### Environment Variables
```bash
# List environment variables
npx vercel env ls

# Add environment variable
npx vercel env add VARIABLE_NAME

# Remove environment variable
npx vercel env rm VARIABLE_NAME
```

### Domains and Aliases
```bash
# List domains
npx vercel domains ls

# Add custom domain
npx vercel domains add your-domain.com

# Set alias
npx vercel alias [deployment-url] your-domain.com
```

## Success Criteria

### ✅ Deployment Successful
- [ ] Deployment completes without errors
- [ ] All functions deploy successfully
- [ ] No build errors in logs

### ✅ Health Checks Pass
- [ ] `/healthz` returns 200 OK
- [ ] Response includes correct service name
- [ ] Response time < 1 second

### ✅ API Functionality
- [ ] Authentication works correctly
- [ ] All endpoints respond appropriately
- [ ] Error handling works as expected

### ✅ Stripe Integration
- [ ] Webhook endpoint accessible
- [ ] Webhook signature verification works
- [ ] Test webhook events process correctly

### ✅ Performance
- [ ] Function cold start < 3 seconds
- [ ] API response time < 2 seconds
- [ ] No memory limit issues

## Final Verification Script

```bash
#!/bin/bash
# Save as verify-deployment.sh

DOMAIN="your-domain.vercel.app"
TOKEN="your-api-token"

echo "🔍 Verifying deployment at https://$DOMAIN"

# Health check
echo "1. Health check..."
curl -s "https://$DOMAIN/healthz" | jq .

# API test
echo "2. API authentication test..."
curl -s -H "Authorization: Bearer $TOKEN" "https://$DOMAIN/api/deposits" | jq .

# Metrics test
echo "3. Metrics test..."
curl -s -H "Authorization: Bearer $TOKEN" "https://$DOMAIN/metrics" | jq .

echo "✅ Verification complete"
```

## Next Steps After Successful Deployment

1. **Configure Stripe Webhooks** with your Vercel URL
2. **Set up monitoring** and alerting
3. **Test with real Stripe transactions** (use test mode first)
4. **Document API endpoints** for your team
5. **Set up CI/CD** for automatic deployments
6. **Consider adding persistent storage** for production use
