const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { WebhookRetryQueue } = require('../src/stripe/webhookRetryQueue');
const { WebhookRetryProcessor } = require('../src/jobs/webhookRetryProcessor');

function createSilentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
}

describe('WebhookRetryProcessor', () => {
  test('retries failed webhooks until success and records health', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webhook-processor-'));
    const queuePath = path.join(tempDir, 'queue.json');
    const deadPath = path.join(tempDir, 'dead.json');

    const queue = new WebhookRetryQueue({
      filePath: queuePath,
      deadLetterPath: deadPath,
      logger: createSilentLogger(),
    });

    await queue.enqueue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_retry' } } });

    let attempts = 0;
    const handler = {
      async handleEvent() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('first attempt fails');
        }
      },
    };

    const health = [];
    const processor = new WebhookRetryProcessor({
      queue,
      handler,
      logger: createSilentLogger(),
      clock: { now: () => new Date('2024-03-01T00:00:00.000Z') },
      intervalMs: 1_000,
      batchSize: 2,
      maxAttempts: 3,
      healthStore: {
        async recordRun(payload) {
          health.push(payload);
        },
      },
    });

    await processor.runCycle();
    assert.equal(attempts, 1);
    assert.equal(await queue.count(), 1);
    assert.equal(health.length, 1);
    assert.equal(health[0].success, false);
    assert.equal(health[0].stats.requeued, 1);

    await processor.runCycle();
    assert.equal(attempts, 2);
    assert.equal(await queue.count(), 0);
    assert.equal(health.length, 2);
    assert.equal(health[1].success, true);
    assert.equal(health[1].stats.processed, 1);
  });
});
