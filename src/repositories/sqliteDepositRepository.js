const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const COLUMN_NAMES = [
  'id',
  'customer_id',
  'payment_method_id',
  'currency',
  'hold_amount',
  'status',
  'verification_payment_intent_id',
  'active_payment_intent_id',
  'capture_payment_intent_id',
  'captured_amount',
  'released_amount',
  'created_at',
  'initial_authorization_at',
  'last_authorization_at',
  'captured_at',
  'released_at',
  'metadata_json',
  'capture_history_json',
  'authorization_history_json',
  'last_error_json',
  'action_required_json'
];

function clone(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    throw new Error('Failed to parse JSON from SQLite repository');
  }
}

function serializeJson(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

class SqliteDepositRepository {
  constructor({ filePath }) {
    if (!filePath) {
      throw new Error('filePath is required for SqliteDepositRepository');
    }

    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath, { timeout: 5_000 });

    this.#initialize();
    const placeholders = COLUMN_NAMES.map((name) => '@' + name).join(',');
    const columns = COLUMN_NAMES.join(',');
    const setters = COLUMN_NAMES.filter((name) => name !== 'id')
      .map((name) => name + ' = @' + name)
      .join(', ');

    this.insertStatement = this.db.prepare('INSERT INTO deposits (' + columns + ') VALUES (' + placeholders + ')');
    this.updateStatement = this.db.prepare('UPDATE deposits SET ' + setters + ' WHERE id = @id');
  }

  #initialize() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec([
      'CREATE TABLE IF NOT EXISTS deposits (' +
        'id TEXT PRIMARY KEY,' +
        'customer_id TEXT NOT NULL,' +
        'payment_method_id TEXT NOT NULL,' +
        'currency TEXT NOT NULL,' +
        'hold_amount INTEGER NOT NULL,' +
        'status TEXT NOT NULL,' +
        'verification_payment_intent_id TEXT,' +
        'active_payment_intent_id TEXT,' +
        'capture_payment_intent_id TEXT,' +
        'captured_amount INTEGER,' +
        'released_amount INTEGER,' +
        'created_at TEXT,' +
        'initial_authorization_at TEXT,' +
        'last_authorization_at TEXT,' +
        'captured_at TEXT,' +
        'released_at TEXT,' +
        'metadata_json TEXT,' +
        'capture_history_json TEXT,' +
        'authorization_history_json TEXT,' +
        'last_error_json TEXT,' +
        'action_required_json TEXT' +
      ')'
    ].join('\n'));
  }

  #toRow(deposit) {
    return {
      id: deposit.id,
      customer_id: deposit.customerId,
      payment_method_id: deposit.paymentMethodId,
      currency: deposit.currency,
      hold_amount: deposit.holdAmount,
      status: deposit.status,
      verification_payment_intent_id: deposit.verificationPaymentIntentId ?? null,
      active_payment_intent_id: deposit.activePaymentIntentId ?? null,
      capture_payment_intent_id: deposit.capturePaymentIntentId ?? null,
      captured_amount: deposit.capturedAmount ?? null,
      released_amount: deposit.releasedAmount ?? null,
      created_at: deposit.createdAt ?? null,
      initial_authorization_at: deposit.initialAuthorizationAt ?? null,
      last_authorization_at: deposit.lastAuthorizationAt ?? null,
      captured_at: deposit.capturedAt ?? null,
      released_at: deposit.releasedAt ?? null,
      metadata_json: serializeJson(deposit.metadata || {}),
      capture_history_json: serializeJson(deposit.captureHistory || []),
      authorization_history_json: serializeJson(deposit.authorizationHistory || []),
      last_error_json: serializeJson(deposit.lastError),
      action_required_json: serializeJson(deposit.actionRequired),
    };
  }

  #fromRow(row) {
    if (!row) {
      return undefined;
    }

    const metadata = parseJson(row.metadata_json, {});
    const captureHistory = parseJson(row.capture_history_json, []);
    const authorizationHistory = parseJson(row.authorization_history_json, []);
    const lastError = parseJson(row.last_error_json, null);
    const actionRequired = parseJson(row.action_required_json, null);

    return {
      id: row.id,
      customerId: row.customer_id,
      paymentMethodId: row.payment_method_id,
      currency: row.currency,
      holdAmount: row.hold_amount,
      status: row.status,
      verificationPaymentIntentId: row.verification_payment_intent_id || undefined,
      activePaymentIntentId: row.active_payment_intent_id || undefined,
      capturePaymentIntentId: row.capture_payment_intent_id || undefined,
      capturedAmount: row.captured_amount ?? undefined,
      releasedAmount: row.released_amount ?? undefined,
      createdAt: row.created_at || undefined,
      initialAuthorizationAt: row.initial_authorization_at || undefined,
      lastAuthorizationAt: row.last_authorization_at || undefined,
      capturedAt: row.captured_at || undefined,
      releasedAt: row.released_at || undefined,
      metadata: clone(metadata) || {},
      captureHistory: Array.isArray(captureHistory) ? captureHistory.map((item) => ({ ...item })) : [],
      authorizationHistory: Array.isArray(authorizationHistory)
        ? authorizationHistory.map((item) => ({ ...item }))
        : [],
      lastError: lastError ? { ...lastError } : undefined,
      actionRequired: actionRequired ? { ...actionRequired } : undefined,
    };
  }

  async list() {
    const rows = this.db.prepare('SELECT * FROM deposits ORDER BY created_at DESC').all();
    return rows.map((row) => ({ ...this.#fromRow(row) }));
  }

  async findById(id) {
    const row = this.db.prepare('SELECT * FROM deposits WHERE id = ?').get(id);
    const deposit = this.#fromRow(row);
    return deposit ? { ...deposit } : undefined;
  }

  async create(deposit) {
    const existing = this.db.prepare('SELECT 1 FROM deposits WHERE id = ?').get(deposit.id);
    if (existing) {
      throw new Error('Deposit with id ' + deposit.id + ' already exists');
    }

    const payload = this.#toRow(deposit);
    this.insertStatement.run(payload);
    return { ...deposit };
  }

  async update(id, updater) {
    const currentRow = this.db.prepare('SELECT * FROM deposits WHERE id = ?').get(id);
    if (!currentRow) {
      throw new Error('Deposit with id ' + id + ' not found');
    }

    const current = this.#fromRow(currentRow);
    const updated = updater({ ...current });
    if (!updated || typeof updated !== 'object') {
      throw new Error('Updater must return an object');
    }

    const payload = this.#toRow(updated);
    this.updateStatement.run(payload);
    return { ...updated };
  }
}

module.exports = { SqliteDepositRepository };
