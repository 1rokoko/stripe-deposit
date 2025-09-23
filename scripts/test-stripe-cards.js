#!/usr/bin/env node

/**
 * Test script for Stripe test cards
 * Tests various payment scenarios with different test cards
 */

const https = require('https');
const { loadEnv } = require('../src/config');

const BASE_URL = process.env.API_BASE_URL || 'https://stripe-deposit.vercel.app';

// Stripe test cards for different scenarios
const TEST_CARDS = {
  // Successful cards
  visa: {
    number: '4242424242424242',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Visa Test Card',
    description: 'Basic Visa card - always succeeds'
  },
  
  visa_debit: {
    number: '4000056655665556',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Visa Debit Test Card',
    description: 'Visa debit card - always succeeds'
  },
  
  mastercard: {
    number: '5555555555554444',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Mastercard Test Card',
    description: 'Basic Mastercard - always succeeds'
  },
  
  amex: {
    number: '378282246310005',
    exp_month: 12,
    exp_year: 2025,
    cvc: '1234',
    name: 'American Express Test Card',
    description: 'Basic Amex card - always succeeds'
  },
  
  // Cards requiring authentication (3D Secure)
  visa_3ds: {
    number: '4000000000003220',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Visa 3D Secure Test Card',
    description: 'Requires authentication - triggers 3D Secure'
  },
  
  // Declined cards
  declined_generic: {
    number: '4000000000000002',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Generic Decline Test Card',
    description: 'Always declined with generic_decline'
  },
  
  declined_insufficient_funds: {
    number: '4000000000009995',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Insufficient Funds Test Card',
    description: 'Always declined with insufficient_funds'
  },
  
  declined_lost_card: {
    number: '4000000000009987',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Lost Card Test Card',
    description: 'Always declined with lost_card'
  },
  
  declined_stolen_card: {
    number: '4000000000009979',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Stolen Card Test Card',
    description: 'Always declined with stolen_card'
  },
  
  // Special scenario cards
  expired_card: {
    number: '4000000000000069',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Expired Card Test Card',
    description: 'Always declined with expired_card'
  },
  
  incorrect_cvc: {
    number: '4000000000000127',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Incorrect CVC Test Card',
    description: 'Always declined with incorrect_cvc'
  },
  
  processing_error: {
    number: '4000000000000119',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123',
    name: 'Processing Error Test Card',
    description: 'Always declined with processing_error'
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
        'User-Agent': 'stripe-deposit-card-test',
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

async function testCard(cardName, cardData, amount = 100) {
  console.log(`\n💳 Testing: ${cardData.name}`);
  console.log(`📝 Description: ${cardData.description}`);
  console.log(`💰 Amount: $${amount}`);
  
  const env = loadEnv();
  
  if (!env.API_AUTH_TOKEN) {
    console.log('⚠️  API_AUTH_TOKEN not set, skipping test');
    return null;
  }
  
  const headers = { Authorization: `Bearer ${env.API_AUTH_TOKEN}` };
  
  try {
    // Create deposit hold
    console.log('🔄 Creating deposit hold...');
    const createResponse = await makeRequest(
      `${BASE_URL}/api/deposits/hold/${amount}`,
      {
        method: 'POST',
        headers,
        body: {
          customerId: `cus_test_${cardName}`,
          paymentMethodId: `pm_card_${cardName}`, // This would be created from the card in real scenario
          metadata: {
            test: true,
            cardType: cardName,
            cardNumber: cardData.number.slice(-4),
            testScript: 'stripe-cards-test'
          }
        }
      }
    );
    
    console.log(`📊 Create Status: ${createResponse.status} ${createResponse.statusText}`);
    
    if (createResponse.status === 200 || createResponse.status === 201) {
      console.log('✅ Deposit hold created successfully');
      console.log('📄 Response:', JSON.stringify(createResponse.data, null, 2));
      
      const depositId = createResponse.data.id;
      
      if (depositId) {
        // Try to capture the deposit
        console.log('🔄 Attempting to capture deposit...');
        const captureResponse = await makeRequest(
          `${BASE_URL}/api/deposits/${depositId}/capture`,
          {
            method: 'POST',
            headers,
            body: { amount: amount * 100 } // Amount in cents
          }
        );
        
        console.log(`📊 Capture Status: ${captureResponse.status} ${captureResponse.statusText}`);
        
        if (captureResponse.status === 200) {
          console.log('✅ Deposit captured successfully');
        } else {
          console.log('⚠️  Capture failed (expected for some test cards)');
          if (captureResponse.data) {
            console.log('📄 Capture Error:', JSON.stringify(captureResponse.data, null, 2));
          }
        }
      }
      
    } else {
      console.log('❌ Deposit creation failed');
      if (createResponse.data) {
        console.log('📄 Error:', JSON.stringify(createResponse.data, null, 2));
      }
    }
    
    return createResponse;
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return null;
  }
}

async function testSuccessfulCards() {
  console.log('\n✅ === TESTING SUCCESSFUL CARDS ===');
  console.log('These cards should create successful deposits');
  
  const successfulCards = ['visa', 'visa_debit', 'mastercard', 'amex'];
  
  for (const cardName of successfulCards) {
    await testCard(cardName, TEST_CARDS[cardName], 100);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
  }
}

async function testAuthenticationCards() {
  console.log('\n🔐 === TESTING AUTHENTICATION REQUIRED CARDS ===');
  console.log('These cards should require additional authentication');
  
  const authCards = ['visa_3ds'];
  
  for (const cardName of authCards) {
    await testCard(cardName, TEST_CARDS[cardName], 150);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testDeclinedCards() {
  console.log('\n❌ === TESTING DECLINED CARDS ===');
  console.log('These cards should be declined with specific error codes');
  
  const declinedCards = [
    'declined_generic',
    'declined_insufficient_funds',
    'declined_lost_card',
    'declined_stolen_card'
  ];
  
  for (const cardName of declinedCards) {
    await testCard(cardName, TEST_CARDS[cardName], 200);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testSpecialScenarioCards() {
  console.log('\n⚠️  === TESTING SPECIAL SCENARIO CARDS ===');
  console.log('These cards test specific error conditions');
  
  const specialCards = [
    'expired_card',
    'incorrect_cvc',
    'processing_error'
  ];
  
  for (const cardName of specialCards) {
    await testCard(cardName, TEST_CARDS[cardName], 250);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

function showTestCardReference() {
  console.log('\n📋 Stripe Test Card Reference:');
  console.log('');
  
  Object.entries(TEST_CARDS).forEach(([key, card]) => {
    console.log(`${card.name}:`);
    console.log(`  Number: ${card.number}`);
    console.log(`  Expiry: ${card.exp_month}/${card.exp_year}`);
    console.log(`  CVC: ${card.cvc}`);
    console.log(`  Behavior: ${card.description}`);
    console.log('');
  });
}

function showTestingInstructions() {
  console.log('\n📖 Testing Instructions:');
  console.log('');
  console.log('1. 🔑 Make sure API_AUTH_TOKEN is set');
  console.log('2. 🌐 Ensure Stripe test keys are configured');
  console.log('3. 🔗 Verify webhook is set up for real-time updates');
  console.log('4. 📊 Monitor Stripe Dashboard for payment activity');
  console.log('5. 🧪 Run tests in order: successful → auth → declined → special');
  console.log('');
  console.log('Expected Results:');
  console.log('✅ Successful cards: Create deposits and allow capture');
  console.log('🔐 Auth cards: Create deposits but require authentication');
  console.log('❌ Declined cards: Fail at creation with specific errors');
  console.log('⚠️  Special cards: Fail with specific validation errors');
}

async function testDemoAPI() {
  console.log('\n🎭 === TESTING DEMO API ===');
  console.log('Testing demo endpoints that simulate different card behaviors');

  try {
    // Test demo deposits list
    console.log('\n🔄 Testing demo deposits list...');
    const listResponse = await makeRequest(`${BASE_URL}/api/demo/deposits`);
    console.log(`📊 Status: ${listResponse.status}`);
    if (listResponse.status === 200) {
      console.log('✅ Demo deposits list working');
      console.log(`📄 Found ${listResponse.data.deposits?.length || 0} demo deposits`);
    }

    // Test demo hold creation
    console.log('\n🔄 Testing demo $100 hold...');
    const holdResponse = await makeRequest(
      `${BASE_URL}/api/demo/deposits/hold/100`,
      { method: 'POST', body: { customerId: 'cus_demo_test' } }
    );
    console.log(`📊 Status: ${holdResponse.status}`);
    if (holdResponse.status === 200) {
      console.log('✅ Demo hold created successfully');
      console.log('📄 Response:', JSON.stringify(holdResponse.data, null, 2));
    }

  } catch (error) {
    console.log('❌ Demo API test failed:', error.message);
  }
}

async function main() {
  console.log('💳 Stripe Test Cards Testing Tool');
  console.log(`🌐 Base URL: ${BASE_URL}`);

  const env = loadEnv();
  console.log(`🔑 API Token: ${env.API_AUTH_TOKEN ? 'SET' : 'NOT SET'}`);
  console.log(`💳 Stripe Key: ${env.STRIPE_SECRET_KEY ? 'SET' : 'NOT SET'}`);

  try {
    const args = process.argv.slice(2);

    if (args.includes('--reference')) {
      showTestCardReference();
    } else if (args.includes('--instructions')) {
      showTestingInstructions();
    } else if (args.includes('--demo')) {
      await testDemoAPI();
    } else if (args.includes('--successful')) {
      await testSuccessfulCards();
    } else if (args.includes('--auth')) {
      await testAuthenticationCards();
    } else if (args.includes('--declined')) {
      await testDeclinedCards();
    } else if (args.includes('--special')) {
      await testSpecialScenarioCards();
    } else {
      // Run all tests
      showTestingInstructions();
      await testDemoAPI();

      if (env.API_AUTH_TOKEN && env.STRIPE_SECRET_KEY) {
        await testSuccessfulCards();
        await testAuthenticationCards();
        await testDeclinedCards();
        await testSpecialScenarioCards();
      } else {
        console.log('\n⚠️  Skipping real Stripe tests - missing API_AUTH_TOKEN or STRIPE_SECRET_KEY');
        console.log('Set these environment variables to run full tests');
      }

      showTestCardReference();
    }

    console.log('\n✅ Test card testing completed!');
    console.log('\n💡 Next steps:');
    console.log('   • Check Stripe Dashboard for payment activity');
    console.log('   • Verify webhook events were received');
    console.log('   • Review application logs for any errors');

  } catch (error) {
    console.error('\n❌ Test card testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  TEST_CARDS,
  testCard,
  makeRequest
};
