const https = require('https');

const testData = {
  amount: 154,
  currency: 'thb',
  customerId: 'test_customer_123',
  paymentMethodId: 'pm_test_123'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'stripe-deposit.vercel.app',
  port: 443,
  path: '/api/deposits/create-intent',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-stripe-mode': 'test',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔄 Testing API with data:', testData);
console.log('🔄 Request options:', options);

const req = https.request(options, (res) => {
  console.log('📥 Response status:', res.statusCode);
  console.log('📥 Response headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📥 Response body:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('📥 Parsed response:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('❌ Failed to parse JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(postData);
req.end();
