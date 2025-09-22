#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function tokenize(str = '') {
  if (!str) return [];
  const matches = str.match(/(?:"[^"]*"|'[^']*'|\S+)/g) || [];
  return matches.map((item) => item.replace(/^['"]|['"]$/g, ''));
}

async function waitFor(checkFn, timeoutMs = 15000, intervalMs = 200) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const ok = await checkFn();
      if (ok) return true;
    } catch (error) {
      // ignore until timeout
    }
    if (Date.now() - start > timeoutMs) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main() {
  const stripeCliExec = process.env.STRIPE_CLI_PATH || 'stripe';
  const additionalArgs = tokenize(process.env.STRIPE_CLI_ARGS || 'trigger payment_intent.succeeded');
  const port = Number(process.env.STRIPE_E2E_PORT || 3360);
  const forwardUrl = `http://127.0.0.1:${port}/api/stripe/webhook`;

  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stripe-e2e-data-'));
  const env = {
    ...process.env,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_cli',
    API_AUTH_TOKEN: process.env.API_AUTH_TOKEN || 'stripe-cli-e2e',
    DATABASE_FILE: process.env.STRIPE_E2E_DATABASE_FILE || path.join(dataDir, 'deposits.sqlite'),
    NOTIFICATIONS_FILE: process.env.STRIPE_E2E_NOTIFICATIONS_FILE || path.join(dataDir, 'notifications.log'),
    JOB_HEALTH_FILE: process.env.STRIPE_E2E_JOB_HEALTH_FILE || path.join(dataDir, 'job-health.json'),
    WEBHOOK_RETRY_QUEUE_FILE: process.env.STRIPE_E2E_RETRY_FILE || path.join(dataDir, 'webhook-retry.json'),
    WEBHOOK_RETRY_DEAD_LETTER_FILE: process.env.STRIPE_E2E_DLX_FILE || path.join(dataDir, 'webhook-dead-letter.json'),
    LOG_HTTP_REQUESTS: 'false',
    PORT: String(port),
  };

  console.log('Starting API server on port', port);
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  let serverClosed = false;
  server.once('exit', (code) => {
    serverClosed = true;
    if (code !== 0) {
      console.error('Server exited unexpectedly with code', code);
    }
  });

  const cleanup = async () => {
    if (!serverClosed) {
      server.kill('SIGTERM');
      await new Promise((resolve) => server.once('exit', resolve));
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  };

  try {
    const ready = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => null);
      return Boolean(response && response.ok);
    }, 20000);

    if (!ready) {
      throw new Error('Server did not become ready before timeout');
    }

    const args = [...additionalArgs];
    if (!args.includes('--forward-to') && !args.includes('--forward_to')) {
      args.push('--forward-to', forwardUrl);
    }

    console.log('Invoking Stripe CLI:', stripeCliExec, args.join(' '));
    const cli = spawn(stripeCliExec, args, {
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    const cliExitCode = await new Promise((resolve) => cli.once('close', resolve));
    if (cliExitCode !== 0) {
      throw new Error(`Stripe CLI exited with code ${cliExitCode}`);
    }

    const metricsResponse = await fetch(`http://127.0.0.1:${port}/metrics`, {
      headers: { Authorization: `Bearer ${env.API_AUTH_TOKEN}` },
    });
    if (!metricsResponse.ok) {
      throw new Error(`Failed to fetch metrics: status ${metricsResponse.status}`);
    }
    const metrics = await metricsResponse.json();

    console.log('Webhook retry pending count:', metrics.webhookRetry?.pending ?? 'n/a');
    console.log('Requests handled total:', metrics.requests?.total ?? 'n/a');
    console.log('Stripe CLI E2E completed successfully.');
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error('Stripe CLI E2E failed:', error.message);
  process.exit(1);
});
