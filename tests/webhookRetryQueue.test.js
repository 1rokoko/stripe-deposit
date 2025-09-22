const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { WebhookRetryQueue } = require('../src/stripe/webhookRetryQueue');

function createSilentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
}

describe('WebhookRetryQueue', () => {
  test('enqueue, drain, requeue, and dead-letter flow', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webhook-queue-'));
    const queuePath = path.join(tempDir, 'queue.json');
    const deadPath = path.join(tempDir, 'dead.json');

    const queue = new WebhookRetryQueue({
      filePath: queuePath,
      deadLetterPath: deadPath,
      logger: createSilentLogger(),
    });

    await queue.enqueue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
    assert.equal(await queue.count(), 1);

    const batch = await queue.drain(5);
    assert.equal(batch.length, 1);
    assert.equal(batch[0].attempts, 0);
    assert.equal(batch[0].event.type, 'payment_intent.succeeded');
    assert.equal(await queue.count(), 0);

    await queue.requeue(batch[0], new Error('temporary failure'));
    assert.equal(await queue.count(), 1);
    const peek = await queue.peek(5);
    assert.equal(peek[0].attempts, 1);

    const retryBatch = await queue.drain(5);
    await queue.deadLetter(retryBatch[0], 'max attempts reached');
    assert.equal(await queue.count(), 0);

    const deadContent = JSON.parse(await fs.readFile(deadPath, 'utf8'));
    assert.equal(deadContent.length, 1);
    assert.equal(deadContent[0].reason, 'max attempts reached');
  });
});
