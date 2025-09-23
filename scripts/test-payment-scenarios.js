#!/usr/bin/env node

/**
 * End-to-end payment scenario testing
 * Tests complete payment flows with different outcomes
 */

const https = require('https');
const { loadEnv } = require('../src/config');

const BASE_URL = process.env.API_BASE_URL || 'https://stripe-deposit.vercel.app';

// Payment scenarios to test
const PAYMENT_SCENARIOS = {
  successful_visa: {
    name: 'Successful Visa Payment',
    description: 'Complete flow: create → authorize → capture',
    amount: 100,
    expectedSteps: ['created', 'authorized', 'captured'],
    shouldSucceed: true
  },
  
  successful_mastercard: {
    name: 'Successful Mastercard Payment',
    description: 'Complete flow with different card brand',
    amount: 150,
    expectedSteps: ['created', 'authorized', 'captured'],
    shouldSucceed: true
  },
  
  requires_authentication: {
    name: '3D Secure Authentication Required',
    description: 'Payment requires additional authentication',
    amount: 200,
    expectedSteps: ['created', 'requires_action'],
    shouldSucceed: false,
    expectedError: 'requires_action'
  },
  
  insufficient_funds: {
    name: 'Insufficient Funds Decline',
    description: 'Payment declined due to insufficient funds',
    amount: 250,
    expectedSteps: ['created', 'failed'],
    shouldSucceed: false,
    expectedError: 'insufficient_funds'
  },
  
  expired_card: {
    name: 'Expired Card Decline',
    description: 'Payment declined due to expired card',
    amount: 300,
    expectedSteps: ['created', 'failed'],
    shouldSucceed: false,
    expectedError: 'expired_card'
  },
  
  hold_and_release: {
    name: 'Hold and Release Flow',
    description: 'Create hold, then release without capturing',
    amount: 175,
    expectedSteps: ['created', 'authorized', 'released'],
    shouldSucceed: true,
    releaseInsteadOfCapture: true
  },
  
  partial_capture: {
    name: 'Partial Capture Flow',
    description: 'Capture less than the authorized amount',
    amount: 200,
    captureAmount: 150,
    expectedSteps: ['created', 'authorized', 'partially_captured'],
    shouldSucceed: true
  }
};

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
        'User-Agent': 'stripe-deposit-scenario-test',
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

async function testPaymentScenario(scenarioName, scenario) {
  console.log(`\n💳 Testing: ${scenario.name}`);
  console.log(`📝 Description: ${scenario.description}`);
  console.log(`💰 Amount: $${scenario.amount}`);
  
  const env = loadEnv();
  
  if (!env.API_AUTH_TOKEN) {
    console.log('⚠️  API_AUTH_TOKEN not set, skipping test');
    return { success: false, reason: 'No auth token' };
  }
  
  const headers = { Authorization: `Bearer ${env.API_AUTH_TOKEN}` };
  const results = {
    steps: [],
    success: false,
    depositId: null,
    finalStatus: null
  };
  
  try {
    // Step 1: Create deposit hold
    console.log('🔄 Step 1: Creating deposit hold...');
    const createResponse = await makeRequest(
      `${BASE_URL}/api/deposits/hold/${scenario.amount}`,
      {
        method: 'POST',
        headers,
        body: {
          customerId: `cus_test_${scenarioName}`,
          paymentMethodId: `pm_card_${scenarioName}`,
          metadata: {
            test: true,
            scenario: scenarioName,
            testScript: 'payment-scenarios'
          }
        }
      }
    );
    
    console.log(`📊 Create Status: ${createResponse.status}`);
    
    if (createResponse.status === 200 || createResponse.status === 201) {
      console.log('✅ Deposit created');
      results.steps.push('created');
      results.depositId = createResponse.data.id;
      
      // Check initial status
      if (createResponse.data.status) {
        results.steps.push(createResponse.data.status);
        results.finalStatus = createResponse.data.status;
        
        if (createResponse.data.status === 'authorized') {
          console.log('✅ Payment authorized');
          
          // Step 2: Capture or Release
          if (scenario.releaseInsteadOfCapture) {
            console.log('🔄 Step 2: Releasing hold...');
            const releaseResponse = await makeRequest(
              `${BASE_URL}/api/deposits/${results.depositId}/release`,
              { method: 'POST', headers }
            );
            
            console.log(`📊 Release Status: ${releaseResponse.status}`);
            if (releaseResponse.status === 200) {
              console.log('✅ Hold released');
              results.steps.push('released');
              results.finalStatus = 'released';
              results.success = true;
            }
            
          } else {
            console.log('🔄 Step 2: Capturing payment...');
            const captureAmount = scenario.captureAmount || scenario.amount;
            const captureResponse = await makeRequest(
              `${BASE_URL}/api/deposits/${results.depositId}/capture`,
              {
                method: 'POST',
                headers,
                body: { amount: captureAmount * 100 } // Convert to cents
              }
            );
            
            console.log(`📊 Capture Status: ${captureResponse.status}`);
            if (captureResponse.status === 200) {
              if (captureAmount < scenario.amount) {
                console.log('✅ Partial capture successful');
                results.steps.push('partially_captured');
                results.finalStatus = 'partially_captured';
              } else {
                console.log('✅ Full capture successful');
                results.steps.push('captured');
                results.finalStatus = 'captured';
              }
              results.success = true;
            }
          }
        } else if (createResponse.data.status === 'requires_action') {
          console.log('🔐 Payment requires authentication');
          results.finalStatus = 'requires_action';
          results.success = scenario.expectedError === 'requires_action';
        }
      }
      
    } else {
      console.log('❌ Deposit creation failed');
      results.steps.push('failed');
      results.finalStatus = 'failed';
      
      if (createResponse.data && createResponse.data.error) {
        console.log(`📄 Error: ${createResponse.data.error}`);
        results.success = scenario.expectedError && 
                         createResponse.data.error.includes(scenario.expectedError);
      }
    }
    
    // Validate results
    console.log('\n📊 Scenario Results:');
    console.log(`   Steps: ${results.steps.join(' → ')}`);
    console.log(`   Final Status: ${results.finalStatus}`);
    console.log(`   Expected Success: ${scenario.shouldSucceed}`);
    console.log(`   Actual Success: ${results.success}`);
    
    const scenarioMatched = scenario.shouldSucceed === results.success;
    console.log(`   Scenario Match: ${scenarioMatched ? '✅' : '❌'}`);
    
    return {
      success: scenarioMatched,
      results,
      scenario
    };
    
  } catch (error) {
    console.log('❌ Scenario failed:', error.message);
    return {
      success: false,
      error: error.message,
      results,
      scenario
    };
  }
}

async function runAllScenarios() {
  console.log('\n🎯 Running All Payment Scenarios');
  
  const results = [];
  
  for (const [scenarioName, scenario] of Object.entries(PAYMENT_SCENARIOS)) {
    const result = await testPaymentScenario(scenarioName, scenario);
    results.push({ name: scenarioName, ...result });
    
    // Wait between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n📈 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Total Scenarios: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.scenario.name}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  return results;
}

async function main() {
  console.log('🎯 Payment Scenarios Testing Tool');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  const env = loadEnv();
  console.log(`🔑 API Token: ${env.API_AUTH_TOKEN ? 'SET' : 'NOT SET'}`);
  
  if (!env.API_AUTH_TOKEN) {
    console.log('\n❌ API_AUTH_TOKEN not set. Please set it to run tests.');
    console.log('export API_AUTH_TOKEN="your-token-here"');
    return;
  }
  
  try {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && PAYMENT_SCENARIOS[args[0]]) {
      // Test specific scenario
      const scenarioName = args[0];
      await testPaymentScenario(scenarioName, PAYMENT_SCENARIOS[scenarioName]);
    } else {
      // Run all scenarios
      await runAllScenarios();
    }
    
    console.log('\n✅ Payment scenario testing completed!');
    
  } catch (error) {
    console.error('\n❌ Payment scenario testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  PAYMENT_SCENARIOS,
  testPaymentScenario,
  runAllScenarios
};
