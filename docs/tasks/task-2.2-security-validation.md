# Задача 2.2: Улучшение безопасности и валидации

## 📋 Описание
Улучшить валидацию входных данных (customer ID, payment methods, суммы). Добавить rate limiting по пользователям, настроить HTTPS и SSL сертификаты, добавить защиту от CSRF атак.

## 🎯 Цели
- Обеспечить безопасность API endpoints
- Защитить от распространенных атак
- Реализовать comprehensive валидацию данных

## 🔧 Технические требования

### 1. Валидация входных данных
Файл: `lib/validation.js`

```javascript
import Joi from 'joi';

// Схемы валидации
export const schemas = {
  createDeposit: Joi.object({
    amount: Joi.number().min(1).max(1000000).required(),
    customerId: Joi.string().uuid().required(),
    cardNumber: Joi.string().creditCard().required(),
    expMonth: Joi.number().min(1).max(12).required(),
    expYear: Joi.number().min(new Date().getFullYear()).max(new Date().getFullYear() + 20).required(),
    cvc: Joi.string().pattern(/^\d{3,4}$/).required()
  }),
  
  captureDeposit: Joi.object({
    id: Joi.string().uuid().required(),
    amount: Joi.number().min(1).optional()
  }),
  
  releaseDeposit: Joi.object({
    id: Joi.string().uuid().required(),
    reason: Joi.string().max(500).optional()
  }),
  
  updateUser: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    email: Joi.string().email().optional()
  })
};

// Middleware для валидации
export function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.validatedData = value;
    next();
  };
}

// Дополнительные валидаторы
export const validators = {
  isValidStripeCustomerId: (id) => {
    return typeof id === 'string' && id.startsWith('cus_');
  },
  
  isValidAmount: (amount) => {
    return Number.isInteger(amount) && amount > 0 && amount <= 1000000;
  },
  
  isValidCurrency: (currency) => {
    const supportedCurrencies = ['usd', 'eur', 'gbp'];
    return supportedCurrencies.includes(currency.toLowerCase());
  },
  
  sanitizeString: (str) => {
    return str.trim().replace(/[<>]/g, '');
  }
};
```

### 2. Rate Limiting
Файл: `lib/rate-limiter.js`

```javascript
import { LRUCache } from 'lru-cache';

// Кеш для хранения счетчиков запросов
const rateLimitCache = new LRUCache({
  max: 10000, // максимум 10k пользователей
  ttl: 1000 * 60 * 15, // 15 минут
});

// Конфигурация лимитов
const RATE_LIMITS = {
  default: { requests: 100, window: 15 * 60 * 1000 }, // 100 запросов за 15 минут
  deposits: { requests: 10, window: 60 * 1000 }, // 10 депозитов за минуту
  auth: { requests: 5, window: 15 * 60 * 1000 }, // 5 попыток авторизации за 15 минут
};

export function rateLimit(type = 'default') {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default;
  
  return (req, res, next) => {
    const identifier = req.user?.id || req.ip;
    const key = `${type}:${identifier}`;
    
    const current = rateLimitCache.get(key) || { count: 0, resetTime: Date.now() + config.window };
    
    // Сброс счетчика если окно истекло
    if (Date.now() > current.resetTime) {
      current.count = 0;
      current.resetTime = Date.now() + config.window;
    }
    
    current.count++;
    rateLimitCache.set(key, current);
    
    // Проверка лимита
    if (current.count > config.requests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((current.resetTime - Date.now()) / 1000)
      });
    }
    
    // Добавление headers
    res.setHeader('X-RateLimit-Limit', config.requests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.requests - current.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000));
    
    next();
  };
}

// IP-based rate limiting для неавторизованных запросов
export function ipRateLimit() {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `ip:${ip}`;
    
    const current = rateLimitCache.get(key) || { count: 0, resetTime: Date.now() + 60000 };
    
    if (Date.now() > current.resetTime) {
      current.count = 0;
      current.resetTime = Date.now() + 60000;
    }
    
    current.count++;
    rateLimitCache.set(key, current);
    
    if (current.count > 50) { // 50 запросов в минуту с IP
      return res.status(429).json({
        error: 'Too many requests from this IP'
      });
    }
    
    next();
  };
}
```

### 3. CSRF Protection
Файл: `lib/csrf-protection.js`

```javascript
import crypto from 'crypto';

// Генерация CSRF токена
export function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware для проверки CSRF токена
export function csrfProtection(req, res, next) {
  // Пропускаем GET запросы
  if (req.method === 'GET') {
    return next();
  }
  
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body.csrfToken;
  const sessionToken = req.session?.csrfToken;
  
  const providedToken = tokenFromHeader || tokenFromBody;
  
  if (!providedToken || !sessionToken || providedToken !== sessionToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed'
    });
  }
  
  next();
}

// Endpoint для получения CSRF токена
export async function getCSRFToken(req, res) {
  const token = generateCSRFToken();
  
  // Сохраняем в сессии (или в базе данных)
  req.session = req.session || {};
  req.session.csrfToken = token;
  
  res.status(200).json({ csrfToken: token });
}
```

### 4. Security Headers
Файл: `lib/security-headers.js`

```javascript
export function securityHeaders(req, res, next) {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.stripe.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.stripe.com; " +
    "frame-src https://js.stripe.com;"
  );
  
  // Другие security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS (только для HTTPS)
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}
```

### 5. Input Sanitization
Файл: `lib/sanitization.js`

```javascript
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export const sanitizers = {
  // Очистка HTML
  cleanHTML: (input) => {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  },
  
  // Очистка SQL injection
  cleanSQL: (input) => {
    return validator.escape(input);
  },
  
  // Очистка email
  cleanEmail: (email) => {
    return validator.normalizeEmail(email) || '';
  },
  
  // Очистка номера телефона
  cleanPhone: (phone) => {
    return phone.replace(/[^\d+\-\(\)\s]/g, '');
  },
  
  // Общая очистка строки
  cleanString: (str) => {
    if (typeof str !== 'string') return '';
    return str.trim()
              .replace(/[<>]/g, '')
              .substring(0, 1000); // Ограничение длины
  }
};

// Middleware для автоматической очистки
export function sanitizeRequest(req, res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
}

function sanitizeObject(obj) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizers.cleanString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
```

### 6. Обновление API endpoints с security middleware
Файл: `pages/api/deposits/index.js`

```javascript
import { requireAuth } from '../../../lib/auth-middleware';
import { validateRequest, schemas } from '../../../lib/validation';
import { rateLimit } from '../../../lib/rate-limiter';
import { sanitizeRequest } from '../../../lib/sanitization';
import { securityHeaders } from '../../../lib/security-headers';

async function handler(req, res) {
  // Security headers уже применены в middleware
  
  if (req.method === 'POST') {
    return await createDeposit(req, res);
  } else if (req.method === 'GET') {
    return await getDeposits(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createDeposit(req, res) {
  try {
    const { amount, customerId, cardNumber, expMonth, expYear, cvc } = req.validatedData;
    
    // Дополнительная валидация
    if (!validators.isValidAmount(amount * 100)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Создание депозита...
    // (код создания депозита)
    
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Применение middleware в правильном порядке
export default securityHeaders(
  sanitizeRequest(
    rateLimit('deposits')(
      requireAuth(
        validateRequest(schemas.createDeposit)(handler)
      )
    )
  )
);
```

## 📝 Шаги выполнения

### Шаг 1: Установка зависимостей
```bash
npm install joi lru-cache isomorphic-dompurify validator
```

### Шаг 2: Создание security middleware
1. Создать все файлы в `lib/`
2. Реализовать валидацию, rate limiting, CSRF protection
3. Добавить security headers

### Шаг 3: Обновление API endpoints
1. Применить middleware ко всем endpoints
2. Добавить валидацию для всех входных данных
3. Обновить error handling

### Шаг 4: Настройка HTTPS
1. Убедиться, что Vercel использует HTTPS
2. Настроить redirect с HTTP на HTTPS
3. Добавить HSTS headers

### Шаг 5: Тестирование безопасности
1. Тестирование rate limiting
2. Проверка валидации
3. Тестирование CSRF protection

## ✅ Критерии готовности
- [ ] Валидация входных данных реализована
- [ ] Rate limiting работает
- [ ] CSRF protection настроена
- [ ] Security headers добавлены
- [ ] Input sanitization работает
- [ ] HTTPS настроен

## 🧪 Тестирование безопасности

### Тестирование rate limiting
```bash
# Множественные запросы для проверки лимитов
for i in {1..15}; do
  curl -X POST https://stripe-deposit.vercel.app/api/deposits
done
```

### Тестирование валидации
```bash
# Невалидные данные
curl -X POST https://stripe-deposit.vercel.app/api/deposits \
  -H "Content-Type: application/json" \
  -d '{"amount": -100, "customerId": "invalid"}'
```

## 🚨 Важные замечания
- Регулярно обновлять security dependencies
- Мониторить security logs
- Проводить регулярные security audits
- Использовать HTTPS везде
- Не логировать sensitive данные

## 📚 Полезные ссылки
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Joi Validation](https://joi.dev/api/)

## 🔍 Проверка результата
После выполнения:
1. API защищен от основных атак
2. Rate limiting предотвращает abuse
3. Валидация блокирует невалидные данные
4. Security headers настроены корректно
