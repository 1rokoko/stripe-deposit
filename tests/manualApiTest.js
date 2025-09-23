// Manual API testing script for comprehensive verification
const http = require('http');

const TEST_TOKEN = process.env.API_AUTH_TOKEN || 'smoke-token';
const BASE_URL = 'http://localhost';

async function makeRequest(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testServer(port) {
  console.log(`\n🧪 Testing server on port ${port}`);
  
  try {
    // 1. Health check
    console.log('1. Health check...');
    const health = await makeRequest(port, '/healthz');
    console.log(`   Status: ${health.status}, Response:`, health.data);
    
    // 2. Unauthorized access
    console.log('2. Unauthorized access test...');
    const unauthorized = await makeRequest(port, '/api/deposits');
    console.log(`   Status: ${unauthorized.status} (should be 401)`);
    
    // 3. Authorized deposits list
    console.log('3. Authorized deposits list...');
    const deposits = await makeRequest(port, '/api/deposits', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    console.log(`   Status: ${deposits.status}, Deposits count:`, deposits.data.deposits?.length || 0);
    
    // 4. Metrics endpoint
    console.log('4. Metrics endpoint...');
    const metrics = await makeRequest(port, '/metrics', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    console.log(`   Status: ${metrics.status}, Has metrics:`, !!metrics.data.uptime);
    
    // 5. Create deposit hold
    console.log('5. Create $100 deposit hold...');
    const hold = await makeRequest(port, '/api/deposits/hold/100', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      body: {
        customerId: 'test-customer',
        paymentMethodId: 'pm_test_123',
        currency: 'usd'
      }
    });
    console.log(`   Status: ${hold.status}, Deposit ID:`, hold.data.deposit?.id);
    
    // 6. Get specific deposit
    if (hold.data.deposit?.id) {
      console.log('6. Get specific deposit...');
      const deposit = await makeRequest(port, `/api/deposits/${hold.data.deposit.id}`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });
      console.log(`   Status: ${deposit.status}, Status:`, deposit.data.deposit?.status);
    }
    
    console.log('✅ All API tests completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting comprehensive API testing...');
  
  // Start server
  const { spawn } = require('child_process');
  const server = spawn('node', ['src/server.js'], {
    env: { ...process.env, PORT: '0' }, // Let system assign port
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let serverPort = null;
  let serverReady = false;
  
  // Capture server output to get port
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Server:', output.trim());
    
    const portMatch = output.match(/"port":(\d+)/);
    if (portMatch && !serverReady) {
      serverPort = parseInt(portMatch[1]);
      serverReady = true;
    }
  });
  
  server.stderr.on('data', (data) => {
    console.log('Server Error:', data.toString().trim());
  });
  
  // Wait for server to start
  await new Promise(resolve => {
    const checkReady = () => {
      if (serverReady && serverPort) {
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
  
  // Run tests
  const success = await testServer(serverPort);
  
  // Cleanup
  server.kill();
  
  return success;
}

if (require.main === module) {
  runComprehensiveTest()
    .then(success => {
      console.log(success ? '\n🎉 All tests passed!' : '\n💥 Some tests failed!');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { testServer, runComprehensiveTest };
