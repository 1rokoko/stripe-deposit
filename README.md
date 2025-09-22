# Stripe-based rental deposit service
TBackend for managing rental security deposits backed by Stripe manual capture.

## Features

- Instant card verification ($1 charge and refund).
- Deposit holds for $100 / $200 with partial capture and release.
- Automatic re-authorization every five days without customer action.
- Mandatory Bearer token authentication (`API_AUTH_TOKEN`).
- Per-IP rate limiting, request timeouts, JSON access logs.
- Local notification log (`data/notifications.log`) with optional outbound webhook fan-out.
- Stripe webhook signature verification plus retry queue and dead-letter storage.
- Durable SQLite storage (`better-sqlite3`, WAL, file locking).
- `/metrics` endpoint exposing request stats and job health.

## Stack

- Node.js 18+ (no external HTTP framework, all Stripe calls via fetch).
- Stripe REST API (`PaymentIntent`, `Refund`).
- SQLite + better-sqlite3 for persistence.
- node:test for unit and integration tests (HTTP smoke, CLI, retry queue).

```
src/
  server.js                         # HTTP API, auth, routers
  config.js                         # Environment loader
  services/depositService.js        # Business logic
  services/notificationService.js   # Local + webhook notifications
  repositories/sqliteDepositRepository.js # better-sqlite3 persistence
  stripe/                           # Stripe client, webhook verifier/handler
  jobs/                             # Reauthorization job, webhook retry processor, worker entry
  utils/                            # JSON logger, job health store
scripts/
  deposits-cli.js                   # Deposit listing CLI
  notifications-cli.js              # Notification inspect/resend CLI
  stripe-cli-e2e.js                 # Stripe CLI harness
  setup-and-deploy.sh/.ps1          # Automated install + docker compose
```

## Environment

1. Install Node.js 18+.
2. Create `.env` (example values):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
API_AUTH_TOKEN=super-secret-token
PORT=3000
DATABASE_FILE=./data/deposits.sqlite
NOTIFICATIONS_FILE=./data/notifications.log
JOB_HEALTH_FILE=./data/job-health.json
WEBHOOK_RETRY_QUEUE_FILE=./data/webhook-retry.json
WEBHOOK_RETRY_DEAD_LETTER_FILE=./data/webhook-dead-letter.json
REQUEST_TIMEOUT_MS=15000
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
NOTIFICATIONS_MAX_BYTES=1048576
NOTIFICATIONS_MAX_BACKUPS=3
ALERT_WEBHOOK_URL=https://hooks.example.com/...
ALERT_WEBHOOK_TIMEOUT_MS=5000
REAUTHORIZE_AFTER_DAYS=5
REAUTH_JOB_INTERVAL_MS=43200000
WEBHOOK_RETRY_INTERVAL_MS=60000
WEBHOOK_RETRY_BATCH_SIZE=10
WEBHOOK_RETRY_MAX_ATTEMPTS=5
```

Ensure the `data/` directory exists (repo includes `data/.gitkeep`).

## Quick start

```
npm install
npm start                 # API server
npm run reauth-worker     # background worker (separate process)
```

Health check: `GET http://localhost:3000/healthz`. All other routes require `Authorization: Bearer <API_AUTH_TOKEN>`.

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET    | `/api/deposits`               | List deposits |
| POST   | `/api/deposits/hold/100`      | Hold $100 |
| POST   | `/api/deposits/hold/200`      | Hold $200 |
| GET    | `/api/deposits/{id}`          | Deposit details |
| POST   | `/api/deposits/{id}/capture`  | Capture partial/full amount |
| POST   | `/api/deposits/{id}/release`  | Release hold |
| POST   | `/api/deposits/{id}/reauthorize` | Force re-authorization |
| POST   | `/api/deposits/{id}/resolve`  | Mark `requires_action` deposit as resolved |
| POST   | `/api/stripe/webhook`         | Stripe webhook receiver |
| GET    | `/metrics`                    | JSON metrics + job health |

Rate limiting defaults to 120 requests/minute per IP, returning 429 when exceeded. Requests time out after `REQUEST_TIMEOUT_MS` (15s by default).

## Operator toolkit

- `npm run deposits:cli -- --status authorized` — filter deposits (`--json`, `--customer`, `--database`, `--limit`).
- `npm run notifications:cli list --json` — inspect notifications; `resend --index <n> --webhook <url>` (or `--dry-run`) to replay payloads.
- `POST /api/deposits/{id}/resolve` clears `requires_action`, updates history, emits `deposit.authorized`.

## Automated deployment

- `./scripts/setup-and-deploy.sh` (Linux/macOS) or `powershell scripts/setup-and-deploy.ps1` (Windows) installs deps, runs tests, and launches `docker compose up -d`.
- `docker-compose.yml` starts `api` + `worker` sharing `./data`; populate `.env` first.
- Upgrade: `git pull && docker compose up -d --build`.

## Stripe CLI end-to-end

- `npm run test:e2e:stripe` runs the harness. Enable by setting `RUN_STRIPE_CLI_E2E=1` and pointing `STRIPE_CLI_PATH` (and optional `STRIPE_CLI_ARGS`) at your Stripe CLI.
- Provide test keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). The test is skipped by default.

## Testing

- `npm test` — unit/integration suite (deposit service, SQLite repo, webhook handler, CLI tools, HTTP smoke, retry queue).
- `npm run test:e2e:stripe` — optional Stripe CLI harness.

## Security

- API exits if `STRIPE_SECRET_KEY` or `API_AUTH_TOKEN` are missing.
- Webhooks validated via `STRIPE_WEBHOOK_SECRET`.
- Rate limiting, request timeouts, and JSON logging mitigate abuse.
- Run behind HTTPS/reverse proxy, keep `.env` outside VCS, rotate Stripe keys, monitor `/metrics` (`jobs`, `webhookRetry`).

## Future work

- Customer model + OAuth for operators.
- Queue-based webhook redelivery.
- CI-integrated Stripe CLI end-to-end suite.
- Email/SMS notifications for deposit status changes.
s/workers for webhook redelivery and background tasks.
- Extend integration coverage with Stripe CLI end-to-end flows.
- Add email/SMS notifications for deposit status changes.




