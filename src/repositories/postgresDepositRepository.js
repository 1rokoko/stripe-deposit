/**
 * PostgreSQL implementation of DepositRepository
 * Compatible with Vercel Postgres, Supabase, and other PostgreSQL providers
 */

const { Pool } = require('pg');

class PostgresDepositRepository {
  constructor(options = {}) {
    this.connectionString = options.connectionString || process.env.DATABASE_URL;
    
    if (!this.connectionString) {
      throw new Error('PostgreSQL connection string is required (DATABASE_URL)');
    }

    // Create connection pool
    this.pool = new Pool({
      connectionString: this.connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initialized = false;
  }

  async #initialize() {
    if (this.initialized) return;

    const client = await this.pool.connect();
    try {
      // Create deposits table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS deposits (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          payment_method_id TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'usd',
          hold_amount INTEGER NOT NULL,
          status TEXT NOT NULL,
          verification_payment_intent_id TEXT,
          active_payment_intent_id TEXT,
          capture_payment_intent_id TEXT,
          captured_amount INTEGER,
          released_amount INTEGER,
          created_at TIMESTAMPTZ,
          initial_authorization_at TIMESTAMPTZ,
          last_authorization_at TIMESTAMPTZ,
          captured_at TIMESTAMPTZ,
          released_at TIMESTAMPTZ,
          metadata_json JSONB,
          capture_history_json JSONB,
          authorization_history_json JSONB,
          last_error_json JSONB,
          action_required_json JSONB
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_deposits_customer_id ON deposits(customer_id);
        CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
        CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at);
        CREATE INDEX IF NOT EXISTS idx_deposits_payment_method_id ON deposits(payment_method_id);
      `);

      this.initialized = true;
    } finally {
      client.release();
    }
  }

  #toRow(deposit) {
    return {
      id: deposit.id,
      customer_id: deposit.customerId,
      payment_method_id: deposit.paymentMethodId,
      currency: deposit.currency,
      hold_amount: deposit.holdAmount,
      status: deposit.status,
      verification_payment_intent_id: deposit.verificationPaymentIntentId || null,
      active_payment_intent_id: deposit.activePaymentIntentId || null,
      capture_payment_intent_id: deposit.capturePaymentIntentId || null,
      captured_amount: deposit.capturedAmount || null,
      released_amount: deposit.releasedAmount || null,
      created_at: deposit.createdAt || null,
      initial_authorization_at: deposit.initialAuthorizationAt || null,
      last_authorization_at: deposit.lastAuthorizationAt || null,
      captured_at: deposit.capturedAt || null,
      released_at: deposit.releasedAt || null,
      metadata_json: deposit.metadata ? JSON.stringify(deposit.metadata) : null,
      capture_history_json: deposit.captureHistory ? JSON.stringify(deposit.captureHistory) : null,
      authorization_history_json: deposit.authorizationHistory ? JSON.stringify(deposit.authorizationHistory) : null,
      last_error_json: deposit.lastError ? JSON.stringify(deposit.lastError) : null,
      action_required_json: deposit.actionRequired ? JSON.stringify(deposit.actionRequired) : null,
    };
  }

  #fromRow(row) {
    if (!row) return undefined;

    const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
    const captureHistory = row.capture_history_json ? JSON.parse(row.capture_history_json) : [];
    const authorizationHistory = row.authorization_history_json ? JSON.parse(row.authorization_history_json) : [];
    const lastError = row.last_error_json ? JSON.parse(row.last_error_json) : undefined;
    const actionRequired = row.action_required_json ? JSON.parse(row.action_required_json) : undefined;

    return {
      id: row.id,
      customerId: row.customer_id,
      paymentMethodId: row.payment_method_id,
      currency: row.currency,
      holdAmount: row.hold_amount,
      status: row.status,
      verificationPaymentIntentId: row.verification_payment_intent_id,
      activePaymentIntentId: row.active_payment_intent_id,
      capturePaymentIntentId: row.capture_payment_intent_id,
      capturedAmount: row.captured_amount,
      releasedAmount: row.released_amount,
      createdAt: row.created_at,
      initialAuthorizationAt: row.initial_authorization_at,
      lastAuthorizationAt: row.last_authorization_at,
      capturedAt: row.captured_at,
      releasedAt: row.released_at,
      metadata: { ...metadata },
      captureHistory: Array.isArray(captureHistory) ? captureHistory.map(item => ({ ...item })) : [],
      authorizationHistory: Array.isArray(authorizationHistory) ? authorizationHistory.map(item => ({ ...item })) : [],
      lastError: lastError ? { ...lastError } : undefined,
      actionRequired: actionRequired ? { ...actionRequired } : undefined,
    };
  }

  async list() {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM deposits ORDER BY created_at DESC');
      return result.rows.map(row => ({ ...this.#fromRow(row) }));
    } finally {
      client.release();
    }
  }

  async findById(id) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM deposits WHERE id = $1', [id]);
      const deposit = this.#fromRow(result.rows[0]);
      return deposit ? { ...deposit } : undefined;
    } finally {
      client.release();
    }
  }

  async create(deposit) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      // Check if deposit already exists
      const existing = await client.query('SELECT 1 FROM deposits WHERE id = $1', [deposit.id]);
      if (existing.rows.length > 0) {
        throw new Error('Deposit with id ' + deposit.id + ' already exists');
      }

      const row = this.#toRow(deposit);
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = columns.map((_, index) => `$${index + 1}`);

      const query = `
        INSERT INTO deposits (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
      `;

      await client.query(query, values);
      return { ...deposit };
    } finally {
      client.release();
    }
  }

  async update(id, updater) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      // Get current deposit
      const result = await client.query('SELECT * FROM deposits WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        throw new Error('Deposit with id ' + id + ' not found');
      }

      const current = this.#fromRow(result.rows[0]);
      const updated = updater({ ...current });
      const row = this.#toRow(updated);

      // Update all fields except id
      const { id: _, ...updateFields } = row;
      const columns = Object.keys(updateFields);
      const values = Object.values(updateFields);
      const setClause = columns.map((col, index) => `${col} = $${index + 1}`);

      const query = `
        UPDATE deposits 
        SET ${setClause.join(', ')}
        WHERE id = $${columns.length + 1}
      `;

      await client.query(query, [...values, id]);
      return { ...updated };
    } finally {
      client.release();
    }
  }

  async findByStatus(status, limit = 100) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM deposits WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
        [status, limit]
      );
      return result.rows.map(row => ({ ...this.#fromRow(row) }));
    } finally {
      client.release();
    }
  }

  async findByCustomerId(customerId, limit = 100) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM deposits WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2',
        [customerId, limit]
      );
      return result.rows.map(row => ({ ...this.#fromRow(row) }));
    } finally {
      client.release();
    }
  }

  async findByPaymentMethodId(paymentMethodId, limit = 100) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM deposits WHERE payment_method_id = $1 ORDER BY created_at DESC LIMIT $2',
        [paymentMethodId, limit]
      );
      return result.rows.map(row => ({ ...this.#fromRow(row) }));
    } finally {
      client.release();
    }
  }

  async findOlderThan(date, limit = 100) {
    await this.#initialize();
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM deposits 
        WHERE COALESCE(last_authorization_at, initial_authorization_at) < $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [date, limit]);
      
      return result.rows.map(row => ({ ...this.#fromRow(row) }));
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  async healthCheck() {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return { healthy: true, database: 'postgresql' };
      } finally {
        client.release();
      }
    } catch (error) {
      return { 
        healthy: false, 
        database: 'postgresql', 
        error: error.message 
      };
    }
  }
}

module.exports = { PostgresDepositRepository };
