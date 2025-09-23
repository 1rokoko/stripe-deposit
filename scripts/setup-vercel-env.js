#!/usr/bin/env node

/**
 * Script to help setup environment variables in Vercel
 * Provides guidance and validation for Stripe API keys
 */

const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateStripeKey(key, type) {
  if (!key) return false;
  
  if (type === 'secret') {
    return key.startsWith('sk_test_') || key.startsWith('sk_live_');
  }
  
  if (type === 'webhook') {
    return key.startsWith('whsec_');
  }
  
  return false;
}

async function setupEnvironment() {
  console.log('🚀 Vercel Environment Setup for stripe-deposit\n');
  
  console.log('This script will help you configure environment variables for Vercel deployment.');
  console.log('You can set these variables using the Vercel CLI or Dashboard.\n');

  // Stripe Secret Key
  console.log('📋 1. Stripe Secret Key');
  console.log('Get your test key from: https://dashboard.stripe.com/test/apikeys');
  const stripeKey = await question('Enter your Stripe secret key (sk_test_...): ');
  
  if (!validateStripeKey(stripeKey, 'secret')) {
    console.log('❌ Invalid Stripe secret key format');
    console.log('Expected: sk_test_... (for test) or sk_live_... (for production)');
    process.exit(1);
  }

  if (stripeKey.startsWith('sk_live_')) {
    console.log('⚠️  WARNING: You entered a LIVE key!');
    const confirm = await question('Are you sure you want to use a live key? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Please use a test key for development.');
      process.exit(1);
    }
  } else {
    console.log('✅ Test key detected - safe for development');
  }

  // Webhook Secret
  console.log('\n📋 2. Stripe Webhook Secret');
  console.log('Create a webhook endpoint in Stripe Dashboard and get the signing secret');
  console.log('Webhook URL should be: https://your-domain.vercel.app/api/stripe/webhook');
  const webhookSecret = await question('Enter webhook secret (whsec_...): ');
  
  if (!validateStripeKey(webhookSecret, 'webhook')) {
    console.log('❌ Invalid webhook secret format');
    console.log('Expected: whsec_...');
    process.exit(1);
  }
  console.log('✅ Valid webhook secret format');

  // API Auth Token
  console.log('\n📋 3. API Authentication Token');
  console.log('This secures your API endpoints');
  const useGenerated = await question('Generate a secure token automatically? (y/n): ');
  
  let apiToken;
  if (useGenerated.toLowerCase() === 'y') {
    apiToken = generateSecureToken();
    console.log('✅ Generated secure token');
  } else {
    apiToken = await question('Enter your API auth token: ');
    if (apiToken.length < 16) {
      console.log('⚠️  Token should be at least 16 characters for security');
    }
  }

  // Generate Vercel CLI commands
  console.log('\n🔧 Vercel CLI Commands:');
  console.log('Run these commands to set environment variables:\n');
  
  console.log(`vercel env add STRIPE_SECRET_KEY`);
  console.log(`# Enter: ${stripeKey}\n`);
  
  console.log(`vercel env add STRIPE_WEBHOOK_SECRET`);
  console.log(`# Enter: ${webhookSecret}\n`);
  
  console.log(`vercel env add API_AUTH_TOKEN`);
  console.log(`# Enter: ${apiToken}\n`);

  // Optional environment variables
  console.log('📋 Optional Environment Variables:');
  console.log('vercel env add ALERT_WEBHOOK_URL');
  console.log('# Enter your monitoring webhook URL (optional)\n');

  // Generate .env file for local development
  console.log('💾 Local Development (.env file):');
  console.log('Create a .env file in your project root with:\n');
  
  const envContent = `# Stripe Configuration
STRIPE_SECRET_KEY=${stripeKey}
STRIPE_WEBHOOK_SECRET=${webhookSecret}

# API Authentication
API_AUTH_TOKEN=${apiToken}

# Database Configuration
DATABASE_FILE=./data/deposits.sqlite
NOTIFICATIONS_FILE=./data/notifications.log
JOB_HEALTH_FILE=./data/job-health.json
WEBHOOK_RETRY_QUEUE_FILE=./data/webhook-retry.json
WEBHOOK_RETRY_DEAD_LETTER_FILE=./data/webhook-dead-letter.json

# Server Configuration
PORT=3000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000

# Request Timeouts
REQUEST_TIMEOUT_MS=15000

# Logging
LOG_HTTP_REQUESTS=true

# Notifications
NOTIFICATIONS_MAX_BYTES=1048576
NOTIFICATIONS_MAX_BACKUPS=3
ALERT_WEBHOOK_TIMEOUT_MS=5000

# Job Configuration
REAUTHORIZE_AFTER_DAYS=5
REAUTH_JOB_INTERVAL_MS=43200000
WEBHOOK_RETRY_INTERVAL_MS=60000
WEBHOOK_RETRY_BATCH_SIZE=10
WEBHOOK_RETRY_MAX_ATTEMPTS=5`;

  console.log(envContent);

  // Save to file option
  const saveEnv = await question('\nSave this configuration to .env file? (y/n): ');
  if (saveEnv.toLowerCase() === 'y') {
    const fs = require('fs');
    fs.writeFileSync('.env', envContent);
    console.log('✅ Saved to .env file');
    console.log('⚠️  Remember to add .env to .gitignore!');
  }

  // Next steps
  console.log('\n🎯 Next Steps:');
  console.log('1. Set environment variables in Vercel using the commands above');
  console.log('2. Deploy your application: vercel --prod');
  console.log('3. Test the deployment with the check-stripe-keys script');
  console.log('4. Configure webhook endpoint in Stripe Dashboard');
  console.log('5. Test webhook delivery');

  console.log('\n✅ Environment setup complete!');
  
  rl.close();
}

// Test configuration
async function testConfiguration() {
  console.log('🧪 Testing current configuration...\n');
  
  try {
    const { checkStripeKeys } = require('./check-stripe-keys');
    await checkStripeKeys();
  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
    console.log('\nRun the setup script to configure environment variables.');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    await testConfiguration();
  } else {
    await setupEnvironment();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupEnvironment, testConfiguration };
