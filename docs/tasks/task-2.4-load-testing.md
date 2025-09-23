# Задача 2.4: Нагрузочное тестирование

## 📋 Описание
Провести нагрузочное тестирование API endpoints, проверить обработку webhookов с реальными событиями Stripe, протестировать capture/release операции и обработку ошибок Stripe API.

## 🎯 Цели
- Убедиться в стабильности под нагрузкой
- Определить пределы производительности
- Проверить корректность работы при высокой нагрузке

## 🔧 Технические требования

### 1. Настройка инструментов тестирования
```bash
# Установка инструментов
npm install -g artillery k6
npm install --save-dev jest supertest
```

### 2. Artillery конфигурация
Файл: `tests/load/artillery-config.yml`

```yaml
config:
  target: 'https://stripe-deposit.vercel.app'
  phases:
    # Warm-up phase
    - duration: 60
      arrivalRate: 1
      name: "Warm up"
    
    # Ramp up phase
    - duration: 120
      arrivalRate: 1
      rampTo: 10
      name: "Ramp up load"
    
    # Sustained load
    - duration: 300
      arrivalRate: 10
      name: "Sustained load"
    
    # Peak load
    - duration: 120
      arrivalRate: 10
      rampTo: 50
      name: "Peak load"
    
    # Cool down
    - duration: 60
      arrivalRate: 50
      rampTo: 1
      name: "Cool down"
  
  defaults:
    headers:
      Content-Type: 'application/json'
  
  variables:
    testToken: 'your-test-jwt-token'
    testCustomerId: 'cus_test_customer'

scenarios:
  - name: "API Load Test"
    weight: 100
    flow:
      # Health check
      - get:
          url: "/api/health"
          expect:
            - statusCode: 200
      
      # Get deposits (authenticated)
      - get:
          url: "/api/deposits"
          headers:
            Authorization: "Bearer {{ testToken }}"
          expect:
            - statusCode: [200, 401]
      
      # Create deposit
      - post:
          url: "/api/deposits"
          headers:
            Authorization: "Bearer {{ testToken }}"
          json:
            amount: 100
            customerId: "{{ testCustomerId }}"
            cardNumber: "4242424242424242"
            expMonth: 12
            expYear: 2025
            cvc: "123"
          expect:
            - statusCode: [201, 400, 401]
      
      # Simulate thinking time
      - think: 2
```

### 3. K6 тестовые сценарии
Файл: `tests/load/k6-test.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = 'https://stripe-deposit.vercel.app';
const TEST_TOKEN = 'your-test-jwt-token';

export default function () {
  // Test health endpoint
  let response = http.get(`${BASE_URL}/api/health`);
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // Test authenticated endpoint
  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json',
  };
  
  response = http.get(`${BASE_URL}/api/deposits`, { headers });
  const isSuccess = check(response, {
    'deposits endpoint accessible': (r) => r.status === 200 || r.status === 401,
    'deposits response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  if (!isSuccess) {
    errorRate.add(1);
  }
  
  // Test deposit creation (with test data)
  const depositPayload = {
    amount: Math.floor(Math.random() * 1000) + 10, // Random amount 10-1010
    customerId: 'cus_test_customer',
    cardNumber: '4242424242424242',
    expMonth: 12,
    expYear: 2025,
    cvc: '123'
  };
  
  response = http.post(`${BASE_URL}/api/deposits`, JSON.stringify(depositPayload), { headers });
  check(response, {
    'deposit creation handled': (r) => [200, 201, 400, 401].includes(r.status),
    'deposit creation response time < 3000ms': (r) => r.timings.duration < 3000,
  });
  
  sleep(1); // Think time between requests
}
```

### 4. Jest интеграционные тесты
Файл: `tests/integration/api.test.js`

```javascript
const request = require('supertest');
const app = require('../../app'); // Если есть Express app

describe('API Load Integration Tests', () => {
  const testToken = 'your-test-jwt-token';
  
  test('Health endpoint should handle concurrent requests', async () => {
    const promises = Array(50).fill().map(() => 
      request(app).get('/api/health')
    );
    
    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });
  });
  
  test('Deposits endpoint should handle rate limiting', async () => {
    const promises = Array(20).fill().map(() => 
      request(app)
        .get('/api/deposits')
        .set('Authorization', `Bearer ${testToken}`)
    );
    
    const responses = await Promise.all(promises);
    
    // Some requests should be rate limited
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
  
  test('Concurrent deposit creation should be handled gracefully', async () => {
    const depositData = {
      amount: 100,
      customerId: 'cus_test_customer',
      cardNumber: '4242424242424242',
      expMonth: 12,
      expYear: 2025,
      cvc: '123'
    };
    
    const promises = Array(10).fill().map(() => 
      request(app)
        .post('/api/deposits')
        .set('Authorization', `Bearer ${testToken}`)
        .send(depositData)
    );
    
    const responses = await Promise.all(promises);
    
    // All requests should be handled (success or proper error)
    responses.forEach(response => {
      expect([200, 201, 400, 401, 429, 500]).toContain(response.status);
    });
  });
});
```

### 5. Webhook нагрузочное тестирование
Файл: `tests/load/webhook-test.js`

```javascript
import http from 'k6/http';
import { check } from 'k6';
import crypto from 'k6/crypto';

export const options = {
  vus: 10, // 10 virtual users
  duration: '2m',
};

const WEBHOOK_URL = 'https://stripe-deposit.vercel.app/api/webhook';
const WEBHOOK_SECRET = 'whsec_test_secret';

function createStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');
  return `t=${timestamp},v1=${signature}`;
}

export default function () {
  const webhookPayload = JSON.stringify({
    id: `evt_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: `pi_${Math.random().toString(36).substr(2, 9)}`,
        object: 'payment_intent',
        status: 'succeeded',
        metadata: {
          depositId: `dep_${Math.random().toString(36).substr(2, 9)}`
        }
      }
    },
    created: Math.floor(Date.now() / 1000)
  });
  
  const signature = createStripeSignature(webhookPayload, WEBHOOK_SECRET);
  
  const response = http.post(WEBHOOK_URL, webhookPayload, {
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
  });
  
  check(response, {
    'webhook processed successfully': (r) => r.status === 200,
    'webhook response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}
```

### 6. Database нагрузочное тестирование
Файл: `tests/load/database-test.js`

```javascript
import { Database } from '../../lib/database.js';

export const options = {
  vus: 20,
  duration: '3m',
};

export default async function () {
  try {
    // Test concurrent reads
    const deposits = await Database.getDepositsByUserId('test-user-id', 10);
    
    // Test concurrent writes
    const depositData = {
      stripe_payment_intent_id: `pi_test_${Math.random().toString(36).substr(2, 9)}`,
      user_id: 'test-user-id',
      customer_id: 'test-customer-id',
      amount: Math.floor(Math.random() * 10000) + 1000,
      status: 'pending'
    };
    
    const deposit = await Database.createDeposit(depositData);
    
    // Test updates
    await Database.updateDepositStatus(deposit.id, 'captured');
    
  } catch (error) {
    console.error('Database operation failed:', error);
  }
}
```

### 7. Мониторинг во время тестирования
Файл: `tests/load/monitor.js`

```javascript
// Скрипт для мониторинга системы во время нагрузочного тестирования
const axios = require('axios');

class LoadTestMonitor {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.metrics = [];
  }
  
  async startMonitoring(intervalMs = 5000) {
    console.log('Starting load test monitoring...');
    
    this.interval = setInterval(async () => {
      try {
        const healthResponse = await axios.get(`${this.baseUrl}/api/health`);
        const metric = {
          timestamp: new Date().toISOString(),
          responseTime: healthResponse.duration,
          status: healthResponse.data.status,
          checks: healthResponse.data.checks
        };
        
        this.metrics.push(metric);
        console.log(`Health check: ${metric.status} (${metric.responseTime}ms)`);
        
      } catch (error) {
        console.error('Health check failed:', error.message);
        this.metrics.push({
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }, intervalMs);
  }
  
  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('Monitoring stopped');
    }
  }
  
  getReport() {
    const totalChecks = this.metrics.length;
    const failedChecks = this.metrics.filter(m => m.error).length;
    const avgResponseTime = this.metrics
      .filter(m => m.responseTime)
      .reduce((sum, m) => sum + m.responseTime, 0) / (totalChecks - failedChecks);
    
    return {
      totalChecks,
      failedChecks,
      successRate: ((totalChecks - failedChecks) / totalChecks * 100).toFixed(2),
      avgResponseTime: avgResponseTime.toFixed(2)
    };
  }
}

module.exports = LoadTestMonitor;
```

## 📝 Шаги выполнения

### Шаг 1: Подготовка тестовой среды
1. Создать test API ключи
2. Настроить test database
3. Подготовить test данные

### Шаг 2: Настройка инструментов
1. Установить Artillery и K6
2. Создать конфигурационные файлы
3. Настроить мониторинг

### Шаг 3: Базовое тестирование
1. Запустить простые тесты
2. Проверить health endpoints
3. Тестировать отдельные endpoints

### Шаг 4: Нагрузочное тестирование
1. Запустить Artillery тесты
2. Запустить K6 тесты
3. Мониторить производительность

### Шаг 5: Анализ результатов
1. Собрать метрики
2. Проанализировать bottlenecks
3. Оптимизировать проблемные места

## ✅ Критерии готовности
- [ ] Инструменты тестирования настроены
- [ ] Базовые тесты проходят
- [ ] Нагрузочные тесты выполнены
- [ ] Webhook тестирование завершено
- [ ] Результаты проанализированы
- [ ] Bottlenecks выявлены и устранены

## 🧪 Команды для запуска тестов

### Artillery
```bash
artillery run tests/load/artillery-config.yml
```

### K6
```bash
k6 run tests/load/k6-test.js
```

### Jest
```bash
npm test tests/integration/
```

### Webhook тестирование
```bash
k6 run tests/load/webhook-test.js
```

## 🚨 Важные замечания
- Использовать только test environment
- Мониторить ресурсы во время тестов
- Не тестировать на production
- Подготовить rollback план
- Уведомить команду о тестировании

## 📚 Полезные ссылки
- [Artillery Documentation](https://artillery.io/docs/)
- [K6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-best-practices/)

## 🔍 Проверка результата
После выполнения:
1. Система выдерживает ожидаемую нагрузку
2. Response times в приемлемых пределах
3. Error rates минимальны
4. Bottlenecks выявлены и устранены
