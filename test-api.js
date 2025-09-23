const https = require('https');

const baseUrl = 'https://stripe-deposit-lyw429imw-phuket1.vercel.app';
const authToken = '+wHLpI2G1rV+VFmAk7mdomTDVf+glkljgtJiksmRft8=';

async function testEndpoint(path, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'GET',
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function runTests() {
    console.log('🧪 Тестирование API endpoints...\n');

    // Test 1: Health check
    console.log('1️⃣ Тестирование /healthz');
    try {
        const result = await testEndpoint('/healthz');
        console.log(`   Статус: ${result.status}`);
        console.log(`   Ответ: ${result.body}`);
    } catch (error) {
        console.log(`   Ошибка: ${error.message}`);
    }

    // Test 2: Main endpoint (should show Stripe error)
    console.log('\n2️⃣ Тестирование / (основной endpoint)');
    try {
        const result = await testEndpoint('/');
        console.log(`   Статус: ${result.status}`);
        console.log(`   Ответ: ${result.body}`);
    } catch (error) {
        console.log(`   Ошибка: ${error.message}`);
    }

    // Test 3: Metrics without auth
    console.log('\n3️⃣ Тестирование /metrics без авторизации');
    try {
        const result = await testEndpoint('/metrics');
        console.log(`   Статус: ${result.status}`);
        console.log(`   Ответ: ${result.body}`);
    } catch (error) {
        console.log(`   Ошибка: ${error.message}`);
    }

    // Test 4: Metrics with auth
    console.log('\n4️⃣ Тестирование /metrics с авторизацией');
    try {
        const result = await testEndpoint('/metrics', {
            'Authorization': `Bearer ${authToken}`
        });
        console.log(`   Статус: ${result.status}`);
        console.log(`   Ответ: ${result.body}`);
    } catch (error) {
        console.log(`   Ошибка: ${error.message}`);
    }

    console.log('\n✅ Тестирование завершено!');
}

runTests().catch(console.error);
