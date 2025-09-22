const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'notifications-cli.js');

async function runCli(args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe('notifications-cli', () => {
  let tempDir;
  let logPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notifications-cli-'));
    logPath = path.join(tempDir, 'notifications.log');
    const lines = [
      JSON.stringify({
        timestamp: '2025-09-22T10:00:00.000Z',
        type: 'deposit.authorized',
        depositId: 'dep_1',
        status: 'authorized',
      }),
      JSON.stringify({
        timestamp: '2025-09-22T10:05:00.000Z',
        type: 'deposit.requires_action',
        depositId: 'dep_2',
        status: 'requires_action',
      }),
    ];
    await fs.writeFile(logPath, lines.join('\n') + '\n', 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('lists notifications as JSON with filters', async () => {
    const result = await runCli(['list', '--log', logPath, '--json', '--deposit', 'dep_1']);
    assert.equal(result.code, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].depositId, 'dep_1');
    assert.equal(parsed[0].type, 'deposit.authorized');
  });

  test('resends notification to custom webhook', async () => {
    let received = null;
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        received = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.statusCode = 200;
        res.end('ok');
      });
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const webhookUrl = `http://127.0.0.1:${port}/hook`;

    const result = await runCli([
      'resend',
      '--log',
      logPath,
      '--index',
      '2',
      '--webhook',
      webhookUrl,
    ]);

    server.close();
    assert.equal(result.code, 0, result.stderr);
    assert.ok(received);
    assert.equal(received.depositId, 'dep_2');
    assert.equal(received.type, 'deposit.requires_action');
  });
});
