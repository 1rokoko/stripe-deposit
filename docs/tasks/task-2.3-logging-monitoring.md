# Задача 2.3: Логирование и мониторинг

## 📋 Описание
Добавить комплексное логирование всех операций с депозитами, ошибок и событий безопасности. Настроить мониторинг производительности и алерты при критических ошибках.

## 🎯 Цели
- Обеспечить полную видимость операций системы
- Настроить alerting для критических событий
- Создать dashboard для мониторинга

## 🔧 Технические требования

### 1. Структурированное логирование
Файл: `lib/logger.js`

```javascript
import winston from 'winston';

// Конфигурация логгера
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'stripe-deposit',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console для development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Добавляем external logging для production
if (process.env.NODE_ENV === 'production') {
  // Можно добавить Datadog, LogRocket, или другие сервисы
  logger.add(new winston.transports.Http({
    host: process.env.LOG_HOST,
    port: process.env.LOG_PORT,
    path: '/logs'
  }));
}

// Специализированные методы логирования
export const Logger = {
  // Операции с депозитами
  depositCreated: (depositId, userId, amount) => {
    logger.info('Deposit created', {
      event: 'deposit_created',
      depositId,
      userId,
      amount,
      timestamp: new Date().toISOString()
    });
  },
  
  depositCaptured: (depositId, amount, chargeId) => {
    logger.info('Deposit captured', {
      event: 'deposit_captured',
      depositId,
      amount,
      chargeId,
      timestamp: new Date().toISOString()
    });
  },
  
  depositReleased: (depositId, reason) => {
    logger.info('Deposit released', {
      event: 'deposit_released',
      depositId,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  
  // Ошибки
  depositError: (operation, depositId, error, context = {}) => {
    logger.error('Deposit operation failed', {
      event: 'deposit_error',
      operation,
      depositId,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  },
  
  // Безопасность
  authFailure: (userId, ip, reason) => {
    logger.warn('Authentication failed', {
      event: 'auth_failure',
      userId,
      ip,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  
  rateLimitExceeded: (userId, ip, endpoint) => {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      userId,
      ip,
      endpoint,
      timestamp: new Date().toISOString()
    });
  },
  
  suspiciousActivity: (userId, activity, details) => {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  // Производительность
  performanceMetric: (operation, duration, success) => {
    logger.info('Performance metric', {
      event: 'performance_metric',
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  // Webhook события
  webhookReceived: (eventType, eventId, processed) => {
    logger.info('Webhook received', {
      event: 'webhook_received',
      eventType,
      eventId,
      processed,
      timestamp: new Date().toISOString()
    });
  },
  
  // Общие методы
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, error, meta = {}) => {
    logger.error(message, {
      error: error?.message,
      stack: error?.stack,
      ...meta
    });
  }
};

export default Logger;
```

### 2. Performance Monitoring
Файл: `lib/performance-monitor.js`

```javascript
import { Logger } from './logger';

// Middleware для измерения производительности
export function performanceMonitor(req, res, next) {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    Logger.performanceMetric(
      `${req.method} ${req.path}`,
      duration,
      success
    );
    
    // Алерт для медленных запросов
    if (duration > 5000) {
      Logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
}

// Мониторинг базы данных
export class DatabaseMonitor {
  static async executeWithMonitoring(operation, query, params = []) {
    const startTime = Date.now();
    
    try {
      const result = await operation(query, params);
      const duration = Date.now() - startTime;
      
      Logger.performanceMetric(`db_${operation.name}`, duration, true);
      
      if (duration > 1000) {
        Logger.warn('Slow database query', {
          operation: operation.name,
          query: query.substring(0, 100),
          duration
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.performanceMetric(`db_${operation.name}`, duration, false);
      Logger.error('Database operation failed', error, {
        operation: operation.name,
        query: query.substring(0, 100)
      });
      throw error;
    }
  }
}

// Мониторинг Stripe API
export class StripeMonitor {
  static async executeWithMonitoring(operation, ...args) {
    const startTime = Date.now();
    const operationName = operation.name || 'stripe_operation';
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      Logger.performanceMetric(`stripe_${operationName}`, duration, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.performanceMetric(`stripe_${operationName}`, duration, false);
      Logger.error('Stripe operation failed', error, {
        operation: operationName,
        stripeError: error.type,
        stripeCode: error.code
      });
      throw error;
    }
  }
}
```

### 3. Error Tracking
Файл: `lib/error-tracker.js`

```javascript
import { Logger } from './logger';

// Централизованная обработка ошибок
export class ErrorTracker {
  static track(error, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
      timestamp: new Date().toISOString()
    };
    
    // Классификация ошибок
    if (this.isCriticalError(error)) {
      this.sendAlert(errorInfo);
    }
    
    Logger.error('Error tracked', error, context);
    
    // Отправка в external error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(errorInfo);
    }
  }
  
  static isCriticalError(error) {
    const criticalPatterns = [
      /database.*connection/i,
      /stripe.*api.*error/i,
      /payment.*failed/i,
      /webhook.*verification.*failed/i
    ];
    
    return criticalPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.stack)
    );
  }
  
  static async sendAlert(errorInfo) {
    // Отправка в Slack, email, или другой alerting service
    try {
      if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Critical Error in Stripe Deposit App`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Error', value: errorInfo.message, short: false },
                { title: 'Context', value: JSON.stringify(errorInfo.context), short: false },
                { title: 'Time', value: errorInfo.timestamp, short: true }
              ]
            }]
          })
        });
      }
    } catch (alertError) {
      Logger.error('Failed to send alert', alertError);
    }
  }
  
  static sendToExternalService(errorInfo) {
    // Интеграция с Sentry, Bugsnag, или другими сервисами
    // Пример для Sentry:
    // Sentry.captureException(error, { extra: errorInfo.context });
  }
}

// Middleware для автоматического отслеживания ошибок
export function errorTrackingMiddleware(err, req, res, next) {
  ErrorTracker.track(err, {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    ip: req.ip
  });
  
  // Не раскрываем внутренние ошибки в production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
```

### 4. Health Check Endpoint
Файл: `pages/api/health.js`

```javascript
import { Database } from '../../lib/database';
import { Logger } from '../../lib/logger';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  try {
    // Проверка базы данных
    const dbStart = Date.now();
    await Database.healthCheck();
    healthCheck.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart
    };
  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  try {
    // Проверка Stripe API
    const stripeStart = Date.now();
    await stripe.balance.retrieve();
    healthCheck.checks.stripe = {
      status: 'healthy',
      responseTime: Date.now() - stripeStart
    };
  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.checks.stripe = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  // Проверка памяти
  const memUsage = process.memoryUsage();
  healthCheck.checks.memory = {
    status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning', // 500MB
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal
  };
  
  Logger.info('Health check performed', healthCheck);
  
  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
}
```

### 5. Metrics Collection
Файл: `lib/metrics.js`

```javascript
import { Logger } from './logger';

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }
  
  increment(metric, value = 1, tags = {}) {
    const key = this.getMetricKey(metric, tags);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
    
    Logger.info('Metric incremented', {
      metric,
      value: current + value,
      tags
    });
  }
  
  gauge(metric, value, tags = {}) {
    const key = this.getMetricKey(metric, tags);
    this.metrics.set(key, value);
    
    Logger.info('Metric gauge', {
      metric,
      value,
      tags
    });
  }
  
  timing(metric, duration, tags = {}) {
    Logger.info('Metric timing', {
      metric,
      duration,
      tags
    });
  }
  
  getMetricKey(metric, tags) {
    const tagString = Object.entries(tags)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${metric}${tagString ? `|${tagString}` : ''}`;
  }
  
  getSnapshot() {
    return {
      uptime: Date.now() - this.startTime,
      metrics: Object.fromEntries(this.metrics)
    };
  }
}

export const Metrics = new MetricsCollector();

// Предопределенные метрики
export const MetricNames = {
  DEPOSITS_CREATED: 'deposits.created',
  DEPOSITS_CAPTURED: 'deposits.captured',
  DEPOSITS_RELEASED: 'deposits.released',
  DEPOSITS_FAILED: 'deposits.failed',
  API_REQUESTS: 'api.requests',
  API_ERRORS: 'api.errors',
  WEBHOOKS_RECEIVED: 'webhooks.received',
  WEBHOOKS_PROCESSED: 'webhooks.processed'
};
```

## 📝 Шаги выполнения

### Шаг 1: Установка зависимостей
```bash
npm install winston
```

### Шаг 2: Настройка логирования
1. Создать `lib/logger.js`
2. Настроить structured logging
3. Добавить external logging для production

### Шаг 3: Добавление мониторинга
1. Создать performance monitoring
2. Добавить error tracking
3. Создать health check endpoint

### Шаг 4: Интеграция в API
1. Добавить логирование во все endpoints
2. Добавить performance monitoring middleware
3. Настроить error tracking

### Шаг 5: Настройка алертов
1. Настроить Slack webhook для критических ошибок
2. Создать dashboard для метрик
3. Настроить мониторинг uptime

## ✅ Критерии готовности
- [ ] Structured logging настроено
- [ ] Performance monitoring работает
- [ ] Error tracking функционирует
- [ ] Health check endpoint создан
- [ ] Алерты настроены
- [ ] Метрики собираются

## 🧪 Тестирование

### Тестирование логирования
```javascript
// Проверка логов
Logger.depositCreated('dep_123', 'user_456', 10000);
Logger.depositError('capture', 'dep_123', new Error('Test error'));
```

### Тестирование health check
```bash
curl https://stripe-deposit.vercel.app/api/health
```

## 🚨 Важные замечания
- Не логировать sensitive данные (номера карт, токены)
- Настроить log rotation для больших объемов
- Мониторить размер логов
- Регулярно проверять алерты
- Использовать structured logging для лучшего анализа

## 📚 Полезные ссылки
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Vercel Analytics](https://vercel.com/analytics)
- [Datadog APM](https://www.datadoghq.com/product/apm/)

## 🔍 Проверка результата
После выполнения:
1. Все операции логируются
2. Performance metrics собираются
3. Критические ошибки вызывают алерты
4. Health check показывает статус системы
