#!/usr/bin/env node
const path = require('path');
const process = require('process');
const { loadEnv } = require('../src/config');
const { SqliteDepositRepository } = require('../src/repositories/sqliteDepositRepository');

function parseArgs(argv) {
  const result = {
    status: null,
    customerId: null,
    json: false,
    limit: null,
    database: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--status':
      case '-s':
        result.status = argv[i + 1];
        i += 1;
        break;
      case '--customer':
      case '-c':
        result.customerId = argv[i + 1];
        i += 1;
        break;
      case '--json':
        result.json = true;
        break;
      case '--limit':
      case '-l':
        result.limit = Number(argv[i + 1]);
        i += 1;
        break;
      case '--database':
      case '-d':
        result.database = argv[i + 1];
        i += 1;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        break;
    }
  }

  return result;
}

function printHelp() {
  const text = [
    'Usage: node scripts/deposits-cli.js [options]',
    '',
    'Options:',
    '  -s, --status <status>        Filter by deposit status (authorized, captured, etc.)',
    '  -c, --customer <customerId>  Filter by customer id',
    '  -l, --limit <n>              Limit number of results',
    '  -d, --database <path>        Override database file path',
    '      --json                   Print raw JSON instead of table',
    '  -h, --help                   Show this message',
  ];
  console.log(text.join('\n'));
}

function formatCurrency(amount, currency) {
  if (typeof amount !== 'number') {
    return '-';
  }
  const formatted = (amount / 100).toFixed(2);
  return currency ? formatted + ' ' + currency.toUpperCase() : formatted;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const env = loadEnv();
  const databaseFile = args.database ? path.resolve(args.database) : env.DATABASE_FILE;
  const repository = new SqliteDepositRepository({ filePath: databaseFile });

  const deposits = await repository.list();
  let filtered = deposits;
  if (args.status) {
    filtered = filtered.filter((item) => item.status === args.status);
  }
  if (args.customerId) {
    filtered = filtered.filter((item) => item.customerId === args.customerId);
  }

  if (typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit >= 0) {
    filtered = filtered.slice(0, args.limit);
  }

  if (args.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  if (!filtered.length) {
    console.log('No deposits matched the criteria.');
    return;
  }

  const headers = ['ID', 'Status', 'Customer', 'Hold', 'Created'];
  const rows = filtered.map((deposit) => [
    deposit.id,
    deposit.status,
    deposit.customerId,
    formatCurrency(deposit.holdAmount, deposit.currency),
    deposit.createdAt || '-',
  ]);

  const columnWidths = headers.map((header, index) => {
    const rowWidths = rows.map((row) => String(row[index]).length);
    return Math.max(header.length, ...rowWidths);
  });

  const renderRow = (cells) =>
    cells
      .map((cell, index) => {
        const text = String(cell);
        const padding = ' '.repeat(columnWidths[index] - text.length);
        return text + padding;
      })
      .join('  ');

  console.log(renderRow(headers));
  console.log(columnWidths.map((width) => '-'.repeat(width)).join('  '));
  rows.forEach((row) => console.log(renderRow(row)));
})();
