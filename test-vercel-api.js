// Test Vercel API endpoints
const https = require('https');

const BASE_URL = 'https://stripe-deposit-5cfi6qgj0-phuket1.vercel.app';
const AUTH_TOKEN = '+wHLpI2G1rV+VFmAk7mdomTDVf+glkljgtJiksmRft8=';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const requestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testAPI() {
  console.log('🚀 Testing Vercel API endpoints...\n');

  try {
    // 1. Health check (public)
    console.log('1. Health check (public):');
    const health = await makeRequest('/healthz');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response:`, health.data);
    console.log('');

    // 2. Unauthorized access test
    console.log('2. Unauthorized access test:');
    const unauthorized = await makeRequest('/api/deposits');
    console.log(`   Status: ${unauthorized.status} (should be 401)`);
    console.log(`   Response:`, unauthorized.data);
    console.log('');

    // 3. Authorized deposits list
    console.log('3. Authorized deposits list:');
    const deposits = await makeRequest('/api/deposits', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    console.log(`   Status: ${deposits.status}`);
    console.log(`   Response:`, deposits.data);
    console.log('');

    // 4. Metrics endpoint
    console.log('4. Metrics endpoint:');
    const metrics = await makeRequest('/metrics', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    console.log(`   Status: ${metrics.status}`);
    console.log(`   Response:`, metrics.data);
    console.log('');

    // 5. Webhook endpoint (should be 405 for GET)
    console.log('5. Webhook endpoint (GET - should be 405):');
    const webhook = await makeRequest('/api/stripe/webhook');
    console.log(`   Status: ${webhook.status} (should be 405)`);
    console.log(`   Response:`, webhook.data);
    console.log('');

    console.log('✅ All API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();
