# Stripe-based rental deposit service

Р­С‚РѕС‚ РїСЂРѕРµРєС‚ СЂРµР°Р»РёР·СѓРµС‚ СЃРµСЂРІРµСЂРЅСѓСЋ Р±РёР·РЅРµСЃ-Р»РѕРіРёРєСѓ РґР»СЏ СЃРµСЂРІРёСЃР° Р°СЂРµРЅРґС‹ РјРѕС‚РѕС†РёРєР»РѕРІ. РћСЃРЅРѕРІРЅС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё:

- РњРіРЅРѕРІРµРЅРЅР°СЏ РїСЂРѕРІРµСЂРєР° РєР°СЂС‚С‹ РєР»РёРµРЅС‚Р° СЃРїРёСЃР°РЅРёРµРј $1 Рё РјРѕРјРµРЅС‚Р°Р»СЊРЅС‹Рј РІРѕР·РІСЂР°С‚РѕРј.
- Р‘СЂРѕРЅРёСЂРѕРІР°РЅРёРµ РґРµРїРѕР·РёС‚Р° (manual capture) РЅР° $100 РёР»Рё $200 СЃ РґРІСѓС… СЂР°Р·РЅС‹С… СЃСЃС‹Р»РѕРє.
- Р“РёР±РєРѕРµ СЃРїРёСЃР°РЅРёРµ Р»СЋР±РѕР№ СЃСѓРјРјС‹ РІ РїСЂРµРґРµР»Р°С… Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅРѕРіРѕ РґРµРїРѕР·РёС‚Р° РїСЂРё РІРѕР·РІСЂР°С‚Рµ РјРѕС‚РѕС†РёРєР»Р°.
- РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РїСЂРѕРґР»РµРЅРёРµ Р°РІС‚РѕСЂРёР·Р°С†РёРё РєР°СЂС‚С‹ РєР°Р¶РґС‹Рµ 5 РґРЅРµР№ Р±РµР· СѓС‡Р°СЃС‚РёСЏ РєР»РёРµРЅС‚Р°.
- Bearer-Р°РІС‚РѕСЂРёР·Р°С†РёСЏ РІСЃРµС… API-Р·Р°РїСЂРѕСЃРѕРІ С‡РµСЂРµР· С‚РѕРєРµРЅ `API_AUTH_TOKEN` (РѕР±СЏР·Р°С‚РµР»РµРЅ).
- РџРµСЂ-IP rate limiting, РєРѕРЅС‚СЂРѕР»РёСЂСѓРµРјС‹Рµ С‚Р°Р№РјР°СѓС‚С‹ Рё JSON-Р»РѕРіРёСЂРѕРІР°РЅРёРµ РІСЃРµС… HTTP-Р·Р°РїСЂРѕСЃРѕРІ.
- Р›РѕРєР°Р»СЊРЅС‹Рµ СѓРІРµРґРѕРјР»РµРЅРёСЏ РїРёС€СѓС‚СЃСЏ РІ JSON-Р»РѕРі `data/notifications.log`.
- Р’РЅРµС€РЅРёРµ РѕРїРѕРІРµС‰РµРЅРёСЏ С‡РµСЂРµР· HTTP РІРµР±С…СѓРє (РµСЃР»Рё СѓРєР°Р·Р°РЅ `ALERT_WEBHOOK_URL`).
- РџСЂРёС‘Рј Рё РІРµСЂРёС„РёРєР°С†РёСЏ Stripe webhook'РѕРІ РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃС‚Р°С‚СѓСЃРѕРІ PaymentIntent.
- РќР°РґС‘Р¶РЅРѕРµ С…СЂР°РЅРёР»РёС‰Рµ РґРµРїРѕР·РёС‚РѕРІ РЅР° SQLite (`better-sqlite3`, С„Р°Р№Р»РѕРІС‹Рµ Р»РѕРєРё, WAL).
- JSON-РјРµС‚СЂРёРєРё СЃРµСЂРІРёСЃР° РґРѕСЃС‚СѓРїРЅС‹ РЅР° `GET /metrics` (Р·Р°С‰РёС‰РµРЅС‹ С‚РµРј Р¶Рµ Bearer-С‚РѕРєРµРЅРѕРј).
- Р›РѕРі СѓРІРµРґРѕРјР»РµРЅРёР№ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЂРѕС‚РёСЂСѓРµС‚СЃСЏ РїСЂРё РґРѕСЃС‚РёР¶РµРЅРёРё Р»РёРјРёС‚Р° СЂР°Р·РјРµСЂР°.
- РђРІС‚РѕРїРµСЂРµР°РІС‚РѕСЂРёР·Р°С†РёСЏ СЂР°Р±РѕС‚Р°РµС‚ РІ РѕС‚РґРµР»СЊРЅРѕРј РІРѕСЂРєРµСЂРµ СЃ health-С‚СЂРµРєРёРЅРіРѕРј Рё РѕР±С‰РёРј СЂРµРїРѕР·РёС‚РѕСЂРёРµРј.
- Р”Р»СЏ Stripe webhook'РѕРІ СЂРµР°Р»РёР·РѕРІР°РЅР° РѕС‡РµСЂРµРґСЊ РїРѕРІС‚РѕСЂРЅС‹С… РїРѕРїС‹С‚РѕРє СЃ dead-letter Рё РјРѕРЅРёС‚РѕСЂРёРЅРіРѕРј.

## РЎС‚РµРє Рё СЃС‚СЂСѓРєС‚СѓСЂР°

- **Node.js** Р±РµР· СЃС‚РѕСЂРѕРЅРЅРµРіРѕ HTTP-С„СЂРµР№РјРІРѕСЂРєР° (РІСЃРµ РІС‹Р·РѕРІС‹ Stripe С‡РµСЂРµР· `fetch`).
- **Stripe API**: РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ create/capture/cancel РґР»СЏ `PaymentIntent`, Р° С‚Р°РєР¶Рµ `Refund`.
- **SQLite (better-sqlite3)**: РќР°С‚РёРІРЅРѕРµ С„Р°Р№Р»РѕРІРѕРµ С…СЂР°РЅРёР»РёС‰Рµ СЃ WAL Рё Р±Р»РѕРєРёСЂРѕРІРєР°РјРё.
- **Manual capture + 3DS**: РїРѕРґРґРµСЂР¶РєР° СЃС†РµРЅР°СЂРёРµРІ `requires_action`, `processing`, РїРѕРІС‚РѕСЂРЅРѕР№ Р°РІС‚РѕСЂРёР·Р°С†РёРё Рё РѕС€РёР±РѕРє РєР°СЂС‚.
- **Webhooks**: `/api/stripe/webhook` РІРµСЂРёС„РёС†РёСЂСѓРµС‚ РїРѕРґРїРёСЃСЊ (`Stripe-Signature`) HMAC-SHA256.

```
src/
  server.js                       # HTTP API, Р°РІС‚РѕСЂРёР·Р°С†РёСЏ, webhook
  config.js                       # Р—Р°РіСЂСѓР·РєР° РѕРєСЂСѓР¶РµРЅРёСЏ Рё РїСѓС‚РµР№
  stripe/stripeClient.js          # РњРёРЅРёРјР°Р»СЊРЅС‹Р№ REST-РєР»РёРµРЅС‚ Stripe
  stripe/webhookVerifier.js       # РџСЂРѕРІРµСЂРєР° РїРѕРґРїРёСЃРё Stripe-Signature
  stripe/webhookHandler.js        # РћР±РЅРѕРІР»РµРЅРёРµ РґРµРїРѕР·РёС‚РѕРІ РїРѕ СЃРѕР±С‹С‚РёСЏРј Stripe
  services/depositService.js      # Р‘РёР·РЅРµСЃ-Р»РѕРіРёРєР° РґРµРїРѕР·РёС‚РѕРІ Рё edge-РєРµР№СЃРѕРІ
  repositories/sqliteDepositRepository.js # SQLite-СЂРµРїРѕР·РёС‚РѕСЂРёР№ (better-sqlite3)
  repositories/depositRepository.js       # In-memory СЂРµР°Р»РёР·Р°С†РёСЏ РґР»СЏ С‚РµСЃС‚РѕРІ
  jobs/reauthorizationJob.js      # РџР»Р°РЅРёСЂРѕРІС‰РёРє РїСЂРѕРґР»РµРЅРёСЏ Р°РІС‚РѕСЂРёР·Р°С†РёР№
  utils/logger.js                 # РџСЂРѕСЃС‚РѕР№ JSON-Р»РѕРіРіРµСЂ
```

## РџРѕРґРіРѕС‚РѕРІРєР° РѕРєСЂСѓР¶РµРЅРёСЏ

1. РЈСЃС‚Р°РЅРѕРІРёС‚Рµ Node.js 18+.
2. Р—Р°РґР°Р№С‚Рµ РІ РѕРєСЂСѓР¶РµРЅРёРё СЃРµРєСЂРµС‚РЅС‹Р№ РєР»СЋС‡ Stripe `STRIPE_SECRET_KEY` (`sk_test_...` РёР»Рё `sk_live_...`).
3. РЎРѕР·РґР°Р№С‚Рµ `.env` РІ РєРѕСЂРЅРµ РїСЂРѕРµРєС‚Р° (РёР»Рё СЌРєСЃРїРѕСЂС‚РёСЂСѓР№С‚Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ):

   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   PORT=3000
   API_AUTH_TOKEN=super-secret-token
   STRIPE_WEBHOOK_SECRET=whsec_...
   DATABASE_FILE=./data/deposits.sqlite
   NOTIFICATIONS_FILE=./data/notifications.log
   REQUEST_TIMEOUT_MS=15000
   RATE_LIMIT_MAX_REQUESTS=120
   RATE_LIMIT_WINDOW_MS=60000
   LOG_HTTP_REQUESTS=true
   NOTIFICATIONS_MAX_BYTES=1048576
   NOTIFICATIONS_MAX_BACKUPS=3
   ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
   ALERT_WEBHOOK_TIMEOUT_MS=5000
   JOB_HEALTH_FILE=./data/job-health.json
   REAUTHORIZE_AFTER_DAYS=5
   REAUTH_JOB_INTERVAL_MS=43200000
   WEBHOOK_RETRY_QUEUE_FILE=./data/webhook-retry.json
   WEBHOOK_RETRY_DEAD_LETTER_FILE=./data/webhook-dead-letter.json
   WEBHOOK_RETRY_INTERVAL_MS=60000
   WEBHOOK_RETRY_BATCH_SIZE=10
   WEBHOOK_RETRY_MAX_ATTEMPTS=5
   ```

4. РЎРѕР·РґР°Р№С‚Рµ РґРёСЂРµРєС‚РѕСЂРёСЋ `data` (РµСЃР»Рё РµС‘ РµС‰С‘ РЅРµС‚) вЂ” С‚СѓРґР° Р±СѓРґРµС‚ СЃРѕС…СЂР°РЅСЏС‚СЊСЃСЏ С„Р°Р№Р» Р±Р°Р·С‹ `deposits.sqlite`.

РЎРµСЂРІРµСЂ РЅРµ Р·Р°РїСѓСЃС‚РёС‚СЃСЏ Р±РµР· `API_AUTH_TOKEN` Рё `STRIPE_SECRET_KEY`. РџСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё `STRIPE_WEBHOOK_SECRET` РІС…РѕРґСЏС‰РёРµ СЃРѕР±С‹С‚РёСЏ Stripe Р±СѓРґСѓС‚ РѕС‚РІРµСЂРіР°С‚СЊСЃСЏ СЃ РѕС€РёР±РєРѕР№.

## РџРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р°РєС‚РёРІРёСЂРѕРІР°РЅРЅРѕРјСѓ Р°РєРєР°СѓРЅС‚Сѓ Stripe

1. Р’РѕР№РґРёС‚Рµ РІ [Stripe Dashboard](https://dashboard.stripe.com/) Рё СЃРєРѕРїРёСЂСѓР№С‚Рµ СЃРµРєСЂРµС‚РЅС‹Р№ РєР»СЋС‡ РІ СЂР°Р·РґРµР»Рµ **Developers > API keys**.
2. РџРµСЂРµРґ Р·Р°РїСѓСЃРєРѕРј СЃРµСЂРІРµСЂР° СЌРєСЃРїРѕСЂС‚РёСЂСѓР№С‚Рµ РµРіРѕ РІ `STRIPE_SECRET_KEY` (РёР»Рё РїСЂРѕРїРёС€РёС‚Рµ РІ `.env`).
3. РќР° РєР»РёРµРЅС‚Рµ (Checkout/Elements/Payment Element) РёСЃРїРѕР»СЊР·СѓР№С‚Рµ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёР№ publishable key (`pk_test_...` РёР»Рё `pk_live_...`), С‡С‚РѕР±С‹ РїРѕР»СѓС‡Р°С‚СЊ `paymentMethodId` Рё `customerId`, РєРѕС‚РѕСЂС‹Рµ СЃРµСЂРІРµСЂ РѕР¶РёРґР°РµС‚ РІ `hold`-СЌРЅРґРїРѕРёРЅС‚Р°С….
4. Р”Р»СЏ webhook'РѕРІ РІ СЂР°Р·РґРµР»Рµ **Developers > Webhooks** СЃРѕР·РґР°Р№С‚Рµ endpoint `POST /api/stripe/webhook`, СЃРіРµРЅРµСЂРёСЂСѓР№С‚Рµ `whsec_...` Рё СѓРєР°Р¶РёС‚Рµ РµРіРѕ РІ `STRIPE_WEBHOOK_SECRET`.

> Production-СЂРµРєРѕРјРµРЅРґР°С†РёРё: HTTPS, РїСЂРѕРєСЃРё РїРµСЂРµРґ СЃРµСЂРІРµСЂРѕРј, РІР°Р»РёРґР°С†РёСЏ РІС…РѕРґСЏС‰РёС… IP, retry-Р»РѕРіРёРєР° РґР»СЏ webhook'РѕРІ Рё СЂРѕС‚Р°С†РёСЏ API-РєР»СЋС‡РµР№.

## Р—Р°РїСѓСЃРє СЃРµСЂРІРµСЂР°

```bash
npm install
npm start
npm run reauth-worker # РѕС‚РґРµР»СЊРЅС‹Р№ РїСЂРѕС†РµСЃСЃ/РєРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ С„РѕРЅРѕРІРѕРіРѕ РІРѕСЂРєРµСЂР°
```

РЎРµСЂРІРµСЂ РїРѕРґРЅРёРјРµС‚ HTTP API (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РЅР° `http://localhost:3000`), РІРєР»СЋС‡РёС‚ РїСЂРѕРІРµСЂРєСѓ `Authorization: Bearer ...`. Р¤РѕРЅРѕРІС‹Р№ РІРѕСЂРєРµСЂ (`npm run reauth-worker`) РѕС‚РІРµС‡Р°РµС‚ Р·Р° РїР»Р°РЅРѕРІСѓСЋ РїРµСЂРµР°РІС‚РѕСЂРёР·Р°С†РёСЋ РєР°Р¶РґС‹Рµ `REAUTH_JOB_INTERVAL_MS`. Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ API РјРѕР¶РЅРѕ РїСЂРѕРІРµСЂРёС‚СЊ Р·Р°РїСЂРѕСЃРѕРј `GET /healthz`.

## РћСЃРЅРѕРІРЅС‹Рµ СЌРЅРґРїРѕРёРЅС‚С‹

| РњРµС‚РѕРґ | URL | РќР°Р·РЅР°С‡РµРЅРёРµ |
|-------|-----|------------|
| `GET` | `/healthz` | РџСЂРѕРІРµСЂРєР° СЂР°Р±РѕС‚РѕСЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё СЃРµСЂРІРёСЃР° |
| `GET` | `/api/deposits` | РЎРїРёСЃРѕРє РІСЃРµС… РґРµРїРѕР·РёС‚РѕРІ Рё РёС… СЃС‚Р°С‚СѓСЃРѕРІ |
| `POST` | `/api/deposits/hold/100` | Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ $100 (10000 С†РµРЅС‚РѕРІ) |
| `POST` | `/api/deposits/hold/200` | Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ $200 (20000 С†РµРЅС‚РѕРІ) |
| `GET` | `/api/deposits/{depositId}` | РўРµРєСѓС‰РµРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ РґРµРїРѕР·РёС‚Р° |
| `POST` | `/api/deposits/{depositId}/capture` | РЎРїРёСЃР°С‚СЊ РІСЃСЋ СЃСѓРјРјСѓ РёР»Рё С‡Р°СЃС‚СЊ РґРµРїРѕР·РёС‚Р° |
| `POST` | `/api/deposits/{depositId}/release` | РџРѕР»РЅРѕСЃС‚СЊСЋ РѕСЃРІРѕР±РѕРґРёС‚СЊ РґРµРїРѕР·РёС‚ |
| `POST` | `/api/deposits/{depositId}/reauthorize` | РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РїРµСЂРµР°РІС‚РѕСЂРёР·РѕРІР°С‚СЊ РґРµРїРѕР·РёС‚ |
| `POST` | `/api/deposits/{depositId}/resolve` | РћС‚РјРµС‚РёС‚СЊ `requires_action` РґРµРїРѕР·РёС‚ РєР°Рє РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹Р№ РѕРїРµСЂР°С‚РѕСЂРѕРј |
| `POST` | `/api/stripe/webhook` | РџСЂРёС‘Рј СЃРѕР±С‹С‚РёР№ Stripe (Р±РµР· Bearer-С‚РѕРєРµРЅР°) |
| `GET` | `/metrics` | РўРµРєСѓС‰РёРµ РјРµС‚СЂРёРєРё СЃРµСЂРІРёСЃР° (JSON) |

> Р”Р»СЏ РІСЃРµС… СЌРЅРґРїРѕРёРЅС‚РѕРІ, РєСЂРѕРјРµ `/healthz` Рё webhook'Р°, РЅРµРѕР±С…РѕРґРёРј Р·Р°РіРѕР»РѕРІРѕРє `Authorization: Bearer <API_AUTH_TOKEN>`.

### Rate limiting Рё С‚Р°Р№РјР°СѓС‚С‹

- РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РґРµР№СЃС‚РІСѓРµС‚ Р»РёРјРёС‚ `RATE_LIMIT_MAX_REQUESTS` (120 Р·Р°РїСЂРѕСЃРѕРІ) Р·Р° РѕРєРЅРѕ `RATE_LIMIT_WINDOW_MS` (60 СЃРµРєСѓРЅРґ) РґР»СЏ РєР°Р¶РґРѕРіРѕ IP. РџСЂРё РїСЂРµРІС‹С€РµРЅРёРё РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ `429 Too Many Requests` СЃ Р·Р°РіРѕР»РѕРІРєР°РјРё `Retry-After` Рё `X-RateLimit-*`.
- РўР°Р№РјР°СѓС‚ РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РїСЂРѕСЃР° Р·Р°РґР°С‘С‚СЃСЏ С‡РµСЂРµР· `REQUEST_TIMEOUT_MS` (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 15 СЃРµРєСѓРЅРґ). РџСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ Р·Р°РїСЂРѕСЃС‹ Р·Р°РІРµСЂС€Р°СЋС‚СЃСЏ СЃ РѕС€РёР±РєРѕР№ `503` Рё Р·Р°РєСЂС‹С‚РёРµРј СЃРѕРµРґРёРЅРµРЅРёСЏ.
- Р’СЃРµ Р·Р°РїСЂРѕСЃС‹ Р»РѕРіРёСЂСѓСЋС‚СЃСЏ РІ stdout РєР°Рє JSON (РјРѕР¶РЅРѕ РѕС‚РєР»СЋС‡РёС‚СЊ СѓСЃС‚Р°РЅРѕРІРєРѕР№ `LOG_HTTP_REQUESTS=false`).

### РЎС‚Р°С‚СѓСЃС‹ РґРµРїРѕР·РёС‚РѕРІ

- `authorized` вЂ” РєР°СЂС‚Р° СѓСЃРїРµС€РЅРѕ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅР°, РіРѕС‚РѕРІРѕ Рє СЃРїРёСЃР°РЅРёСЋ РёР»Рё РІРѕР·РІСЂР°С‚Сѓ.
- `requires_action` вЂ” Stripe С‚СЂРµР±СѓРµС‚ 3DS / РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ (`next_action`). Р’ РѕС‚РІРµС‚Рµ С…СЂР°РЅРёС‚СЃСЏ `actionRequired.clientSecret` Рё payload РґР»СЏ С„СЂРѕРЅС‚РµРЅРґР°.
- `processing` вЂ” Stripe РµС‰С‘ РЅРµ РІРµСЂРЅСѓР» РёС‚РѕРіРѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ; РѕР±РЅРѕРІР»РµРЅРёРµ РїСЂРёРґС‘С‚ РІРµР±С…СѓРєРѕРј.
- `captured` вЂ” РґРµРїРѕР·РёС‚ (С‡Р°СЃС‚РёС‡РЅРѕ РёР»Рё РїРѕР»РЅРѕСЃС‚СЊСЋ) СЃРїРёСЃР°РЅ.
- `released` вЂ” РґРµРїРѕР·РёС‚ РІСЂСѓС‡РЅСѓСЋ РѕСЃРІРѕР±РѕР¶РґС‘РЅ.
- `canceled` / `authorization_failed` вЂ” Р°РІС‚РѕСЂРёР·Р°С†РёСЏ РѕС‚РјРµРЅРµРЅР° Stripe РёР»Рё РѕС‚РєР»РѕРЅРµРЅР° Р±Р°РЅРєРѕРј; РїРѕРґСЂРѕР±РЅРѕСЃС‚Рё Р»РµР¶Р°С‚ РІ `lastError`.

## Р›РѕРєР°Р»СЊРЅРѕРµ С‚РµСЃС‚РёСЂРѕРІР°РЅРёРµ

1. Р­РєСЃРїРѕСЂС‚РёСЂСѓР№С‚Рµ `STRIPE_SECRET_KEY=sk_test_...` Рё `API_AUTH_TOKEN=dev-token`, Р·Р°РїСѓСЃС‚РёС‚Рµ `npm start`.
2. Р’С‹Р·РѕРІРёС‚Рµ `POST /api/deposits/hold/{100|200}` СЃ Р·Р°РіРѕР»РѕРІРєРѕРј `Authorization: Bearer dev-token` Рё С‚РµР»РѕРј:

   ```json
   {
     "customerId": "cus_123",
     "paymentMethodId": "pm_card_visa"
   }
   ```

   РџСЂРё 3DS СЃС†РµРЅР°СЂРёСЏС… РѕС‚РІРµС‚ РІРµСЂРЅС‘С‚ `status: "requires_action"` Рё СЃС‚СЂСѓРєС‚СѓСЂСѓ `actionRequired`.

3. РџСЂРѕС‚РµСЃС‚РёСЂСѓР№С‚Рµ `capture`, `release`, `reauthorize` вЂ” РѕС‚РІРµС‚С‹ СЃРѕРґРµСЂР¶Р°С‚ Р°РєС‚СѓР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґРµРїРѕР·РёС‚Р° Рё РёСЃС‚РѕСЂРёСЋ РѕРїРµСЂР°С†РёР№.
4. Р”Р»СЏ РёРјРёС‚Р°С†РёРё webhook'РѕРІ РјРѕР¶РЅРѕ РѕС‚РїСЂР°РІРёС‚СЊ raw JSON РЅР° `/api/stripe/webhook` СЃ РІР°Р»РёРґРЅРѕР№ РїРѕРґРїРёСЃСЊСЋ Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`).
5. Р®РЅРёС‚-С‚РµСЃС‚С‹ Р±РёР·РЅРµСЃ-Р»РѕРіРёРєРё Р·Р°РїСѓСЃРєР°СЋС‚СЃСЏ РєРѕРјР°РЅРґРѕР№ `npm test` (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ in-memory СЂРµРїРѕР·РёС‚РѕСЂРёР№).
- Р›РѕРі СѓРІРµРґРѕРјР»РµРЅРёР№ РјРѕР¶РЅРѕ СЃРјРѕС‚СЂРµС‚СЊ `tail -f data/notifications.log`. РџСЂРё РґРѕСЃС‚РёР¶РµРЅРёРё `NOTIFICATIONS_MAX_BYTES` С„Р°Р№Р» СЂРѕС‚РёСЂСѓРµС‚СЃСЏ (`.1`, `.2`, ...), С…СЂР°РЅРёС‚СЃСЏ РґРѕ `NOTIFICATIONS_MAX_BACKUPS` Р°СЂС…РёРІРѕРІ.
- Р•СЃР»Рё Р·Р°РґР°РЅ `ALERT_WEBHOOK_URL`, РєР°Р¶РґРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РѕС‚РїСЂР°РІР»СЏРµС‚СЃСЏ POST-Р·Р°РїСЂРѕСЃРѕРј СЃ JSON-РїСЌР№Р»РѕСѓРґРѕРј; С‚Р°Р№РјР°СѓС‚ СѓРїСЂР°РІР»СЏРµС‚СЃСЏ `ALERT_WEBHOOK_TIMEOUT_MS`.
- Р¤Р°Р№Р» `job-health.json` С…СЂР°РЅРёС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ С„РѕРЅРѕРІС‹С… Р·Р°РґР°С‡ Рё С‡РёС‚Р°РµС‚СЃСЏ СЌРЅРґРїРѕРёРЅС‚РѕРј `/metrics`.
- РћС‡РµСЂРµРґСЊ РїРѕРІС‚РѕСЂРЅС‹С… РІРµР±С…СѓРєРѕРІ С…СЂР°РЅРёС‚СЃСЏ РІ `webhook-retry.json`, РЅРµРѕР±СЂР°Р±РѕС‚Р°РЅРЅС‹Рµ СЃРѕР±С‹С‚РёСЏ РїРѕРїР°РґР°СЋС‚ РІ `webhook-dead-letter.json`.

## Autoprolongation

- The background worker checks deposits every `REAUTH_JOB_INTERVAL_MS` (12h by default) and renews holds after `REAUTHORIZE_AFTER_DAYS`.
- Interval values come from environment variables; each cycle is recorded in `job-health.json`.
- Operators can still call `POST /api/deposits/{depositId}/reauthorize` when needed.
- The worker skips deposits in statuses `requires_action`, `processing`, `captured`, `released`, `canceled`.

## Webhook retry queue

- The API pushes failed Stripe events (5xx) into `webhook-retry.json`.
- The worker replays up to `WEBHOOK_RETRY_BATCH_SIZE` events every `WEBHOOK_RETRY_INTERVAL_MS`.
- After `WEBHOOK_RETRY_MAX_ATTEMPTS` the event moves into `webhook-dead-letter.json` with a reason and appears under `/metrics`.

## Operator toolkit

- CLI: `npm run deposits:cli -- --status authorized` filters deposits by status/customer. Add `--json` or `--database <path>` for raw JSON or a custom DB path.
- Notifications CLI: `npm run notifications:cli list --json` lists events; `resend --index <n>` with `--webhook <url>` (or `--dry-run`) replays payloads to external channels.
- Manual resolve: `POST /api/deposits/{depositId}/resolve` clears `requires_action`, updates history, sends `deposit.authorized`. Optional body `{ "metadata": { "resolvedBy": "operator" } }`.
## Automated setup and deployment

- Quick start: run `./scripts/setup-and-deploy.sh` (Linux/macOS) or `powershell scripts/setup-and-deploy.ps1` (Windows) to install dependencies, run tests, and launch `docker compose`.
- Docker compose: fill `.env` and execute `docker compose up -d`; services `api` and `worker` share the `./data` volume.
- Upgrade: `git pull && docker compose up -d --build`.

## Stripe CLI end-to-end tests

- Execute `npm run test:e2e:stripe` to exercise the harness with Stripe CLI.
- Provide `STRIPE_CLI_PATH` (and optional `STRIPE_CLI_ARGS`) so the script can invoke the CLI; defaults call `stripe trigger payment_intent.succeeded`.
- Set temporary env values (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) to match your test project before running.
## Next steps

- Add full customer model and OAuth for managers.
- Add message queues/workers for webhook redelivery and background tasks.
- Extend integration coverage with Stripe CLI end-to-end flows.
- Add email/SMS notifications for deposit status changes.




