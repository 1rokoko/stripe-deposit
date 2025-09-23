const https = require('https');

const baseUrl = 'https://stripe-deposit.vercel.app';
const authToken = '+wHLpI2G1rV+VFmAk7mdomTDVf+glkljgtJiksmRft8=';

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Stripe-Deposit-Test/1.0'
    };
    
    if (authToken && path.includes('/api/')) {
      defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    
    const requestHeaders = { ...defaultHeaders, ...headers };
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: requestHeaders
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: jsonBody, rawBody: body });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, rawBody: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testHoldEndpoints() {
  console.log('🧪 Тестирование Hold Endpoints...\n');
  
  // Test 1: Hold $100
  console.log('1️⃣ Тестирование создания $100 hold');
  
  try {
    const hold100Response = await makeRequest('/api/deposits/hold/100', 'POST', {
      customerId: 'cus_test_integration',
      paymentMethodId: 'pm_card_visa',
      metadata: {
        source: 'integration_test',
        test_round: '2'
      }
    });
    
    console.log(`   POST /api/deposits/hold/100: ${hold100Response.status}`);
    if (hold100Response.status === 200) {
      console.log(`   ✅ $100 Hold создан успешно`);
      console.log(`   Ответ: ${JSON.stringify(hold100Response.body, null, 2).substring(0, 300)}...`);
    } else {
      console.log(`   ❌ Ошибка: ${JSON.stringify(hold100Response.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка запроса: ${error.message}`);
  }
  
  // Test 2: Hold $200
  console.log('\n2️⃣ Тестирование создания $200 hold');
  
  try {
    const hold200Response = await makeRequest('/api/deposits/hold/200', 'POST', {
      customerId: 'cus_test_integration_200',
      paymentMethodId: 'pm_card_mastercard',
      metadata: {
        source: 'integration_test',
        test_round: '2',
        amount: '200'
      }
    });
    
    console.log(`   POST /api/deposits/hold/200: ${hold200Response.status}`);
    if (hold200Response.status === 200) {
      console.log(`   ✅ $200 Hold создан успешно`);
      console.log(`   Ответ: ${JSON.stringify(hold200Response.body, null, 2).substring(0, 300)}...`);
    } else {
      console.log(`   ❌ Ошибка: ${JSON.stringify(hold200Response.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка запроса: ${error.message}`);
  }
  
  // Test 3: Invalid hold amount
  console.log('\n3️⃣ Тестирование неверной суммы hold');
  
  try {
    const invalidHoldResponse = await makeRequest('/api/deposits/hold/500', 'POST', {
      customerId: 'cus_test_invalid',
      paymentMethodId: 'pm_card_visa'
    });
    
    console.log(`   POST /api/deposits/hold/500: ${invalidHoldResponse.status}`);
    if (invalidHoldResponse.status === 400) {
      console.log(`   ✅ Валидация суммы работает корректно`);
      console.log(`   Ответ: ${JSON.stringify(invalidHoldResponse.body)}`);
    } else {
      console.log(`   ❌ Неожиданный ответ: ${JSON.stringify(invalidHoldResponse.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка запроса: ${error.message}`);
  }
  
  // Test 4: Demo hold endpoints
  console.log('\n4️⃣ Тестирование demo hold endpoints');
  
  try {
    const demoHold100Response = await makeRequest('/api/demo/deposits/hold/100', 'POST', {
      customerId: 'cus_demo_test',
      metadata: { source: 'demo_test' }
    });
    
    console.log(`   POST /api/demo/deposits/hold/100: ${demoHold100Response.status}`);
    if (demoHold100Response.status === 200) {
      console.log(`   ✅ Demo $100 Hold работает`);
      console.log(`   Ответ: ${JSON.stringify(demoHold100Response.body, null, 2).substring(0, 200)}...`);
    } else {
      console.log(`   ❌ Demo hold ошибка: ${JSON.stringify(demoHold100Response.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка demo hold: ${error.message}`);
  }
  
  console.log('\n✅ Тестирование Hold Endpoints завершено!');
}

testHoldEndpoints().catch(console.error);
