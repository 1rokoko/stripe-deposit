const JOB_NAME = 'webhook-retry';

class WebhookRetryProcessor {
  constructor({
    queue,
    handler,
    logger,
    clock,
    intervalMs = 60 * 1000,
    batchSize = 10,
    maxAttempts = 5,
    healthStore,
  }) {
    if (!queue) {
      throw new Error('WebhookRetryProcessor requires a queue');
    }
    if (!handler || typeof handler.handleEvent !== 'function') {
      throw new Error('WebhookRetryProcessor requires a handler with handleEvent(event)');
    }

    this.queue = queue;
    this.handler = handler;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    this.clock = clock || { now: () => new Date() };
    this.intervalMs = intervalMs;
    this.batchSize = batchSize;
    this.maxAttempts = maxAttempts;
    this.healthStore = healthStore || null;
    this.timer = null;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.logger.info('Starting webhook retry processor', {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      maxAttempts: this.maxAttempts,
    });

    this.timer = setInterval(() => {
      this.runCycle().catch((error) => {
        this.logger.error('Webhook retry cycle failed', { error: error.message });
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('Stopped webhook retry processor');
    }
  }

  async runCycle() {
    const startedAt = this.clock.now();
    const stats = {
      dequeued: 0,
      processed: 0,
      failures: 0,
      requeued: 0,
      deadLettered: 0,
    };
    let thrownError;

    try {
      const batch = await this.queue.drain(this.batchSize);
      stats.dequeued = batch.length;

      for (const entry of batch) {
        try {
          await this.handler.handleEvent(entry.event);
          stats.processed += 1;
          this.logger.info('Replayed webhook event from retry queue', {
            id: entry.id,
            type: entry.event?.type,
          });
        } catch (error) {
          stats.failures += 1;
          const attempts = entry.attempts + 1;
          const reason = error?.message || String(error);

          if (attempts >= this.maxAttempts) {
            stats.deadLettered += 1;
            await this.queue.deadLetter({ ...entry, attempts }, reason);
          } else {
            stats.requeued += 1;
            await this.queue.requeue(entry, error);
          }

          this.logger.error('Failed to replay webhook event', {
            id: entry.id,
            attempts,
            maxAttempts: this.maxAttempts,
            error: reason,
          });
        }
      }
    } catch (error) {
      thrownError = error;
      throw error;
    } finally {
      if (this.healthStore) {
        const finishedAt = this.clock.now();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const success = !thrownError && stats.failures === 0;
        await this.healthStore.recordRun({
          jobName: JOB_NAME,
          startedAt: startedAt.toISOString(),
          durationMs,
          success,
          stats,
          error: thrownError || (stats.failures > 0 ? { message: 'Failed to replay some webhook events' } : null),
          failureCount: stats.failures,
        });
      }
    }
  }
}

module.exports = { WebhookRetryProcessor, JOB_NAME };
