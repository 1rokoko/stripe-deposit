#!/usr/bin/env node

/**
 * Interactive script to help setup Stripe webhooks
 * Provides step-by-step guidance for webhook configuration
 */

const readline = require('readline');
const { loadEnv } = require('../src/config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function checkCurrentConfiguration() {
  console.log('🔍 Checking current webhook configuration...\n');
  
  const env = loadEnv();
  
  console.log('📋 Current Configuration:');
  console.log(`STRIPE_SECRET_KEY: ${env.STRIPE_SECRET_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`STRIPE_WEBHOOK_SECRET: ${env.STRIPE_WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
  
  if (env.STRIPE_SECRET_KEY) {
    if (env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      console.log('✅ Using TEST secret key (safe for development)');
    } else if (env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      console.log('⚠️  Using LIVE secret key (production)');
    }
  }
  
  if (env.STRIPE_WEBHOOK_SECRET) {
    if (env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
      console.log('✅ Webhook secret format looks correct');
    } else {
      console.log('⚠️  Webhook secret format looks incorrect');
    }
  }
  
  return env;
}

function showWebhookSetupSteps() {
  console.log('\n📋 Stripe Webhook Setup Steps:');
  console.log('');
  console.log('1. 🌐 Open Stripe Dashboard');
  console.log('   https://dashboard.stripe.com/webhooks');
  console.log('');
  console.log('2. ➕ Click "Add endpoint"');
  console.log('');
  console.log('3. 🔗 Set Endpoint URL:');
  console.log('   https://stripe-deposit.vercel.app/api/stripe/webhook');
  console.log('   (Replace with your actual domain)');
  console.log('');
  console.log('4. 📡 Select Events to Listen For:');
  console.log('   ✅ payment_intent.succeeded');
  console.log('   ✅ payment_intent.requires_action');
  console.log('   ✅ payment_intent.payment_failed');
  console.log('   ✅ payment_intent.canceled');
  console.log('   ✅ payment_intent.amount_capturable_updated');
  console.log('   ✅ payment_intent.requires_payment_method');
  console.log('');
  console.log('5. 💾 Save the endpoint');
  console.log('');
  console.log('6. 🔑 Copy the Signing Secret');
  console.log('   Click on your webhook endpoint');
  console.log('   Find "Signing secret" section');
  console.log('   Click "Reveal" and copy the secret (starts with whsec_)');
}

function showEnvironmentSetup() {
  console.log('\n🔧 Environment Variable Setup:');
  console.log('');
  console.log('For Local Development (.env file):');
  console.log('STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here');
  console.log('');
  console.log('For Vercel Deployment:');
  console.log('vercel env add STRIPE_WEBHOOK_SECRET');
  console.log('# Enter: whsec_your_webhook_secret_here');
  console.log('');
  console.log('For other platforms:');
  console.log('Set STRIPE_WEBHOOK_SECRET environment variable');
  console.log('with the webhook signing secret from Stripe Dashboard');
}

function showTestingInstructions() {
  console.log('\n🧪 Testing Your Webhook:');
  console.log('');
  console.log('1. 🔧 Test webhook configuration:');
  console.log('   node scripts/test-webhook.js');
  console.log('');
  console.log('2. 🎯 Test with Stripe CLI (recommended):');
  console.log('   stripe listen --forward-to https://your-domain.vercel.app/api/stripe/webhook');
  console.log('   stripe trigger payment_intent.succeeded');
  console.log('');
  console.log('3. 📊 Check webhook delivery in Stripe Dashboard:');
  console.log('   Go to your webhook endpoint');
  console.log('   Check "Recent deliveries" section');
  console.log('   Look for successful 200 responses');
}

function showTroubleshooting() {
  console.log('\n🔧 Troubleshooting Common Issues:');
  console.log('');
  console.log('❌ 401 Unauthorized:');
  console.log('   - Check STRIPE_WEBHOOK_SECRET is set correctly');
  console.log('   - Verify secret starts with whsec_');
  console.log('   - Make sure you copied the full secret');
  console.log('');
  console.log('❌ 400 Bad Request:');
  console.log('   - Check webhook signature verification');
  console.log('   - Ensure endpoint URL is correct');
  console.log('   - Verify Content-Type is application/json');
  console.log('');
  console.log('❌ 500 Internal Server Error:');
  console.log('   - Check server logs for detailed error');
  console.log('   - Verify all environment variables are set');
  console.log('   - Test with demo events first');
  console.log('');
  console.log('❌ Webhook not receiving events:');
  console.log('   - Check endpoint URL is publicly accessible');
  console.log('   - Verify events are selected in Stripe Dashboard');
  console.log('   - Check webhook is enabled');
}

function showSecurityBestPractices() {
  console.log('\n🔒 Security Best Practices:');
  console.log('');
  console.log('✅ Always verify webhook signatures');
  console.log('✅ Use HTTPS endpoints only');
  console.log('✅ Keep webhook secrets secure');
  console.log('✅ Use different secrets for test/live modes');
  console.log('✅ Monitor webhook delivery failures');
  console.log('✅ Implement idempotency for webhook handlers');
  console.log('✅ Log webhook events for debugging');
  console.log('✅ Set appropriate timeout values');
}

async function interactiveSetup() {
  console.log('\n🎯 Interactive Webhook Setup');
  console.log('This will guide you through setting up Stripe webhooks step by step.\n');
  
  // Check if user wants to proceed
  const proceed = await question('Do you want to proceed with webhook setup? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    return;
  }
  
  // Get webhook URL
  const defaultUrl = 'https://stripe-deposit.vercel.app/api/stripe/webhook';
  const webhookUrl = await question(`Enter your webhook URL (${defaultUrl}): `) || defaultUrl;
  
  console.log(`\n✅ Webhook URL: ${webhookUrl}`);
  
  // Show setup steps
  showWebhookSetupSteps();
  
  // Wait for user to complete Stripe Dashboard setup
  console.log('\n⏳ Please complete the setup in Stripe Dashboard...');
  await question('Press Enter when you have created the webhook endpoint and copied the signing secret...');
  
  // Get webhook secret
  const webhookSecret = await question('Enter your webhook signing secret (whsec_...): ');
  
  if (!webhookSecret.startsWith('whsec_')) {
    console.log('⚠️  Warning: Webhook secret should start with whsec_');
  }
  
  // Generate environment setup
  console.log('\n📝 Environment Configuration:');
  console.log('Add this to your .env file:');
  console.log(`STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
  
  console.log('\nFor Vercel deployment, run:');
  console.log('vercel env add STRIPE_WEBHOOK_SECRET');
  console.log(`# Enter: ${webhookSecret}`);
  
  // Ask if user wants to test
  const testNow = await question('\nDo you want to test the webhook now? (y/n): ');
  if (testNow.toLowerCase() === 'y') {
    console.log('\n🧪 Testing webhook...');
    console.log('Note: Make sure to set the environment variable first!');
    
    try {
      const { testWebhookSignatureVerification } = require('./test-webhook');
      await testWebhookSignatureVerification();
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      console.log('Make sure to set STRIPE_WEBHOOK_SECRET environment variable');
    }
  }
  
  console.log('\n✅ Webhook setup guide completed!');
  console.log('Remember to test your webhook thoroughly before going live.');
}

async function main() {
  console.log('🔗 Stripe Webhook Setup Tool\n');
  
  try {
    const env = await checkCurrentConfiguration();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--interactive')) {
      await interactiveSetup();
    } else {
      showWebhookSetupSteps();
      showEnvironmentSetup();
      showTestingInstructions();
      showTroubleshooting();
      showSecurityBestPractices();
      
      console.log('\n💡 Tip: Run with --interactive for guided setup');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  checkCurrentConfiguration,
  showWebhookSetupSteps,
  showEnvironmentSetup,
  interactiveSetup
};
