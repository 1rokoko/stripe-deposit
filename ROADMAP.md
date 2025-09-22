# Roadmap

## Summary

| Phase | Item | Status | Notes |
|-------|------|--------|-------|
| MVP | HTTP API for deposits (hold/capture/release/list) | done | Implemented in `src/server.js`, covered by `tests/depositService.test.js`. |
| MVP | $1 card verification plus refund | done | `initializeDeposit` issues a verification intent and refund. |
| MVP | Automatic re-authorization job | done | `ReauthorizationJob` in `src/jobs/reauthorizationJob.js`. |
| MVP | Persistent storage | done | Migrated to SQLite via `better-sqlite3` (native driver). |
| Prod-ready | Bearer token auth | done | Authorization header enforced in `src/server.js`. |
| Prod-ready | SQLite repository | done | `SqliteDepositRepository` persists history and errors. |
| Prod-ready | Stripe webhooks & signature check | done | HMAC verification + handler in `src/stripe/webhookHandler.js`. |
| Prod-ready | Edge cases (`requires_action`, declines, processing) | done | Status handling in `src/services/depositService.js` with tests. |
| Prod-ready | Documentation refresh | done | README updated with config and flows. |
| Prod-ready | Unit tests for critical flows | done | `tests/depositService.test.js` covers success/error paths. |
| Prod-ready | Notifications & monitoring rollout | done | Локальные логи, метрики и внешние алерты по вебхуку. |
| Reliability | Durable background processing | done | Воркёр выделен, очередь ретраев вебхуков подключена. |
| Reliability | Persistence hardening | done | Перешли на `better-sqlite3`, включили WAL и файловые блокировки. |
| Security | Configuration safeguards | done | Обязательный API-токен, rate limiting, таймауты и логирование. |

## Active Work

1. Notifications & monitoring (completed)
   - [x] File-based notifications log (`data/notifications.log`) for `requires_action` and `authorization_failed`.
   - [x] External alerts (webhook) for business staff.
   - [x] Metrics endpoint (Prometheus or structured logs channel).
   - [x] Rotate/prune `notifications.log` to keep filesystem usage bounded.
2. Background processing & webhooks (completed)
   - [x] Move reauthorization into a dedicated worker/cron process.
   - [x] Retry queue for failed Stripe webhooks (persist backlog, automatic retries).
   - [x] Track job/webhook health (last run, retry counts) via logs или metrics.
3. Operator tooling (completed)
   - [x] CLI/script to filter deposits by status/customer.
   - [x] Endpoint to mark `requires_action` deposits resolved after client confirmation.
   - [ ] Admin tooling to resend или inspect notifications for a specific deposit.
4. Testing & QA
   - [ ] Stripe CLI based end-to-end tests including webhook round-trip.
   - [x] Unit tests covering `StripeWebhookHandler` success and failure branches.
   - [x] Integration tests for `SqliteDepositRepository` (schema migrations, persistence guarantees).
   - [x] HTTP API smoke tests (auth enforcement, validation errors, webhook signature failures).
5. Platform hardening
   - [x] Replace `sql.js` with a production-grade SQLite driver (file locking) or external database.
   - [x] Enforce presence of `API_AUTH_TOKEN` at startup and add basic rate limiting.
   - [x] Add structured request logging and request timeouts on the HTTP server.

## Change Log

- 2025-09-22: MVP and production-hardening items completed (auth, SQLite, webhooks, edge cases, docs, tests).
- 2025-09-22: Added NotificationService; deposit service and webhook handler emit events to `notifications.log`. README and tests updated.
- 2025-09-22: Full-code audit; roadmap expanded for monitoring, background processing, testing, and platform hardening.
- 2025-09-22: Добавлены rate limiting, таймауты, логирование запросов, JSON-метрики и ротация `notifications.log`; добавлены юнит-тесты для `StripeWebhookHandler`.
- 2025-09-22: Реализованы внешние уведомления через вебхук, покрыты тестом NotificationService.
- 2025-09-22: Воркёр вынесен в отдельный процесс, добавлена очередь повторной доставки Stripe webhook'ов и health-мониторинг задач.
- 2025-09-22: Перешли на `better-sqlite3`, добавили CLI, endpoint resolve, интеграционные тесты, Dockerfile и скрипты деплоя.

> Keep this document in sync with new work: move items to the summary table when complete and log the date with a short note.
