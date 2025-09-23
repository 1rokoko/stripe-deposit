# Задача 2.1: Настройка постоянного хранилища данных

## 📋 Описание
Заменить memory storage на постоянное хранилище (PostgreSQL/MongoDB). Настроить базу данных на Vercel/Supabase/PlanetScale, создать схему для хранения депозитов, клиентов и транзакций.

## 🎯 Цели
- Обеспечить постоянное хранение данных
- Создать масштабируемую архитектуру базы данных
- Подготовить инфраструктуру для production

## 🔧 Технические требования

### 1. Выбор базы данных: PostgreSQL на Supabase

### 2. Схема базы данных
```sql
-- Таблица пользователей
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица клиентов Stripe
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица депозитов
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- в центах
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_method_id VARCHAR(255),
  captured_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица транзакций (для аудита)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID REFERENCES deposits(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'create', 'capture', 'release', 'refund'
  status VARCHAR(50) NOT NULL,
  amount INTEGER,
  stripe_charge_id VARCHAR(255),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_deposits_user_id ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposits_created_at ON deposits(created_at);
CREATE INDEX idx_transactions_deposit_id ON transactions(deposit_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_stripe_id ON customers(stripe_customer_id);
```

### 3. Настройка подключения к базе данных
Файл: `lib/database.js`

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database helper functions
export class Database {
  // Users
  static async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async getUserById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
  
  // Customers
  static async createCustomer(customerData) {
    const { data, error } = await supabase
      .from('customers')
      .insert([customerData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async getCustomerByStripeId(stripeCustomerId) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  // Deposits
  static async createDeposit(depositData) {
    const { data, error } = await supabase
      .from('deposits')
      .insert([{
        ...depositData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async getDepositById(id) {
    const { data, error } = await supabase
      .from('deposits')
      .select(`
        *,
        customer:customers(*),
        user:users(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async getDepositsByUserId(userId, limit = 50, offset = 0) {
    const { data, error } = await supabase
      .from('deposits')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return data;
  }
  
  static async updateDepositStatus(id, status, additionalData = {}) {
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };
    
    if (status === 'captured') {
      updateData.captured_at = new Date().toISOString();
    } else if (status === 'released') {
      updateData.released_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('deposits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  // Transactions
  static async createTransaction(transactionData) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        ...transactionData,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async getTransactionsByDepositId(depositId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('deposit_id', depositId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
}
```

### 4. Обновление API endpoints
Файл: `pages/api/deposits/index.js`

```javascript
import { Database } from '../../../lib/database';
import { requireAuth } from '../../../lib/auth-middleware';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
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
    const { limit = 50, offset = 0 } = req.query;
    const deposits = await Database.getDepositsByUserId(
      userId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.status(200).json({ deposits });
  } catch (error) {
    console.error('Error fetching deposits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createDeposit(req, res, userId) {
  try {
    const { amount, customerId, cardNumber, expMonth, expYear, cvc } = req.body;
    
    // Создание Payment Method
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardNumber,
        exp_month: expMonth || 12,
        exp_year: expYear || 2025,
        cvc: cvc || '123',
      },
    });
    
    // Создание Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      payment_method: paymentMethod.id,
      capture_method: 'manual',
      metadata: {
        userId: userId,
        customerId: customerId
      },
    });
    
    // Сохранение в базе данных
    const deposit = await Database.createDeposit({
      stripe_payment_intent_id: paymentIntent.id,
      user_id: userId,
      customer_id: customerId,
      amount: amount * 100,
      status: 'pending',
      payment_method_id: paymentMethod.id,
      metadata: {
        stripe_payment_intent_id: paymentIntent.id
      }
    });
    
    // Создание записи транзакции
    await Database.createTransaction({
      deposit_id: deposit.id,
      type: 'create',
      status: 'success',
      amount: amount * 100,
      metadata: {
        payment_intent_id: paymentIntent.id,
        payment_method_id: paymentMethod.id
      }
    });
    
    res.status(201).json({ 
      deposit,
      clientSecret: paymentIntent.client_secret 
    });
    
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ 
      error: 'Failed to create deposit',
      details: error.message 
    });
  }
}

export default requireAuth(handler);
```

### 5. Переменные окружения
```bash
# Добавить в Vercel
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📝 Шаги выполнения

### Шаг 1: Настройка Supabase
1. Создать проект на supabase.com
2. Получить URL и API keys
3. Настроить переменные окружения в Vercel

### Шаг 2: Создание схемы базы данных
1. Выполнить SQL скрипты в Supabase SQL Editor
2. Проверить создание таблиц и индексов
3. Настроить Row Level Security (RLS)

### Шаг 3: Создание database layer
1. Создать `lib/database.js`
2. Реализовать все CRUD операции
3. Добавить error handling

### Шаг 4: Обновление API endpoints
1. Заменить memory storage на database calls
2. Обновить все endpoints
3. Добавить транзакционность

### Шаг 5: Тестирование
1. Тестирование CRUD операций
2. Проверка производительности
3. Тестирование с реальными данными

## ✅ Критерии готовности
- [ ] Supabase проект настроен
- [ ] Схема базы данных создана
- [ ] Database layer реализован
- [ ] API endpoints обновлены
- [ ] Все операции работают с базой данных
- [ ] Производительность приемлема

## 🧪 Тестирование

### Тестирование подключения
```javascript
// test-database.js
import { Database } from '../lib/database';

async function testDatabase() {
  try {
    // Тест создания пользователя
    const user = await Database.createUser({
      email: 'test@example.com',
      name: 'Test User'
    });
    console.log('User created:', user);
    
    // Тест создания депозита
    const deposit = await Database.createDeposit({
      stripe_payment_intent_id: 'pi_test_123',
      user_id: user.id,
      amount: 10000,
      status: 'pending'
    });
    console.log('Deposit created:', deposit);
    
  } catch (error) {
    console.error('Database test failed:', error);
  }
}
```

## 🚨 Важные замечания
- Настроить Row Level Security в Supabase
- Использовать connection pooling для production
- Регулярно делать backup базы данных
- Мониторить производительность запросов
- Использовать транзакции для критических операций

## 📚 Полезные ссылки
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)

## 🔍 Проверка результата
После выполнения:
1. Данные сохраняются между перезапусками
2. Все CRUD операции работают
3. Производительность приемлема
4. База данных готова для production
