const fs = require('fs');
const path = require('path');

function parseEnvFile(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      const value = rest.join('=');
      if (key) {
        acc[key.trim()] = value.trim().replace(/^"|"$/g, '');
      }
      return acc;
    }, {});
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
    Object.entries(parsed).forEach(([key, value]) => {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  }

  const dataDir = path.join(__dirname, '..', 'data');

  return {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
    DATA_FILE: process.env.DATA_FILE || path.join(dataDir, 'deposits.json'),
    DATABASE_FILE: process.env.DATABASE_FILE || path.join(dataDir, 'deposits.sqlite'),
    NOTIFICATIONS_FILE: process.env.NOTIFICATIONS_FILE || path.join(dataDir, 'notifications.log'),
    API_AUTH_TOKEN: process.env.API_AUTH_TOKEN,
    JOB_HEALTH_FILE: process.env.JOB_HEALTH_FILE || path.join(dataDir, 'job-health.json'),
    WEBHOOK_RETRY_QUEUE_FILE: process.env.WEBHOOK_RETRY_QUEUE_FILE || path.join(dataDir, 'webhook-retry.json'),
    WEBHOOK_RETRY_DEAD_LETTER_FILE:
      process.env.WEBHOOK_RETRY_DEAD_LETTER_FILE || path.join(dataDir, 'webhook-dead-letter.json'),
    REQUEST_TIMEOUT_MS: process.env.REQUEST_TIMEOUT_MS
      ? Number(process.env.REQUEST_TIMEOUT_MS)
      : 15_000,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS
      ? Number(process.env.RATE_LIMIT_MAX_REQUESTS)
      : 120,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS
      ? Number(process.env.RATE_LIMIT_WINDOW_MS)
      : 60_000,
    LOG_HTTP_REQUESTS: process.env.LOG_HTTP_REQUESTS !== 'false',
    NOTIFICATIONS_MAX_BYTES: process.env.NOTIFICATIONS_MAX_BYTES
      ? Number(process.env.NOTIFICATIONS_MAX_BYTES)
      : 1_048_576,
    NOTIFICATIONS_MAX_BACKUPS: process.env.NOTIFICATIONS_MAX_BACKUPS
      ? Number(process.env.NOTIFICATIONS_MAX_BACKUPS)
      : 3,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    ALERT_WEBHOOK_TIMEOUT_MS: process.env.ALERT_WEBHOOK_TIMEOUT_MS
      ? Number(process.env.ALERT_WEBHOOK_TIMEOUT_MS)
      : 5_000,
    REAUTHORIZE_AFTER_DAYS: process.env.REAUTHORIZE_AFTER_DAYS
      ? Number(process.env.REAUTHORIZE_AFTER_DAYS)
      : 5,
    REAUTH_JOB_INTERVAL_MS: process.env.REAUTH_JOB_INTERVAL_MS
      ? Number(process.env.REAUTH_JOB_INTERVAL_MS)
      : 12 * 60 * 60 * 1000,
    WEBHOOK_RETRY_INTERVAL_MS: process.env.WEBHOOK_RETRY_INTERVAL_MS
      ? Number(process.env.WEBHOOK_RETRY_INTERVAL_MS)
      : 60 * 1000,
    WEBHOOK_RETRY_BATCH_SIZE: process.env.WEBHOOK_RETRY_BATCH_SIZE
      ? Number(process.env.WEBHOOK_RETRY_BATCH_SIZE)
      : 10,
    WEBHOOK_RETRY_MAX_ATTEMPTS: process.env.WEBHOOK_RETRY_MAX_ATTEMPTS
      ? Number(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS)
      : 5,
  };
}

module.exports = { loadEnv };
