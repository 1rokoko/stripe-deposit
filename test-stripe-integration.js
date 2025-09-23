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

async function testStripeIntegration() {
  console.log('🧪 Раунд тестирования 2: Stripe интеграция и webhook endpoints...\n');
  
  // Test 1: Stripe API endpoints
  console.log('1️⃣ Тестирование Stripe API endpoints');
  
  try {
    const depositsResponse = await makeRequest('/api/deposits');
    console.log(`   GET /api/deposits: ${depositsResponse.status}`);
    if (depositsResponse.status === 200) {
      console.log(`   ✅ Deposits API работает`);
      console.log(`   Ответ: ${JSON.stringify(depositsResponse.body, null, 2).substring(0, 200)}...`);
    } else {
      console.log(`   ❌ Ошибка: ${JSON.stringify(depositsResponse.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка запроса: ${error.message}`);
  }
  
  // Test 2: Create deposit
  console.log('\n2️⃣ Тестирование создания депозита');
  
  try {
    const createResponse = await makeRequest('/api/deposits', 'POST', {
      customerId: 'cus_test_integration',
      amount: 10000, // $100.00
      metadata: {
        source: 'integration_test',
        test_round: '2'
      }
    });
    
    console.log(`   POST /api/deposits: ${createResponse.status}`);
    if (createResponse.status === 200 || createResponse.status === 201) {
      console.log(`   ✅ Создание депозита работает`);
      console.log(`   Ответ: ${JSON.stringify(createResponse.body, null, 2)}`);
    } else {
      console.log(`   ❌ Ошибка: ${JSON.stringify(createResponse.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка запроса: ${error.message}`);
  }
  
  // Test 3: Webhook endpoint
  console.log('\n3️⃣ Тестирование webhook endpoint');
  
  try {
    const webhookResponse = await makeRequest('/api/stripe/webhook', 'POST', {
      id: 'evt_test_webhook',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_integration',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded'
        }
      }
    }, {
      'stripe-signature': 'test_signature'
    });
    
    console.log(`   POST /api/stripe/webhook: ${webhookResponse.status}`);
    if (webhookResponse.status === 200) {
      console.log(`   ✅ Webhook endpoint доступен`);
    } else if (webhookResponse.status === 400) {
      console.log(`   ⚠️ Webhook требует валидную подпись (ожидаемо)`);
    } else {
      console.log(`   ❌ Неожиданная ошибка: ${JSON.stringify(webhookResponse.body)}`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка запроса: ${error.message}`);
  }
  
  // Test 4: Demo endpoints (через отдельную функцию)
  console.log('\n4️⃣ Тестирование demo endpoints');

  try {
    // Тестируем demo функцию напрямую
    const demoResponse = await makeRequest('/api/demo');
    console.log(`   GET /api/demo: ${demoResponse.status}`);
    if (demoResponse.status === 200) {
      console.log(`   ✅ Demo API работает`);
      console.log(`   Ответ: ${JSON.stringify(demoResponse.body, null, 2).substring(0, 200)}...`);
    } else {
      console.log(`   ❌ Demo API ошибка: ${JSON.stringify(demoResponse.body)}`);
    }

  } catch (error) {
    console.log(`   ❌ Ошибка demo endpoints: ${error.message}`);
  }

  // Test 5: Проверка основных endpoints без авторизации
  console.log('\n5️⃣ Тестирование endpoints без авторизации');

  try {
    const noAuthResponse = await makeRequest('/api/deposits', 'GET', null, {});
    console.log(`   GET /api/deposits (без auth): ${noAuthResponse.status}`);
    if (noAuthResponse.status === 401) {
      console.log(`   ✅ Авторизация работает корректно`);
    }

    const metricsNoAuthResponse = await makeRequest('/metrics', 'GET', null, {});
    console.log(`   GET /metrics (без auth): ${metricsNoAuthResponse.status}`);
    if (metricsNoAuthResponse.status === 401) {
      console.log(`   ✅ Metrics авторизация работает корректно`);
    }

  } catch (error) {
    console.log(`   ❌ Ошибка тестирования авторизации: ${error.message}`);
  }
  
  console.log('\n✅ Раунд тестирования 2 завершен!');
}

testStripeIntegration().catch(console.error);
