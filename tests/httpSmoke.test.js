const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

async function waitFor(checkFn, timeoutMs, intervalMs) {
  const start = Date.now();
  const timeout = timeoutMs || 8000;
  const interval = intervalMs || 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await checkFn();
      if (result) {
        return true;
      }
    } catch (error) {
      // ignore until timeout
    }

    if (Date.now() - start > timeout) {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

test('HTTP API smoke test', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'http-smoke-'));
  const port = 4310 + Math.floor(Math.random() * 200);
  const baseUrl = 'http://127.0.0.1:' + port;

  const env = {
    ...process.env,
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    API_AUTH_TOKEN: 'smoke-token',
    DATABASE_FILE: path.join(tempDir, 'deposits.sqlite'),
    NOTIFICATIONS_FILE: path.join(tempDir, 'notifications.log'),
    JOB_HEALTH_FILE: path.join(tempDir, 'job-health.json'),
    WEBHOOK_RETRY_QUEUE_FILE: path.join(tempDir, 'webhook-retry.json'),
    WEBHOOK_RETRY_DEAD_LETTER_FILE: path.join(tempDir, 'webhook-dead-letter.json'),
    LOG_HTTP_REQUESTS: 'false',
    PORT: String(port),
  };

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'ignore',
  });

  let closed = false;
  server.on('exit', () => {
    closed = true;
  });

  t.after(() => {
    if (!closed) {
      server.kill('SIGTERM');
    }
  });

  const ready = await waitFor(async () => {
    const response = await fetch(baseUrl + '/healthz');
    return response.ok;
  }, 15000);

  assert.equal(ready, true, 'server failed to start');

  const unauthorized = await fetch(baseUrl + '/api/deposits');
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(baseUrl + '/api/deposits', {
    headers: { Authorization: 'Bearer smoke-token' },
  });
  assert.equal(authorized.status, 200);
  const payload = await authorized.json();
  assert.ok(Array.isArray(payload.deposits));

  const metrics = await fetch(baseUrl + '/metrics', {
    headers: { Authorization: 'Bearer smoke-token' },
  });
  assert.equal(metrics.status, 200);
  const metricsBody = await metrics.json();
  assert.ok(typeof metricsBody.requests.total === 'number');
  assert.ok(metricsBody.jobs);
  assert.ok(metricsBody.webhookRetry);
});
