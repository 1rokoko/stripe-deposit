#!/usr/bin/env node

/**
 * Test script for API endpoints
 * Tests both demo and real API endpoints
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.API_BASE_URL || 'https://stripe-deposit.vercel.app';
const API_TOKEN = process.env.API_AUTH_TOKEN;

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'stripe-deposit-test-script',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
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

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testEndpoint(name, url, options = {}) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`📍 URL: ${url}`);
  
  try {
    const response = await makeRequest(url, options);
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Success');
      if (response.data) {
        console.log('📄 Response:', JSON.stringify(response.data, null, 2));
      }
    } else if (response.status >= 400 && response.status < 500) {
      console.log('⚠️  Client Error');
      if (response.data) {
        console.log('📄 Error:', JSON.stringify(response.data, null, 2));
      }
    } else {
      console.log('❌ Server Error');
      if (response.data) {
        console.log('📄 Error:', JSON.stringify(response.data, null, 2));
      }
    }
    
    return response;
  } catch (error) {
    console.log('❌ Request Failed:', error.message);
    return null;
  }
}

async function testDemoAPI() {
  console.log('\n🎭 === DEMO API TESTS ===');
  
  // Test demo home
  await testEndpoint('Demo Home', `${BASE_URL}/api/demo`);
  
  // Test demo health
  await testEndpoint('Demo Health', `${BASE_URL}/api/demo/health`);
  
  // Test demo deposits list
  await testEndpoint('Demo Deposits List', `${BASE_URL}/api/demo/deposits`);
  
  // Test demo deposit creation
  await testEndpoint('Demo Create $100 Hold', `${BASE_URL}/api/demo/deposits/hold/100`, {
    method: 'POST',
    body: {
      customerId: 'cus_test_customer',
      metadata: { test: true }
    }
  });
  
  // Test demo deposit by ID
  await testEndpoint('Demo Get Deposit', `${BASE_URL}/api/demo/deposits/dep_demo_001`);
  
  // Test demo capture
  await testEndpoint('Demo Capture Deposit', `${BASE_URL}/api/demo/deposits/dep_demo_001/capture`, {
    method: 'POST',
    body: { amount: 5000 }
  });
}

async function testPublicAPI() {
  console.log('\n🌐 === PUBLIC API TESTS ===');
  
  // Test health check (public)
  await testEndpoint('Health Check', `${BASE_URL}/healthz`);
  
  // Test metrics (requires auth)
  if (API_TOKEN) {
    await testEndpoint('Metrics (Authenticated)', `${BASE_URL}/metrics`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
  } else {
    await testEndpoint('Metrics (No Auth)', `${BASE_URL}/metrics`);
  }
}

async function testProtectedAPI() {
  console.log('\n🔒 === PROTECTED API TESTS ===');
  
  if (!API_TOKEN) {
    console.log('⚠️  API_AUTH_TOKEN not set, skipping protected API tests');
    console.log('Set API_AUTH_TOKEN environment variable to test protected endpoints');
    return;
  }
  
  const authHeaders = { 'Authorization': `Bearer ${API_TOKEN}` };
  
  // Test deposits list
  await testEndpoint('List Deposits', `${BASE_URL}/api/deposits`, {
    headers: authHeaders
  });
  
  // Test deposits with filters
  await testEndpoint('List Deposits (with filters)', `${BASE_URL}/api/deposits?limit=5&status=authorized`, {
    headers: authHeaders
  });
}

async function testStripeIntegration() {
  console.log('\n💳 === STRIPE INTEGRATION TESTS ===');
  
  if (!API_TOKEN) {
    console.log('⚠️  API_AUTH_TOKEN not set, skipping Stripe integration tests');
    return;
  }
  
  const authHeaders = { 'Authorization': `Bearer ${API_TOKEN}` };
  
  // Test creating a real deposit hold (this will use actual Stripe API)
  console.log('\n⚠️  WARNING: The following tests will make real Stripe API calls');
  console.log('Make sure you are using TEST API keys!');
  
  // Test $100 hold creation
  await testEndpoint('Create $100 Hold (Real Stripe)', `${BASE_URL}/api/deposits/hold/100`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      customerId: 'cus_test_customer',
      paymentMethodId: 'pm_card_visa', // Stripe test payment method
      metadata: { test: true, script: 'api-test' }
    }
  });
}

async function runAllTests() {
  console.log('🚀 Starting API Endpoint Tests');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🔑 Auth Token: ${API_TOKEN ? 'SET' : 'NOT SET'}`);
  
  try {
    await testDemoAPI();
    await testPublicAPI();
    await testProtectedAPI();
    
    // Ask user before running Stripe tests
    if (API_TOKEN) {
      console.log('\n❓ Do you want to run Stripe integration tests?');
      console.log('These will make real API calls to Stripe (using your configured keys)');
      console.log('Press Ctrl+C to abort, or wait 5 seconds to continue...');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      await testStripeIntegration();
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Test specific endpoint if provided as argument
async function testSpecific() {
  const endpoint = process.argv[2];
  if (!endpoint) {
    console.log('Usage: node test-api-endpoints.js <endpoint>');
    console.log('Example: node test-api-endpoints.js /api/demo');
    return;
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  await testEndpoint(`Custom Test: ${endpoint}`, url);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    await testSpecific();
  } else {
    await runAllTests();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEndpoint, makeRequest };
