const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { NotificationService } = require('../src/services/notificationService');

function createSilentLogger() {
  return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
}

describe('NotificationService', () => {
  test('writes to log and posts to external webhook when configured', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-service-'));
    const filePath = path.join(tempDir, 'notifications.log');

    const calls = [];
    const fetchMock = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    };

    const service = new NotificationService({
      filePath,
      logger: createSilentLogger(),
      externalWebhookUrl: 'https://alerts.test/hook',
      fetch: fetchMock,
      externalTimeoutMs: 1_000,
    });

    await service.notify({
      type: 'deposit.requires_action',
      depositId: 'dep_42',
      status: 'requires_action',
      message: 'Requires customer confirmation',
      payload: { paymentIntentId: 'pi_42' },
    });

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 1);

    const record = JSON.parse(lines[0]);
    assert.equal(record.type, 'deposit.requires_action');
    assert.equal(record.depositId, 'dep_42');
    assert.equal(record.payload.paymentIntentId, 'pi_42');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://alerts.test/hook');
    assert.equal(calls[0].options.method, 'POST');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.depositId, 'dep_42');
    assert.equal(body.type, 'deposit.requires_action');
  });
});
