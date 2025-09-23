const https = require('https');

const baseUrl = 'https://stripe-deposit.vercel.app';
const authToken = '+wHLpI2G1rV+VFmAk7mdomTDVf+glkljgtJiksmRft8=';

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Stripe-Deposit-E2E-Test/1.0'
    };
    
    if (authToken && path.includes('/api/') && !headers.hasOwnProperty('Authorization')) {
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

async function testEndToEnd() {
  console.log('🧪 РАУНД ТЕСТИРОВАНИЯ 3: End-to-End тестирование всех функций\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Infrastructure Health
  console.log('🏗️ БЛОК 1: Инфраструктура и здоровье системы');
  
  totalTests++;
  try {
    const healthResponse = await makeRequest('/healthz');
    console.log(`   ✅ Health Check: ${healthResponse.status === 200 ? 'PASS' : 'FAIL'} (${healthResponse.status})`);
    if (healthResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ Health Check: FAIL (${error.message})`);
  }
  
  totalTests++;
  try {
    const metricsResponse = await makeRequest('/metrics');
    console.log(`   ✅ Metrics API: ${metricsResponse.status === 200 ? 'PASS' : 'FAIL'} (${metricsResponse.status})`);
    if (metricsResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ Metrics API: FAIL (${error.message})`);
  }
  
  // Test 2: Authentication & Authorization
  console.log('\n🔐 БЛОК 2: Аутентификация и авторизация');
  
  totalTests++;
  try {
    const noAuthResponse = await makeRequest('/metrics', 'GET', null, { 'Authorization': '' });
    console.log(`   ✅ Auth Required: ${noAuthResponse.status === 401 ? 'PASS' : 'FAIL'} (${noAuthResponse.status})`);
    if (noAuthResponse.status === 401) passedTests++;
  } catch (error) {
    console.log(`   ❌ Auth Required: FAIL (${error.message})`);
  }
  
  totalTests++;
  try {
    const badAuthResponse = await makeRequest('/metrics', 'GET', null, { 'Authorization': 'Bearer invalid_token' });
    console.log(`   ✅ Bad Token Rejected: ${badAuthResponse.status === 401 ? 'PASS' : 'FAIL'} (${badAuthResponse.status})`);
    if (badAuthResponse.status === 401) passedTests++;
  } catch (error) {
    console.log(`   ❌ Bad Token Rejected: FAIL (${error.message})`);
  }
  
  // Test 3: Core API Functionality
  console.log('\n📊 БЛОК 3: Основная функциональность API');
  
  totalTests++;
  try {
    const depositsResponse = await makeRequest('/api/deposits');
    console.log(`   ✅ List Deposits: ${depositsResponse.status === 200 ? 'PASS' : 'FAIL'} (${depositsResponse.status})`);
    if (depositsResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ List Deposits: FAIL (${error.message})`);
  }
  
  totalTests++;
  try {
    const invalidAmountResponse = await makeRequest('/api/deposits/hold/999', 'POST', {
      customerId: 'cus_test',
      paymentMethodId: 'pm_test'
    });
    console.log(`   ✅ Input Validation: ${invalidAmountResponse.status === 400 ? 'PASS' : 'FAIL'} (${invalidAmountResponse.status})`);
    if (invalidAmountResponse.status === 400) passedTests++;
  } catch (error) {
    console.log(`   ❌ Input Validation: FAIL (${error.message})`);
  }
  
  // Test 4: Demo Functionality
  console.log('\n🎭 БЛОК 4: Demo функциональность');
  
  totalTests++;
  try {
    const demoResponse = await makeRequest('/api/demo');
    console.log(`   ✅ Demo API: ${demoResponse.status === 200 ? 'PASS' : 'FAIL'} (${demoResponse.status})`);
    if (demoResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ Demo API: FAIL (${error.message})`);
  }
  
  totalTests++;
  try {
    const demoDepositsResponse = await makeRequest('/api/demo/deposits');
    console.log(`   ✅ Demo Deposits: ${demoDepositsResponse.status === 200 ? 'PASS' : 'FAIL'} (${demoDepositsResponse.status})`);
    if (demoDepositsResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ Demo Deposits: FAIL (${error.message})`);
  }
  
  totalTests++;
  try {
    const demoHoldResponse = await makeRequest('/api/demo/deposits/hold/100', 'POST', {
      customerId: 'cus_demo_e2e',
      metadata: { test: 'end-to-end' }
    });
    console.log(`   ✅ Demo Hold Creation: ${demoHoldResponse.status === 200 ? 'PASS' : 'FAIL'} (${demoHoldResponse.status})`);
    if (demoHoldResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ Demo Hold Creation: FAIL (${error.message})`);
  }
  
  // Test 5: Webhook Endpoints
  console.log('\n🪝 БЛОК 5: Webhook endpoints');
  
  totalTests++;
  try {
    const webhookResponse = await makeRequest('/api/stripe/webhook', 'POST', {
      id: 'evt_test_e2e',
      type: 'payment_intent.succeeded'
    }, { 'stripe-signature': 'test_signature' });
    console.log(`   ✅ Webhook Endpoint: ${webhookResponse.status === 400 ? 'PASS' : 'FAIL'} (${webhookResponse.status}) - Signature validation working`);
    if (webhookResponse.status === 400) passedTests++;
  } catch (error) {
    console.log(`   ❌ Webhook Endpoint: FAIL (${error.message})`);
  }
  
  // Test 6: Web Interface
  console.log('\n🌐 БЛОК 6: Веб-интерфейс');
  
  totalTests++;
  try {
    const webResponse = await makeRequest('/');
    console.log(`   ✅ Web Interface: ${webResponse.status === 200 ? 'PASS' : 'FAIL'} (${webResponse.status})`);
    if (webResponse.status === 200) passedTests++;
  } catch (error) {
    console.log(`   ❌ Web Interface: FAIL (${error.message})`);
  }
  
  // Test 7: Error Handling
  console.log('\n⚠️ БЛОК 7: Обработка ошибок');
  
  totalTests++;
  try {
    const notFoundResponse = await makeRequest('/api/nonexistent');
    console.log(`   ✅ 404 Handling: ${notFoundResponse.status === 404 ? 'PASS' : 'FAIL'} (${notFoundResponse.status})`);
    if (notFoundResponse.status === 404) passedTests++;
  } catch (error) {
    console.log(`   ❌ 404 Handling: FAIL (${error.message})`);
  }
  
  // Final Results
  console.log('\n📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
  console.log(`   Пройдено тестов: ${passedTests}/${totalTests}`);
  console.log(`   Процент успеха: ${Math.round((passedTests/totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('   🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Система работает отлично!');
  } else if (passedTests >= totalTests * 0.8) {
    console.log('   ✅ БОЛЬШИНСТВО ТЕСТОВ ПРОЙДЕНО! Система работает хорошо!');
  } else {
    console.log('   ⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ. Требуется дополнительная работа.');
  }
  
  console.log('\n✅ Раунд тестирования 3 завершен!');
  return { passedTests, totalTests, successRate: (passedTests/totalTests) * 100 };
}

testEndToEnd().catch(console.error);
