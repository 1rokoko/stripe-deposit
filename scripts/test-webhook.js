#!/usr/bin/env node

/**
 * Test script for Stripe webhook functionality
 * Tests webhook signature verification and event handling
 */

const crypto = require('crypto');
const { loadEnv } = require('../src/config');
const { verifyStripeSignature } = require('../src/stripe/webhookVerifier');

const BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://stripe-deposit.vercel.app';

// Sample Stripe webhook events for testing
const sampleEvents = {
  payment_intent_succeeded: {
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_payment_intent',
        object: 'payment_intent',
        amount: 10000,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          depositId: 'dep_test_123'
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test_123',
      idempotency_key: null
    },
    type: 'payment_intent.succeeded'
  },
  
  payment_intent_requires_action: {
    id: 'evt_test_webhook_2',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_payment_intent_2',
        object: 'payment_intent',
        amount: 20000,
        currency: 'usd',
        status: 'requires_action',
        metadata: {
          depositId: 'dep_test_456'
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test_456',
      idempotency_key: null
    },
    type: 'payment_intent.requires_action'
  }
};

function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

async function makeWebhookRequest(url, event, secret) {
  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, secret);
  
  const https = require('https');
  const urlObj = new URL(url);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
        'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: parsed,
            raw: data
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: null,
            raw: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testWebhookSignatureVerification() {
  console.log('\n🔐 Testing Webhook Signature Verification...');
  
  const env = loadEnv();
  
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.log('⚠️  STRIPE_WEBHOOK_SECRET not set, skipping signature verification test');
    return;
  }
  
  const testPayload = JSON.stringify(sampleEvents.payment_intent_succeeded);
  const validSignature = generateStripeSignature(testPayload, env.STRIPE_WEBHOOK_SECRET);
  
  try {
    // Test valid signature
    const event = verifyStripeSignature({
      payload: testPayload,
      header: validSignature,
      secret: env.STRIPE_WEBHOOK_SECRET
    });
    
    console.log('✅ Valid signature verification passed');
    console.log(`Event type: ${event.type}`);
    console.log(`Event ID: ${event.id}`);
    
    // Test invalid signature
    try {
      verifyStripeSignature({
        payload: testPayload,
        header: 't=123,v1=invalid_signature',
        secret: env.STRIPE_WEBHOOK_SECRET
      });
      console.log('❌ Invalid signature should have failed!');
    } catch (error) {
      console.log('✅ Invalid signature correctly rejected');
    }
    
    // Test missing signature
    try {
      verifyStripeSignature({
        payload: testPayload,
        header: '',
        secret: env.STRIPE_WEBHOOK_SECRET
      });
      console.log('❌ Missing signature should have failed!');
    } catch (error) {
      console.log('✅ Missing signature correctly rejected');
    }
    
  } catch (error) {
    console.log('❌ Signature verification failed:', error.message);
  }
}

async function testWebhookEndpoint() {
  console.log('\n🌐 Testing Webhook Endpoint...');
  
  const env = loadEnv();
  
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.log('⚠️  STRIPE_WEBHOOK_SECRET not set, skipping endpoint test');
    return;
  }
  
  const webhookUrl = `${BASE_URL}/api/stripe/webhook`;
  console.log(`📍 Testing: ${webhookUrl}`);
  
  // Test payment_intent.succeeded event
  console.log('\n🧪 Testing payment_intent.succeeded event...');
  try {
    const response = await makeWebhookRequest(
      webhookUrl,
      sampleEvents.payment_intent_succeeded,
      env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    if (response.status === 200) {
      console.log('✅ Webhook processed successfully');
      console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Webhook processing failed');
      console.log('📄 Error:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Webhook request failed:', error.message);
  }
  
  // Test payment_intent.requires_action event
  console.log('\n🧪 Testing payment_intent.requires_action event...');
  try {
    const response = await makeWebhookRequest(
      webhookUrl,
      sampleEvents.payment_intent_requires_action,
      env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    if (response.status === 200) {
      console.log('✅ Webhook processed successfully');
      console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Webhook processing failed');
      console.log('📄 Error:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Webhook request failed:', error.message);
  }
}

async function testInvalidWebhookRequests() {
  console.log('\n🚫 Testing Invalid Webhook Requests...');
  
  const webhookUrl = `${BASE_URL}/api/stripe/webhook`;
  
  // Test GET request (should be rejected)
  console.log('\n🧪 Testing GET request (should be rejected)...');
  try {
    const https = require('https');
    const urlObj = new URL(webhookUrl);
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : {}
          });
        });
      });
      req.on('error', reject);
      req.end();
    });
    
    console.log(`📊 Status: ${response.status}`);
    if (response.status === 405) {
      console.log('✅ GET request correctly rejected');
    } else {
      console.log('❌ GET request should have been rejected');
    }
  } catch (error) {
    console.log('❌ GET request test failed:', error.message);
  }
  
  // Test missing signature
  console.log('\n🧪 Testing missing signature...');
  try {
    const response = await makeWebhookRequest(webhookUrl, sampleEvents.payment_intent_succeeded, '');
    console.log(`📊 Status: ${response.status}`);
    if (response.status === 400) {
      console.log('✅ Missing signature correctly rejected');
    } else {
      console.log('❌ Missing signature should have been rejected');
    }
  } catch (error) {
    console.log('❌ Missing signature test failed:', error.message);
  }
}

async function showWebhookSetupInstructions() {
  console.log('\n📋 Webhook Setup Instructions:');
  console.log('');
  console.log('1. Go to Stripe Dashboard: https://dashboard.stripe.com/webhooks');
  console.log('2. Click "Add endpoint"');
  console.log(`3. Set endpoint URL: ${BASE_URL}/api/stripe/webhook`);
  console.log('4. Select events to listen for:');
  console.log('   - payment_intent.succeeded');
  console.log('   - payment_intent.requires_action');
  console.log('   - payment_intent.payment_failed');
  console.log('   - payment_intent.canceled');
  console.log('   - payment_intent.amount_capturable_updated');
  console.log('5. Copy the webhook signing secret (whsec_...)');
  console.log('6. Set STRIPE_WEBHOOK_SECRET environment variable');
  console.log('');
  console.log('For Vercel deployment:');
  console.log('vercel env add STRIPE_WEBHOOK_SECRET');
  console.log('# Enter: whsec_your_webhook_secret_here');
}

async function main() {
  console.log('🔗 Stripe Webhook Testing Tool');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  try {
    await testWebhookSignatureVerification();
    await testWebhookEndpoint();
    await testInvalidWebhookRequests();
    showWebhookSetupInstructions();
    
    console.log('\n✅ Webhook testing completed!');
    
  } catch (error) {
    console.error('\n❌ Webhook testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  testWebhookSignatureVerification, 
  testWebhookEndpoint, 
  generateStripeSignature,
  sampleEvents
};
