# Задача 1.3: Исправление авторизации API

## 📋 Описание
Исправить проблему с авторизацией для /api/deposits endpoint - сейчас возвращает 200 без токена. Добавить проверку JWT токена и корректную обработку ошибок авторизации.

## 🎯 Цели
- Обеспечить безопасность API endpoints
- Реализовать корректную JWT авторизацию
- Добавить proper error handling для неавторизованных запросов

## 🔧 Технические требования

### 1. Middleware для проверки авторизации
Создать файл: `lib/auth-middleware.js`

```javascript
import jwt from 'jsonwebtoken';

export function verifyToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function requireAuth(handler) {
  return async (req, res) => {
    try {
      const user = verifyToken(req);
      req.user = user;
      return await handler(req, res);
    } catch (error) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: error.message 
      });
    }
  };
}
```

### 2. Обновление API endpoints
Файл: `pages/api/deposits/index.js`

```javascript
import { requireAuth } from '../../../lib/auth-middleware';

async function handler(req, res) {
  // Проверка авторизации уже выполнена в middleware
  const userId = req.user.id;
  
  if (req.method === 'GET') {
    return await getDeposits(req, res, userId);
  } else if (req.method === 'POST') {
    return await createDeposit(req, res, userId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getDeposits(req, res, userId) {
  try {
    // Получить депозиты только для авторизованного пользователя
    const deposits = await getDepositsByUserId(userId);
    res.status(200).json({ deposits });
  } catch (error) {
    console.error('Error fetching deposits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createDeposit(req, res, userId) {
  try {
    const { amount, customerId, paymentMethodId } = req.body;
    
    // Валидация входных данных
    if (!amount || !customerId || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'customerId', 'paymentMethodId']
      });
    }
    
    // Создание депозита для авторизованного пользователя
    const deposit = await createDepositForUser(userId, {
      amount,
      customerId,
      paymentMethodId
    });
    
    res.status(201).json({ deposit });
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default requireAuth(handler);
```

### 3. Обновление других protected endpoints
Файлы для обновления:
- `pages/api/deposits/[id]/capture.js`
- `pages/api/deposits/[id]/release.js`
- `pages/api/deposits/[id]/index.js`

```javascript
// Пример для capture.js
import { requireAuth } from '../../../../lib/auth-middleware';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const userId = req.user.id;
  
  try {
    // Проверить, что депозит принадлежит пользователю
    const deposit = await getDepositById(id);
    if (!deposit || deposit.userId !== userId) {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    
    // Выполнить capture
    const result = await captureDeposit(id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error capturing deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default requireAuth(handler);
```

### 4. Настройка JWT Secret
```bash
# Добавить в Vercel Environment Variables
JWT_SECRET=your-super-secret-jwt-key-here
```

### 5. Обновление frontend для отправки токенов
```javascript
// utils/api.js
export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };
  
  const response = await fetch(endpoint, config);
  
  if (response.status === 401) {
    // Redirect to login or refresh token
    window.location.href = '/login';
    return;
  }
  
  return response;
}
```

## 📝 Шаги выполнения

### Шаг 1: Создание auth middleware
1. Создать `lib/auth-middleware.js`
2. Реализовать функции verifyToken и requireAuth
3. Добавить proper error handling

### Шаг 2: Обновление API endpoints
1. Обновить `pages/api/deposits/index.js`
2. Обновить все protected endpoints
3. Добавить проверку ownership для ресурсов

### Шаг 3: Настройка JWT Secret
1. Сгенерировать secure JWT secret
2. Добавить в Vercel Environment Variables
3. Обновить код для использования secret

### Шаг 4: Обновление frontend
1. Обновить API calls для отправки токенов
2. Добавить обработку 401 ошибок
3. Реализовать redirect на login

### Шаг 5: Тестирование
1. Тестирование без токена (должно возвращать 401)
2. Тестирование с invalid токеном (должно возвращать 401)
3. Тестирование с valid токеном (должно работать)

## ✅ Критерии готовности
- [ ] Auth middleware создан и работает
- [ ] Все protected endpoints требуют авторизацию
- [ ] JWT secret настроен в Vercel
- [ ] Frontend отправляет токены в headers
- [ ] 401 ошибки корректно обрабатываются
- [ ] Ownership проверяется для всех ресурсов

## 🧪 Тестирование

### Тестирование без токена
```bash
curl -X GET https://stripe-deposit.vercel.app/api/deposits
# Ожидаемый результат: 401 Unauthorized
```

### Тестирование с токеном
```bash
curl -X GET https://stripe-deposit.vercel.app/api/deposits \
  -H "Authorization: Bearer your-jwt-token"
# Ожидаемый результат: 200 OK с данными
```

### Тестирование invalid токена
```bash
curl -X GET https://stripe-deposit.vercel.app/api/deposits \
  -H "Authorization: Bearer invalid-token"
# Ожидаемый результат: 401 Unauthorized
```

## 🚨 Важные замечания
- JWT secret должен быть криптографически стойким
- Токены должны иметь разумный срок действия
- Проверять ownership для всех ресурсов
- Логировать попытки неавторизованного доступа
- Не возвращать sensitive информацию в error messages

## 📚 Полезные ссылки
- [JWT.io](https://jwt.io/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Node.js jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)

## 🔍 Проверка результата
После выполнения:
1. API возвращает 401 для неавторизованных запросов
2. Valid токены позволяют доступ к ресурсам
3. Пользователи видят только свои депозиты
4. Error handling работает корректно
