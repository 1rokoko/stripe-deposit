#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const process = require('process');
const { loadEnv } = require('../src/config');

function parseArgs(argv) {
  const positional = [];
  const options = {
    command: null,
    depositId: null,
    type: null,
    limit: null,
    json: false,
    logFile: null,
    index: null,
    webhook: null,
    timeout: 5000,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }

    switch (arg) {
      case '--deposit':
      case '--deposit-id':
        options.depositId = argv[++i];
        break;
      case '--type':
        options.type = argv[++i];
        break;
      case '--limit':
      case '-l':
        options.limit = Number(argv[++i]);
        break;
      case '--json':
        options.json = true;
        break;
      case '--log':
        options.logFile = argv[++i];
        break;
      case '--index':
        options.index = Number(argv[++i]);
        break;
      case '--webhook':
        options.webhook = argv[++i];
        break;
      case '--timeout':
        options.timeout = Number(argv[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.command = 'help';
        break;
      default:
        console.warn(`Unknown option: ${arg}`);
        break;
    }
  }

  options.command = options.command || positional.shift() || 'list';
  return options;
}

function printHelp() {
  const lines = [
    'Usage:',
    '  node scripts/notifications-cli.js list [options]',
    '  node scripts/notifications-cli.js resend --index <n> [options]',
    '',
    'Options:',
    '  --deposit <id>         Filter notifications by deposit id',
    '  --type <eventType>     Filter notifications by type (e.g., deposit.authorized)',
    '  --limit <n>            Limit number of records returned',
    '  --json                 Output JSON instead of table',
    '  --log <path>           Override notifications log file path',
    '  --index <n>            (resend) 1-based index within filtered results',
    '  --webhook <url>        Override ALERT_WEBHOOK_URL when resending',
    '  --timeout <ms>         HTTP timeout for resend (default 5000)',
    '  --dry-run              Skip actual resend, only print payload',
    '  -h, --help             Show this message',
  ];
  console.log(lines.join('\n'));
}

async function readNotifications(logPath) {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    if (!content.trim()) {
      return [];
    }
    const lines = content.split(/\r?\n/);
    const records = [];
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i].trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        records.push({ line: i + 1, record: parsed, raw });
      } catch (error) {
        console.warn(`Skipping malformed JSON on line ${i + 1}: ${error.message}`);
      }
    }
    return records;
  } catch (error) {
    throw new Error(`Failed to read notifications log at ${logPath}: ${error.message}`);
  }
}

function filterRecords(records, { depositId, type, limit }) {
  let filtered = records;
  if (depositId) {
    filtered = filtered.filter((entry) => entry.record.depositId === depositId);
  }
  if (type) {
    filtered = filtered.filter((entry) => entry.record.type === type);
  }
  if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
    filtered = filtered.slice(0, limit);
  }
  return filtered;
}

function formatTable(records) {
  if (!records.length) {
    console.log('No notifications matched the criteria.');
    return;
  }

  const headers = ['Index', 'Line', 'Timestamp', 'Type', 'Deposit'];
  const rows = records.map((entry, idx) => [
    idx + 1,
    entry.line,
    entry.record.timestamp || '-',
    entry.record.type || '-',
    entry.record.depositId || '-',
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
  );

  const renderRow = (cells) =>
    cells
      .map((cell, index) => {
        const text = String(cell);
        const padding = ' '.repeat(widths[index] - text.length);
        return text + padding;
      })
      .join('  ');

  console.log(renderRow(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  rows.forEach((row) => console.log(renderRow(row)));
}

async function resendNotification(entry, webhookUrl, timeoutMs, dryRun) {
  if (dryRun) {
    console.log('Dry run: would resend notification payload:');
    console.log(JSON.stringify(entry.record, null, 2));
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry.record),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Webhook returned status ${response.status}: ${text || 'no body'}`);
    }

    console.log(`Notification from line ${entry.line} resent successfully to ${webhookUrl}.`);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Resend request timed out after ${timeoutMs}ms`);
    } else {
      console.error(`Failed to resend notification: ${error.message}`);
    }
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help') {
    printHelp();
    return;
  }

  const env = loadEnv();
  const logPath = args.logFile ? path.resolve(args.logFile) : env.NOTIFICATIONS_FILE;
  const records = await readNotifications(logPath);
  const filtered = filterRecords(records, args);

  switch (args.command) {
    case 'list': {
      if (args.json) {
        const payload = filtered.map((entry, index) => ({
          index: index + 1,
          line: entry.line,
          ...entry.record,
        }));
        console.log(JSON.stringify(payload, null, 2));
      } else {
        formatTable(filtered);
      }
      break;
    }
    case 'resend': {
      if (!filtered.length) {
        console.error('No notifications matched the criteria.');
        process.exitCode = 1;
        return;
      }

      if (typeof args.index !== 'number' || Number.isNaN(args.index) || args.index < 1) {
        console.error('Resend requires --index <n> (1-based within filtered results).');
        process.exitCode = 1;
        return;
      }

      const target = filtered[args.index - 1];
      if (!target) {
        console.error(`No notification found at index ${args.index}.`);
        process.exitCode = 1;
        return;
      }

      const webhookUrl = args.webhook || env.ALERT_WEBHOOK_URL;
      if (!webhookUrl && !args.dryRun) {
        console.error('ALERT_WEBHOOK_URL is not configured. Use --webhook <url> or enable --dry-run.');
        process.exitCode = 1;
        return;
      }

      await resendNotification(target, webhookUrl, args.timeout, args.dryRun);
      break;
    }
    default:
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
