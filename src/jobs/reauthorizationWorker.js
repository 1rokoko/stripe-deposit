const { loadEnv } = require('../config');
const { StripeClient } = require('../stripe/stripeClient');
const { DepositService } = require('../services/depositService');
const { NotificationService } = require('../services/notificationService');
const { SqliteDepositRepository } = require('../repositories/sqliteDepositRepository');
const { StripeWebhookHandler } = require('../stripe/webhookHandler');
const { WebhookRetryQueue } = require('../stripe/webhookRetryQueue');
const { ReauthorizationJob } = require('./reauthorizationJob');
const { WebhookRetryProcessor } = require('./webhookRetryProcessor');
const { JobHealthStore } = require('../utils/jobHealthStore');
const { buildLogger } = require('../utils/logger');

async function main() {
  const env = loadEnv();

  if (!env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY must be set before starting the reauthorization worker');
    process.exit(1);
  }

  const logger = buildLogger('reauthorization-worker');
  const clock = { now: () => new Date() };

  const stripeClient = new StripeClient({ apiKey: env.STRIPE_SECRET_KEY });
  const repository = new SqliteDepositRepository({ filePath: env.DATABASE_FILE });
  const notificationService = new NotificationService({
    filePath: env.NOTIFICATIONS_FILE,
    logger: buildLogger('notification-service'),
    maxSizeBytes: env.NOTIFICATIONS_MAX_BYTES,
    maxBackups: env.NOTIFICATIONS_MAX_BACKUPS,
    externalWebhookUrl: env.ALERT_WEBHOOK_URL,
    fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
    externalTimeoutMs: env.ALERT_WEBHOOK_TIMEOUT_MS,
  });

  const depositService = new DepositService({
    stripeClient,
    repository,
    clock,
    logger: buildLogger('deposit-service'),
    notifier: notificationService,
  });

  const jobHealthStore = new JobHealthStore({
    filePath: env.JOB_HEALTH_FILE,
    logger: buildLogger('job-health'),
  });

  const webhookRetryQueue = new WebhookRetryQueue({
    filePath: env.WEBHOOK_RETRY_QUEUE_FILE,
    deadLetterPath: env.WEBHOOK_RETRY_DEAD_LETTER_FILE,
    logger: buildLogger('webhook-retry-queue'),
  });

  const webhookHandler = new StripeWebhookHandler({
    repository,
    clock,
    logger: buildLogger('stripe-webhook'),
    notifier: notificationService,
  });

  const job = new ReauthorizationJob({
    depositService,
    repository,
    clock,
    logger: buildLogger('reauthorization-job'),
    reauthorizeAfterDays: env.REAUTHORIZE_AFTER_DAYS,
    intervalMs: env.REAUTH_JOB_INTERVAL_MS,
    healthStore: jobHealthStore,
  });

  const retryProcessor = new WebhookRetryProcessor({
    queue: webhookRetryQueue,
    handler: webhookHandler,
    logger: buildLogger('webhook-retry'),
    clock,
    intervalMs: env.WEBHOOK_RETRY_INTERVAL_MS,
    batchSize: env.WEBHOOK_RETRY_BATCH_SIZE,
    maxAttempts: env.WEBHOOK_RETRY_MAX_ATTEMPTS,
    healthStore: jobHealthStore,
  });

  job.start();
  retryProcessor.start();
  logger.info('Reauthorization worker started', {
    intervalMs: env.REAUTH_JOB_INTERVAL_MS,
    reauthorizeAfterDays: env.REAUTHORIZE_AFTER_DAYS,
    webhookRetryIntervalMs: env.WEBHOOK_RETRY_INTERVAL_MS,
    webhookRetryBatchSize: env.WEBHOOK_RETRY_BATCH_SIZE,
  });

  job.runCycle().catch((error) => {
    logger.error('Initial reauthorization cycle failed', { error: error.message });
  });

  retryProcessor.runCycle().catch((error) => {
    logger.error('Initial webhook retry cycle failed', { error: error.message });
  });

  function handleShutdown(signal) {
    logger.info('Shutting down reauthorization worker', { signal });
    job.stop();
    retryProcessor.stop();
    process.exit(0);
  }

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

main().catch((error) => {
  console.error('Failed to start reauthorization worker', error);
  process.exit(1);
});
