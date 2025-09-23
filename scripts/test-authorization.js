#!/usr/bin/env node

/**
 * Test script for API authorization
 * Tests Bearer token authentication and authorization flows
 */

const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.API_BASE_URL || 'https://stripe-deposit.vercel.app';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'stripe-deposit-auth-test',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
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
  
  if (options.headers && options.headers.Authorization) {
    const token = options.headers.Authorization.replace('Bearer ', '');
    console.log(`🔑 Token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);
  } else {
    console.log('🔑 Token: None');
  }
  
  try {
    const response = await makeRequest(url, options);
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Success');
      if (response.data) {
        console.log('📄 Response:', JSON.stringify(response.data, null, 2));
      }
    } else if (response.status === 401) {
      console.log('🔒 Unauthorized (expected for invalid/missing tokens)');
      if (response.data) {
        console.log('📄 Error:', JSON.stringify(response.data, null, 2));
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

async function testPublicEndpoints() {
  console.log('\n🌐 === PUBLIC ENDPOINTS TESTS ===');
  
  // Test health check (should be public)
  await testEndpoint('Health Check', `${BASE_URL}/healthz`);
  
  // Test webhook endpoint (should be public but only accept POST)
  await testEndpoint('Webhook GET (should fail)', `${BASE_URL}/api/stripe/webhook`);
}

async function testProtectedEndpointsWithoutAuth() {
  console.log('\n🔒 === PROTECTED ENDPOINTS WITHOUT AUTH ===');
  console.log('These should all return 401 Unauthorized');
  
  const protectedEndpoints = [
    '/api/deposits',
    '/api/deposits/hold/100',
    '/metrics'
  ];
  
  for (const endpoint of protectedEndpoints) {
    await testEndpoint(`No Auth: ${endpoint}`, `${BASE_URL}${endpoint}`);
  }
}

async function testProtectedEndpointsWithInvalidAuth() {
  console.log('\n🚫 === PROTECTED ENDPOINTS WITH INVALID AUTH ===');
  console.log('These should all return 401 Unauthorized');
  
  const invalidTokens = [
    'invalid-token',
    'Bearer invalid-token',
    'wrong-format',
    '',
    'sk_test_fake_token',
    'jwt.fake.token'
  ];
  
  for (const token of invalidTokens) {
    const headers = token.startsWith('Bearer ') ? 
      { Authorization: token } : 
      { Authorization: `Bearer ${token}` };
      
    await testEndpoint(
      `Invalid Token: ${token.substring(0, 15)}...`, 
      `${BASE_URL}/api/deposits`,
      { headers }
    );
  }
}

async function testProtectedEndpointsWithValidAuth() {
  console.log('\n✅ === PROTECTED ENDPOINTS WITH VALID AUTH ===');
  
  const validToken = process.env.API_AUTH_TOKEN;
  
  if (!validToken) {
    console.log('⚠️  API_AUTH_TOKEN not set, skipping valid auth tests');
    console.log('Set API_AUTH_TOKEN environment variable to test with valid token');
    return;
  }
  
  const headers = { Authorization: `Bearer ${validToken}` };
  
  const protectedEndpoints = [
    { path: '/api/deposits', method: 'GET' },
    { path: '/metrics', method: 'GET' }
  ];
  
  for (const endpoint of protectedEndpoints) {
    await testEndpoint(
      `Valid Auth: ${endpoint.method} ${endpoint.path}`, 
      `${BASE_URL}${endpoint.path}`,
      { method: endpoint.method, headers }
    );
  }
}

async function testAuthorizationHeaders() {
  console.log('\n📋 === AUTHORIZATION HEADER FORMATS ===');
  
  const testToken = 'test-token-123';
  const headerFormats = [
    { name: 'Correct Bearer format', header: `Bearer ${testToken}` },
    { name: 'Missing Bearer prefix', header: testToken },
    { name: 'Wrong case bearer', header: `bearer ${testToken}` },
    { name: 'Extra spaces', header: `Bearer  ${testToken}  ` },
    { name: 'No space after Bearer', header: `Bearer${testToken}` },
    { name: 'Empty Authorization', header: '' },
    { name: 'Only Bearer', header: 'Bearer' },
    { name: 'Only Bearer with space', header: 'Bearer ' }
  ];
  
  for (const format of headerFormats) {
    await testEndpoint(
      format.name,
      `${BASE_URL}/api/deposits`,
      { headers: { Authorization: format.header } }
    );
  }
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function showAuthSetupInstructions() {
  console.log('\n📋 Authorization Setup Instructions:');
  console.log('');
  console.log('1. 🔑 Generate a secure API token:');
  const secureToken = generateSecureToken();
  console.log(`   Suggested token: ${secureToken}`);
  console.log('');
  console.log('2. 🌐 Set environment variable locally:');
  console.log('   Add to .env file:');
  console.log(`   API_AUTH_TOKEN=${secureToken}`);
  console.log('');
  console.log('3. ☁️  Set environment variable in Vercel:');
  console.log('   vercel env add API_AUTH_TOKEN');
  console.log(`   # Enter: ${secureToken}`);
  console.log('');
  console.log('4. 🧪 Test authorization:');
  console.log(`   export API_AUTH_TOKEN="${secureToken}"`);
  console.log('   node scripts/test-authorization.js');
  console.log('');
  console.log('5. 📱 Use in API calls:');
  console.log('   curl -H "Authorization: Bearer YOUR_TOKEN" https://your-app.vercel.app/api/deposits');
}

function showSecurityBestPractices() {
  console.log('\n🔒 Security Best Practices:');
  console.log('');
  console.log('✅ Use cryptographically secure random tokens');
  console.log('✅ Store tokens securely (environment variables)');
  console.log('✅ Use HTTPS for all API communications');
  console.log('✅ Implement proper token validation');
  console.log('✅ Log authentication failures for monitoring');
  console.log('✅ Consider token rotation for production');
  console.log('✅ Use different tokens for different environments');
  console.log('✅ Never commit tokens to version control');
  console.log('✅ Implement rate limiting on auth endpoints');
  console.log('✅ Consider implementing token expiration');
}

async function main() {
  console.log('🔐 API Authorization Testing Tool');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🔑 API Token: ${process.env.API_AUTH_TOKEN ? 'SET' : 'NOT SET'}`);
  
  try {
    await testPublicEndpoints();
    await testProtectedEndpointsWithoutAuth();
    await testProtectedEndpointsWithInvalidAuth();
    await testAuthorizationHeaders();
    await testProtectedEndpointsWithValidAuth();
    
    showAuthSetupInstructions();
    showSecurityBestPractices();
    
    console.log('\n✅ Authorization testing completed!');
    
  } catch (error) {
    console.error('\n❌ Authorization testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  testEndpoint, 
  testPublicEndpoints,
  testProtectedEndpointsWithoutAuth,
  testProtectedEndpointsWithValidAuth,
  generateSecureToken
};
