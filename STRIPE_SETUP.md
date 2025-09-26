# 🔑 Настройка Stripe для Live версии

## **Шаг 1: Получите ваши Stripe ключи**

### **Test ключи (для тестирования):**
1. Войдите в [Stripe Dashboard](https://dashboard.stripe.com/)
2. Убедитесь что переключатель в левом верхнем углу установлен на **"Test data"**
3. Перейдите в **Developers → API keys**
4. Скопируйте:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### **Live ключи (для продакшена):**
1. В Stripe Dashboard переключитесь на **"Live data"**
2. Перейдите в **Developers → API keys**
3. Скопируйте:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

## **Шаг 2: Обновите .env файл**

Замените placeholder ключи в `.env` файле:

```env
# Test ключи
STRIPE_SECRET_KEY=sk_test_ваш_настоящий_тестовый_ключ
STRIPE_WEBHOOK_SECRET=whsec_ваш_настоящий_webhook_secret

# Live ключи (раскомментируйте и добавьте настоящие ключи)
STRIPE_SECRET_KEY_LIVE=sk_live_ваш_настоящий_live_ключ
STRIPE_WEBHOOK_SECRET_LIVE=whsec_ваш_настоящий_live_webhook_secret
```

## **Шаг 3: Настройте Vercel Environment Variables**

Для деплоймента на Vercel добавьте переменные окружения:

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект `stripe-deposit`
3. Перейдите в **Settings → Environment Variables**
4. Добавьте:

### **Test Environment:**
- `STRIPE_SECRET_KEY` = `sk_test_ваш_ключ`
- `STRIPE_WEBHOOK_SECRET` = `whsec_ваш_webhook`

### **Production Environment:**
- `STRIPE_SECRET_KEY_LIVE` = `sk_live_ваш_ключ`
- `STRIPE_WEBHOOK_SECRET_LIVE` = `whsec_ваш_live_webhook`

**⚠️ ВАЖНО:** Для корректной работы live режима ОБЯЗАТЕЛЬНО должны быть настроены ОБА ключа:
- `STRIPE_SECRET_KEY_LIVE` - секретный ключ для API
- `STRIPE_WEBHOOK_SECRET_LIVE` - секрет для webhook'ов

Если `STRIPE_WEBHOOK_SECRET_LIVE` не настроен или содержит placeholder, в админке будет отображаться предупреждение "⚠️ Live keys not configured".

### **Other Required Variables:**
- `JWT_SECRET` = `ваш_jwt_secret_для_админки`
- `API_AUTH_TOKEN` = `ваш_api_token`

## **Шаг 4: Настройте Webhooks (опционально)**

Если нужны webhooks:

1. В Stripe Dashboard → **Developers → Webhooks**
2. Добавьте endpoint: `https://ваш-домен.vercel.app/api/stripe/webhook`
3. Выберите события: `payment_intent.*`, `charge.*`
4. Скопируйте **Signing secret** в `STRIPE_WEBHOOK_SECRET`

## **Шаг 5: Устранение неполадок**

### **Проблема: "⚠️ Live keys not configured" в админке**

**Причина:** Система проверяет наличие ОБЕИХ переменных для live режима:
- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_LIVE`

**Решение:**
1. Убедитесь, что обе переменные настроены в Vercel Environment Variables
2. Проверьте, что `STRIPE_WEBHOOK_SECRET_LIVE` не содержит placeholder значение
3. Webhook secret должен начинаться с `whsec_`
4. После изменения переменных выполните новый deploy: `vercel --prod`

**Проверка конфигурации:**
```bash
# Проверить переменные в Vercel
vercel env ls

# Должны быть настроены:
# STRIPE_SECRET_KEY_LIVE (Production, Preview, Development)
# STRIPE_WEBHOOK_SECRET_LIVE (Production, Preview, Development)
```

## **Шаг 6: Тестирование**

### **Test Mode:**
- Используйте тестовые карты: `4242424242424242`
- Все транзакции будут тестовыми

### **Live Mode:**
- ⚠️ **ВНИМАНИЕ**: Используйте настоящие карты
- Все транзакции будут реальными с реальными деньгами

## **Безопасность:**

- ❌ **НИКОГДА** не коммитьте настоящие ключи в Git
- ✅ Используйте environment variables
- ✅ Регулярно ротируйте ключи
- ✅ Ограничьте доступ к live ключам

## **Готово!**

После настройки ключей:
1. Перезапустите приложение
2. В админ-панели переключитесь на **Live Mode**
3. Создайте тестовый депозит
4. Проверьте все функции (capture, refund, etc.)
