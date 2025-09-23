# Задача 1.1: Настройка Stripe Test API ключей

## 📋 Описание
Получить test API key (sk_test_...) из Stripe Dashboard и настроить переменную окружения STRIPE_SECRET_KEY_TEST в Vercel. Заменить текущий live key на test key для безопасного тестирования.

## 🎯 Цели
- Обеспечить безопасное тестирование без риска реальных платежей
- Настроить корректную работу с Stripe Test API
- Подготовить инфраструктуру для разработки и тестирования

## 🔧 Технические требования

### 1. Получение Test API ключей
- Войти в Stripe Dashboard (https://dashboard.stripe.com)
- Переключиться в Test mode (toggle в левом верхнем углу)
- Перейти в раздел "Developers" → "API keys"
- Скопировать "Secret key" (начинается с `sk_test_`)
- Скопировать "Publishable key" (начинается с `pk_test_`)

### 2. Настройка переменных окружения в Vercel
```bash
# Переменные для добавления в Vercel
STRIPE_SECRET_KEY=sk_test_... # заменить текущий live key
STRIPE_PUBLISHABLE_KEY=pk_test_...
NODE_ENV=development
```

### 3. Обновление кода
Файлы для изменения:
- `pages/api/deposits/index.js` - обновить инициализацию Stripe
- `pages/api/deposits/[id]/capture.js` - проверить использование ключей
- `pages/api/deposits/[id]/release.js` - проверить использование ключей
- `pages/api/webhook.js` - обновить для test mode

### 4. Проверка конфигурации
```javascript
// Добавить в начало API файлов для проверки
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.warn('⚠️ Using live Stripe key in development!');
}
```

## 📝 Шаги выполнения

### Шаг 1: Получение ключей
1. Открыть Stripe Dashboard
2. Переключиться в Test mode
3. Скопировать Secret key и Publishable key
4. Сохранить ключи в безопасном месте

### Шаг 2: Настройка Vercel
1. Открыть проект в Vercel Dashboard
2. Перейти в Settings → Environment Variables
3. Обновить STRIPE_SECRET_KEY на test ключ
4. Добавить STRIPE_PUBLISHABLE_KEY
5. Добавить NODE_ENV=development

### Шаг 3: Обновление кода
1. Проверить все API endpoints на корректное использование ключей
2. Добавить валидацию для test mode
3. Обновить frontend для использования publishable key

### Шаг 4: Тестирование
1. Деплой изменений
2. Проверка работы API с test ключами
3. Тестирование создания депозитов

## ✅ Критерии готовности
- [ ] Test API ключи получены из Stripe Dashboard
- [ ] Переменные окружения настроены в Vercel
- [ ] Код обновлен для использования test ключей
- [ ] Добавлена валидация для test mode
- [ ] API endpoints работают с test ключами
- [ ] Нет ошибок в логах Vercel

## 🚨 Важные замечания
- **НЕ КОММИТИТЬ** ключи в репозиторий
- Использовать только test ключи для разработки
- Проверить, что все API calls используют правильные ключи
- Убедиться, что webhook endpoint настроен для test mode

## 📚 Полезные ссылки
- [Stripe Test Mode](https://stripe.com/docs/testing)
- [Stripe API Keys](https://stripe.com/docs/keys)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## 🔍 Проверка результата
После выполнения задачи:
1. API должен работать без ошибок аутентификации
2. Логи должны показывать использование test ключей
3. Stripe Dashboard должен показывать test транзакции
4. Нет предупреждений о live ключах в development
