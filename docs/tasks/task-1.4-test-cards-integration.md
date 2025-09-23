# Задача 1.4: Тестирование с реальными test cards

## 📋 Описание
Протестировать функционал с реальными Stripe test cards (4242424242424242, 4000000000000002 и др.) вместо тестовых payment method ID. Убедиться в корректной работе создания, capture и release депозитов.

## 🎯 Цели
- Заменить hardcoded payment method IDs на реальные test cards
- Протестировать все сценарии платежей
- Убедиться в корректной работе с различными типами карт

## 🔧 Технические требования

### 1. Stripe Test Cards для тестирования
```javascript
// Основные test cards
const TEST_CARDS = {
  // Успешные платежи
  VISA_SUCCESS: '4242424242424242',
  VISA_DEBIT: '4000056655665556',
  MASTERCARD: '5555555555554444',
  AMEX: '378282246310005',
  
  // Ошибки
  DECLINED: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  EXPIRED_CARD: '4000000000000069',
  INCORRECT_CVC: '4000000000000127',
  
  // 3D Secure
  REQUIRES_AUTH: '4000002500003155',
  AUTH_REQUIRED: '4000002760003184',
  
  // Специальные случаи
  PROCESSING_ERROR: '4000000000000119',
  LOST_CARD: '4000000000009987'
};
```

### 2. Обновление API для создания Payment Methods
Файл: `pages/api/deposits/index.js`

```javascript
async function createDeposit(req, res, userId) {
  try {
    const { amount, customerId, cardNumber, expMonth, expYear, cvc } = req.body;
    
    // Валидация
    if (!amount || !customerId || !cardNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'customerId', 'cardNumber']
      });
    }
    
    // Создание Payment Method из карты
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardNumber,
        exp_month: expMonth || 12,
        exp_year: expYear || 2025,
        cvc: cvc || '123',
      },
    });
    
    // Привязка к клиенту
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customerId,
    });
    
    // Создание Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethod.id,
      capture_method: 'manual', // Для депозитов
      metadata: {
        userId: userId,
        depositType: 'security_deposit'
      },
    });
    
    // Сохранение в базе данных
    const deposit = await saveDeposit({
      id: paymentIntent.id,
      userId,
      customerId,
      amount,
      status: 'pending',
      paymentMethodId: paymentMethod.id,
      createdAt: new Date()
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
```

### 3. Обновление frontend для работы с картами
Файл: `components/DepositForm.js`

```javascript
import { useState } from 'react';

export default function DepositForm() {
  const [formData, setFormData] = useState({
    amount: '',
    customerId: '',
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: ''
  });
  
  const [testCardType, setTestCardType] = useState('success');
  
  const TEST_CARDS = {
    success: '4242424242424242',
    declined: '4000000000000002',
    insufficient: '4000000000009995',
    auth_required: '4000002500003155'
  };
  
  const handleTestCardSelect = (type) => {
    setTestCardType(type);
    setFormData(prev => ({
      ...prev,
      cardNumber: TEST_CARDS[type],
      expMonth: '12',
      expYear: '2025',
      cvc: '123'
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('Deposit created:', result);
        // Handle success
      } else {
        console.error('Error:', result.error);
        // Handle error
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div>
        <h3>Quick Test Cards</h3>
        <button type="button" onClick={() => handleTestCardSelect('success')}>
          Success Card (4242...)
        </button>
        <button type="button" onClick={() => handleTestCardSelect('declined')}>
          Declined Card (4000...0002)
        </button>
        <button type="button" onClick={() => handleTestCardSelect('insufficient')}>
          Insufficient Funds
        </button>
        <button type="button" onClick={() => handleTestCardSelect('auth_required')}>
          3D Secure Required
        </button>
      </div>
      
      <input
        type="number"
        placeholder="Amount"
        value={formData.amount}
        onChange={(e) => setFormData(prev => ({...prev, amount: e.target.value}))}
        required
      />
      
      <input
        type="text"
        placeholder="Customer ID"
        value={formData.customerId}
        onChange={(e) => setFormData(prev => ({...prev, customerId: e.target.value}))}
        required
      />
      
      <input
        type="text"
        placeholder="Card Number"
        value={formData.cardNumber}
        onChange={(e) => setFormData(prev => ({...prev, cardNumber: e.target.value}))}
        required
      />
      
      <input
        type="text"
        placeholder="MM"
        value={formData.expMonth}
        onChange={(e) => setFormData(prev => ({...prev, expMonth: e.target.value}))}
        required
      />
      
      <input
        type="text"
        placeholder="YYYY"
        value={formData.expYear}
        onChange={(e) => setFormData(prev => ({...prev, expYear: e.target.value}))}
        required
      />
      
      <input
        type="text"
        placeholder="CVC"
        value={formData.cvc}
        onChange={(e) => setFormData(prev => ({...prev, cvc: e.target.value}))}
        required
      />
      
      <button type="submit">Create Deposit</button>
    </form>
  );
}
```

### 4. Тестовые сценарии
```javascript
// test-scenarios.js
export const TEST_SCENARIOS = [
  {
    name: 'Successful Payment',
    card: '4242424242424242',
    expectedResult: 'success',
    description: 'Should create deposit and allow capture'
  },
  {
    name: 'Declined Card',
    card: '4000000000000002',
    expectedResult: 'declined',
    description: 'Should fail at payment creation'
  },
  {
    name: 'Insufficient Funds',
    card: '4000000000009995',
    expectedResult: 'insufficient_funds',
    description: 'Should fail with insufficient funds error'
  },
  {
    name: '3D Secure Required',
    card: '4000002500003155',
    expectedResult: 'requires_action',
    description: 'Should require additional authentication'
  }
];
```

## 📝 Шаги выполнения

### Шаг 1: Обновление API
1. Обновить создание депозитов для работы с картами
2. Добавить создание Payment Methods
3. Обновить error handling

### Шаг 2: Обновление frontend
1. Создать форму для ввода карт
2. Добавить quick buttons для test cards
3. Обновить обработку ответов

### Шаг 3: Создание тестовых сценариев
1. Подготовить список test cards
2. Создать automated tests
3. Документировать expected results

### Шаг 4: Тестирование
1. Тестирование каждого типа карт
2. Проверка capture/release операций
3. Тестирование error scenarios

## ✅ Критерии готовности
- [ ] API работает с реальными test cards
- [ ] Frontend позволяет ввод карт
- [ ] Все типы test cards протестированы
- [ ] Capture/release операции работают
- [ ] Error handling корректно обрабатывает ошибки
- [ ] Документированы все тестовые сценарии

## 🧪 Тестовые сценарии

### 1. Успешный платеж
```bash
# Card: 4242424242424242
# Expected: Deposit created, can be captured
```

### 2. Отклоненная карта
```bash
# Card: 4000000000000002
# Expected: Payment declined error
```

### 3. Недостаточно средств
```bash
# Card: 4000000000009995
# Expected: Insufficient funds error
```

### 4. 3D Secure
```bash
# Card: 4000002500003155
# Expected: Requires additional authentication
```

## 🚨 Важные замечания
- Использовать только test cards в test mode
- Не использовать реальные номера карт
- Тестировать все edge cases
- Документировать результаты тестирования
- Проверить работу webhooks с разными типами событий

## 📚 Полезные ссылки
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Payment Methods API](https://stripe.com/docs/api/payment_methods)
- [Payment Intents](https://stripe.com/docs/api/payment_intents)

## 🔍 Проверка результата
После выполнения:
1. Все test cards работают как ожидается
2. Error scenarios корректно обрабатываются
3. Capture/release операции функционируют
4. Webhooks получают правильные события
