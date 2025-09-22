const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "stripe-cli-e2e.js");

const SHOULD_RUN = process.env.RUN_STRIPE_CLI_E2E === "1";

if (!SHOULD_RUN) {
  test.skip("Stripe CLI e2e harness (set RUN_STRIPE_CLI_E2E=1 to enable)", () => {});
} else {
  test("Stripe CLI e2e harness (stub CLI)", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stripe-cli-stub-"));
    const stubPath = path.join(tempDir, "stripe-cli-stub.js");

    const stubLines = [
      "#!/usr/bin/env node",
      "const http = require(\"http\");",
      "const crypto = require(\"crypto\");",
      "const args = process.argv.slice(2);",
      "const forwardIndex = args.indexOf('--forward-to');",
      "if (forwardIndex === -1 || !args[forwardIndex + 1]) {",
      "  console.error('forward URL missing');",
      "  process.exit(1);",
      "}",
      "const forwardUrl = new URL(args[forwardIndex + 1]);",
      "const payload = {",
      "  id: 'evt_test',",
      "  type: 'payment_intent.succeeded',",
      "  data: { object: { id: 'pi_test', object: 'payment_intent' } },",
      "  livemode: false,",
      "};",
      "const body = JSON.stringify(payload);",
      "const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_cli';",
      "const timestamp = Math.floor(Date.now() / 1000).toString();",
      "const signature = crypto",
      "  .createHmac('sha256', secret)",
      "  .update(timestamp + '.' + body)",
      "  .digest('hex');",
      "const options = {",
      "  method: 'POST',",
      "  hostname: forwardUrl.hostname,",
      "  port: forwardUrl.port,",
      "  path: forwardUrl.pathname,",
      "  headers: {",
      "    'Content-Type': 'application/json',",
      "    'Stripe-Signature': 't=' + timestamp + ',v1=' + signature,",
      "  },",
      "};",
      "const req = http.request(options, (res) => {",
      "  res.on('data', () => {});",
      "  res.on('end', () => {",
      "    process.exit(res.statusCode === 200 ? 0 : 1);",
      "  });",
      "});",
      "req.on('error', (err) => {",
      "  console.error(err.message);",
      "  process.exit(1);",
      "});",
      "req.write(body);",
      "req.end();",
    ];
    await fs.writeFile(stubPath, stubLines.join("\n"), { mode: 0o755 });

    const env = {
      ...process.env,
      STRIPE_CLI_PATH: process.execPath,
      STRIPE_CLI_ARGS: `${stubPath} trigger payment_intent.succeeded`,
      STRIPE_SECRET_KEY: "sk_test_stub",
      STRIPE_WEBHOOK_SECRET: "whsec_test_cli",
      API_AUTH_TOKEN: "stripe-cli-test",
      STRIPE_E2E_PORT: String(3480 + Math.floor(Math.random() * 100)),
      STRIPE_E2E_DATABASE_FILE: path.join(tempDir, "deposits.sqlite"),
      STRIPE_E2E_NOTIFICATIONS_FILE: path.join(tempDir, "notifications.log"),
      STRIPE_E2E_JOB_HEALTH_FILE: path.join(tempDir, "job-health.json"),
      STRIPE_E2E_RETRY_FILE: path.join(tempDir, "webhook-retry.json"),
      STRIPE_E2E_DLX_FILE: path.join(tempDir, "webhook-dead-letter.json"),
    };

    const result = await runNodeScript([SCRIPT], env);
    await fs.rm(tempDir, { recursive: true, force: true });
    assert.equal(result.code, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stdout, /Stripe CLI E2E completed/i);
  });
}
