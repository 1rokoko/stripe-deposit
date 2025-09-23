#!/usr/bin/env node

/**
 * Utility to check and validate Stripe API keys
 * Ensures we're using test keys, not live keys for development
 */

const { loadEnv } = require('../src/config');
const { StripeClient } = require('../src/stripe/stripeClient');

async function checkStripeKeys() {
  console.log('🔍 Checking Stripe API keys configuration...\n');

  const env = loadEnv();

  // Check if STRIPE_SECRET_KEY is set
  if (!env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY is not set!');
    console.log('Please set STRIPE_SECRET_KEY environment variable.');
    process.exit(1);
  }

  const secretKey = env.STRIPE_SECRET_KEY;
  
  // Check key format and type
  console.log('📋 Key Analysis:');
  console.log(`Key prefix: ${secretKey.substring(0, 8)}...`);
  
  if (secretKey.startsWith('sk_test_')) {
    console.log('✅ Using TEST secret key (safe for development)');
  } else if (secretKey.startsWith('sk_live_')) {
    console.log('⚠️  WARNING: Using LIVE secret key!');
    console.log('🚨 This will process real payments and charge real money!');
    console.log('🔧 For development, please use test keys from Stripe Dashboard');
    
    // Don't exit, but warn strongly
    console.log('\n⏳ Continuing in 5 seconds... Press Ctrl+C to abort');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    console.log('❌ Invalid Stripe secret key format');
    console.log('Expected format: sk_test_... or sk_live_...');
    process.exit(1);
  }

  // Test API connection
  console.log('\n🔗 Testing Stripe API connection...');
  
  try {
    const stripeClient = new StripeClient({ 
      apiKey: secretKey,
      fetchImpl: typeof fetch === 'function' ? fetch : require('node-fetch')
    });

    // Try to create a test payment intent to verify the key works
    const testPaymentIntent = await stripeClient.createPaymentIntent({
      amount: 100, // $1.00
      currency: 'usd',
      payment_method_types: ['card'],
      capture_method: 'manual',
      metadata: {
        test: 'stripe-key-validation',
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ Stripe API connection successful');
    console.log(`Test Payment Intent created: ${testPaymentIntent.id}`);
    
    // Cancel the test payment intent
    await stripeClient.cancelPaymentIntent(testPaymentIntent.id);
    console.log('✅ Test Payment Intent cancelled');

    // Check webhook secret
    console.log('\n🔗 Checking webhook configuration...');
    if (env.STRIPE_WEBHOOK_SECRET) {
      if (env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
        console.log('✅ Webhook secret is properly formatted');
      } else {
        console.log('⚠️  Webhook secret format looks incorrect');
        console.log('Expected format: whsec_...');
      }
    } else {
      console.log('⚠️  STRIPE_WEBHOOK_SECRET is not set');
      console.log('This is required for webhook signature verification');
    }

    // Summary
    console.log('\n📊 Configuration Summary:');
    console.log(`Secret Key Type: ${secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'}`);
    console.log(`Webhook Secret: ${env.STRIPE_WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
    console.log(`API Connection: WORKING`);

    if (secretKey.startsWith('sk_test_')) {
      console.log('\n✅ Configuration is safe for development!');
    } else {
      console.log('\n⚠️  Review configuration before production use!');
    }

  } catch (error) {
    console.error('❌ Stripe API connection failed:');
    console.error(error.message);
    
    if (error.status === 401) {
      console.log('\n🔧 This usually means:');
      console.log('- Invalid API key');
      console.log('- Key is not properly set in environment variables');
    }
    
    process.exit(1);
  }
}

// Test card recommendations
function showTestCardRecommendations() {
  console.log('\n💳 Recommended Test Cards for Development:');
  console.log('');
  console.log('✅ Success: 4242424242424242');
  console.log('❌ Declined: 4000000000000002');
  console.log('💰 Insufficient funds: 4000000000009995');
  console.log('🔐 3D Secure: 4000002500003155');
  console.log('⏱️  Processing: 4000000000000259');
  console.log('');
  console.log('All test cards use:');
  console.log('- Any future expiry date (e.g., 12/25)');
  console.log('- Any 3-digit CVC (e.g., 123)');
  console.log('- Any postal code');
  console.log('');
  console.log('📚 More test cards: https://stripe.com/docs/testing#cards');
}

// Environment setup recommendations
function showEnvironmentSetup() {
  console.log('\n🔧 Environment Setup Recommendations:');
  console.log('');
  console.log('1. Create .env file in project root:');
  console.log('   STRIPE_SECRET_KEY=sk_test_...');
  console.log('   STRIPE_WEBHOOK_SECRET=whsec_...');
  console.log('   API_AUTH_TOKEN=your-secure-token');
  console.log('');
  console.log('2. For Vercel deployment, set environment variables:');
  console.log('   vercel env add STRIPE_SECRET_KEY');
  console.log('   vercel env add STRIPE_WEBHOOK_SECRET');
  console.log('   vercel env add API_AUTH_TOKEN');
  console.log('');
  console.log('3. Get your test keys from Stripe Dashboard:');
  console.log('   https://dashboard.stripe.com/test/apikeys');
}

// Main execution
async function main() {
  try {
    await checkStripeKeys();
    showTestCardRecommendations();
    showEnvironmentSetup();
  } catch (error) {
    console.error('Script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkStripeKeys };
