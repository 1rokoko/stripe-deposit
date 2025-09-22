const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { SqliteDepositRepository } = require('../src/repositories/sqliteDepositRepository');

function buildDeposit(overrides = {}) {
  const base = {
    id: 'dep_repo',
    customerId: 'cus_repo',
    paymentMethodId: 'pm_repo',
    currency: 'usd',
    holdAmount: 12345,
    status: 'authorized',
    verificationPaymentIntentId: 'pi_verify',
    activePaymentIntentId: 'pi_active',
    createdAt: '2024-01-01T00:00:00.000Z',
    initialAuthorizationAt: '2024-01-01T00:00:00.000Z',
    lastAuthorizationAt: '2024-01-01T00:00:00.000Z',
    captureHistory: [],
    authorizationHistory: [],
    metadata: { orderId: 'order_repo' },
    lastError: null,
    actionRequired: null,
  };
  return { ...base, ...overrides };
}

describe('SqliteDepositRepository', () => {
  test('persists and retrieves deposits with JSON fields', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-repo-'));
    const dbPath = path.join(tempDir, 'deposits.sqlite');
    const repository = new SqliteDepositRepository({ filePath: dbPath });

    const original = buildDeposit({
      status: 'requires_action',
      actionRequired: { paymentIntentId: 'pi_active', clientSecret: 'secret' },
    });

    await repository.create(original);

    const stored = await repository.findById(original.id);
    assert.equal(stored.status, 'requires_action');
    assert.equal(stored.metadata.orderId, 'order_repo');
    assert.equal(stored.actionRequired.clientSecret, 'secret');

    const updated = await repository.update(original.id, (current) => ({
      ...current,
      status: 'authorized',
      actionRequired: null,
      lastError: { code: 'manual_override', message: 'Operator resolved' },
    }));

    assert.equal(updated.status, 'authorized');
    assert.equal(updated.lastError.code, 'manual_override');

    const list = await repository.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, original.id);
  });
});
