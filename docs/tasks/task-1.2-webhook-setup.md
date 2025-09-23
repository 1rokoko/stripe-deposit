# Задача 1.2: Создание и настройка Webhook

## 📋 Описание
Создать webhook endpoint в Stripe Dashboard, получить webhook secret (whsec_...) и настроить переменную STRIPE_WEBHOOK_SECRET в Vercel для обработки событий платежей.

## 🎯 Цели
- Настроить автоматическую обработку событий Stripe
- Обеспечить надежную синхронизацию статусов платежей
- Подготовить инфраструктуру для real-time обновлений

## 🔧 Технические требования

### 1. Создание Webhook в Stripe Dashboard
```
URL: https://stripe-deposit.vercel.app/api/webhook
Events to listen:
- payment_intent.succeeded
- payment_intent.payment_failed
- payment_intent.canceled
- payment_intent.requires_action
```

### 2. Настройка переменных окружения
```bash
# Добавить в Vercel
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Обновление webhook handler
Файл: `pages/api/webhook.js`

```javascript
import Stripe from 'stripe';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Обработка событий
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'payment_intent.canceled':
      await handlePaymentCanceled(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
```

### 4. Функции обработки событий
```javascript
async function handlePaymentSucceeded(paymentIntent) {
  // Обновить статус депозита в базе данных
  const depositId = paymentIntent.metadata.depositId;
  if (depositId) {
    await updateDepositStatus(depositId, 'captured');
    console.log(`Deposit ${depositId} captured successfully`);
  }
}

async function handlePaymentFailed(paymentIntent) {
  const depositId = paymentIntent.metadata.depositId;
  if (depositId) {
    await updateDepositStatus(depositId, 'failed');
    console.log(`Deposit ${depositId} failed`);
  }
}

async function handlePaymentCanceled(paymentIntent) {
  const depositId = paymentIntent.metadata.depositId;
  if (depositId) {
    await updateDepositStatus(depositId, 'canceled');
    console.log(`Deposit ${depositId} canceled`);
  }
}
```

## 📝 Шаги выполнения

### Шаг 1: Создание Webhook в Stripe
1. Открыть Stripe Dashboard → Developers → Webhooks
2. Нажать "Add endpoint"
3. URL: `https://stripe-deposit.vercel.app/api/webhook`
4. Выбрать события: payment_intent.*
5. Скопировать Signing secret (whsec_...)

### Шаг 2: Настройка Vercel
1. Добавить STRIPE_WEBHOOK_SECRET в Environment Variables
2. Убедиться, что переменная доступна в production

### Шаг 3: Обновление кода
1. Обновить `pages/api/webhook.js`
2. Добавить функции обработки событий
3. Добавить логирование для отладки

### Шаг 4: Тестирование
1. Деплой изменений
2. Тестирование webhook через Stripe CLI
3. Проверка логов в Vercel

## ✅ Критерии готовности
- [ ] Webhook endpoint создан в Stripe Dashboard
- [ ] STRIPE_WEBHOOK_SECRET настроен в Vercel
- [ ] Webhook handler обновлен и работает
- [ ] События корректно обрабатываются
- [ ] Логирование настроено
- [ ] Тестирование прошло успешно

## 🧪 Тестирование

### Локальное тестирование с Stripe CLI
```bash
# Установка Stripe CLI
npm install -g stripe-cli

# Логин
stripe login

# Прослушивание событий
stripe listen --forward-to localhost:3000/api/webhook

# Тестирование события
stripe trigger payment_intent.succeeded
```

### Тестирование в production
```bash
# Проверка webhook endpoint
curl -X POST https://stripe-deposit.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 🚨 Важные замечания
- Webhook secret должен быть защищен
- Обязательно проверять подпись webhook
- Обрабатывать идемпотентность событий
- Логировать все события для отладки
- Настроить retry логику для failed webhooks

## 📚 Полезные ссылки
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Webhook Events](https://stripe.com/docs/api/events/types)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## 🔍 Проверка результата
После выполнения:
1. Webhook endpoint отвечает 200 на POST запросы
2. События корректно обрабатываются
3. Статусы депозитов обновляются автоматически
4. Логи показывают успешную обработку событий
