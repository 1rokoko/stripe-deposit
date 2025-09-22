const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { DepositService } = require('../src/services/depositService');
const { InMemoryDepositRepository } = require('../src/repositories/depositRepository');
const { ReauthorizationJob } = require('../src/jobs/reauthorizationJob');

function createSilentLogger() {
  return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
}

describe('DepositService', () => {
  let repository;
  let stripeMock;
  let clock;
  let service;
  let notifications;
  let notifier;

  beforeEach(() => {
    repository = new InMemoryDepositRepository();
    clock = { now: () => new Date('2024-01-01T00:00:00.000Z') };
    notifications = [];
    notifier = {
      async notify(event) {
        notifications.push(event);
      },
    };

    stripeMock = {
      createPaymentIntent: async (payload) => {
        if (payload.amount === 100) {
          stripeMock.verificationPayload = payload;
          return { id: 'pi_verify', status: 'succeeded' };
        }

        stripeMock.authorizationPayload = payload;
        return { id: 'pi_authorize', status: 'requires_capture' };
      },
      createRefund: async (payload) => {
        stripeMock.refundPayload = payload;
        return { id: 're_1', status: 'succeeded' };
      },
      capturePaymentIntent: async () => {
        return { id: 'pi_authorize', status: 'succeeded' };
      },
      cancelPaymentIntent: async () => ({ id: 'pi_authorize', status: 'canceled' }),
    };

    service = new DepositService({
      stripeClient: stripeMock,
      repository,
      clock,
      logger: createSilentLogger(),
      notifier,
    });
  });

  test('initializeDeposit performs verification and authorization', async () => {
    const result = await service.initializeDeposit({
      customerId: 'cus_123',
      paymentMethodId: 'pm_123',
      holdAmount: 10000,
      currency: 'usd',
      metadata: { rental_id: 'rent_1' },
    });

    assert.ok(result.deposit.id, 'deposit id should be generated');
    assert.equal(result.authorizationIntent.id, 'pi_authorize');
    assert.equal(result.verificationIntent.id, 'pi_verify');

    const stored = await repository.findById(result.deposit.id);
    assert.equal(stored.status, 'authorized');
    assert.equal(stored.holdAmount, 10000);
    assert.equal(stored.authorizationHistory.length, 1);
    assert.equal(stored.authorizationHistory[0].status, 'authorized');

    assert.equal(stripeMock.verificationPayload.capture_method, 'automatic');
    assert.equal(stripeMock.authorizationPayload.capture_method, 'manual');
    assert.equal(stripeMock.refundPayload.payment_intent, 'pi_verify');

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.authorized');
    assert.equal(notifications[0].depositId, result.deposit.id);
  });

  test('initializeDeposit surfaces requires_action when Stripe demands 3DS', async () => {
    stripeMock.createPaymentIntent = async (payload) => {
      if (payload.amount === 100) {
        return { id: 'pi_verify', status: 'succeeded' };
      }

      return {
        id: 'pi_action',
        status: 'requires_action',
        client_secret: 'pi_action_secret',
        next_action: {
          type: 'use_stripe_sdk',
          use_stripe_sdk: { type: 'three_d_secure_redirect' },
        },
      };
    };

    const result = await service.initializeDeposit({
      customerId: 'cus_321',
      paymentMethodId: 'pm_321',
      holdAmount: 15000,
    });

    assert.equal(result.deposit.status, 'requires_action');
    assert.equal(result.deposit.actionRequired.type, 'use_stripe_sdk');
    assert.equal(result.deposit.actionRequired.clientSecret, 'pi_action_secret');
    assert.equal(result.deposit.authorizationHistory[0].status, 'requires_action');
    assert.equal(result.deposit.initialAuthorizationAt, null);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.requires_action');
    assert.equal(notifications[0].payload.actionRequired.clientSecret, 'pi_action_secret');
  });

  test('initializeDeposit fails when Stripe requires another payment method', async () => {
    stripeMock.createPaymentIntent = async (payload) => {
      if (payload.amount === 100) {
        return { id: 'pi_verify', status: 'succeeded' };
      }

      return {
        id: 'pi_failed',
        status: 'requires_payment_method',
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined',
        },
      };
    };

    await assert.rejects(
      () =>
        service.initializeDeposit({
          customerId: 'cus_987',
          paymentMethodId: 'pm_987',
          holdAmount: 12000,
        }),
      /Your card was declined/,
    );

    const stored = await repository.list();
    assert.equal(stored.length, 0);
    assert.equal(notifications.length, 0);
  });

  test('captureDeposit captures partial amount and releases remainder', async () => {
    const deposit = {
      id: 'dep_1',
      customerId: 'cus_123',
      paymentMethodId: 'pm_123',
      currency: 'usd',
      holdAmount: 20000,
      status: 'authorized',
      verificationPaymentIntentId: 'pi_verify',
      activePaymentIntentId: 'pi_authorize',
      createdAt: clock.now().toISOString(),
      initialAuthorizationAt: clock.now().toISOString(),
      lastAuthorizationAt: clock.now().toISOString(),
      captureHistory: [],
      authorizationHistory: [],
      metadata: {},
    };
    await repository.create(deposit);

    let captureParams;
    stripeMock.capturePaymentIntent = async (paymentIntentId, payload) => {
      captureParams = { paymentIntentId, payload };
      return { id: paymentIntentId, status: 'succeeded' };
    };

    const { deposit: updated } = await service.captureDeposit({ depositId: 'dep_1', amountToCapture: 7500 });

    assert.equal(updated.status, 'captured');
    assert.equal(updated.capturedAmount, 7500);
    assert.equal(updated.releasedAmount, 12500);
    assert.equal(updated.captureHistory.length, 1);
    assert.deepEqual(captureParams, {
      paymentIntentId: 'pi_authorize',
      payload: { amount_to_capture: 7500 },
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.captured');
    assert.equal(notifications[0].payload.capturedAmount, 7500);
  });

  test('releaseDeposit cancels authorization and emits notification', async () => {
    const deposit = {
      id: 'dep_rel',
      customerId: 'cus_rel',
      paymentMethodId: 'pm_rel',
      currency: 'usd',
      holdAmount: 10000,
      status: 'authorized',
      verificationPaymentIntentId: 'pi_verify',
      activePaymentIntentId: 'pi_hold',
      createdAt: clock.now().toISOString(),
      initialAuthorizationAt: clock.now().toISOString(),
      lastAuthorizationAt: clock.now().toISOString(),
      captureHistory: [],
      authorizationHistory: [],
      metadata: {},
    };
    await repository.create(deposit);

    const result = await service.releaseDeposit({ depositId: 'dep_rel' });
    assert.equal(result.deposit.status, 'released');
    assert.equal(result.deposit.releasedAmount, 10000);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.released');
    assert.equal(notifications[0].payload.releasedAmount, 10000);
  });

  test('reauthorizeDeposit refreshes the active payment intent', async () => {
    const oldDate = new Date('2023-12-25T00:00:00.000Z').toISOString();
    const deposit = {
      id: 'dep_2',
      customerId: 'cus_456',
      paymentMethodId: 'pm_456',
      currency: 'usd',
      holdAmount: 15000,
      status: 'authorized',
      verificationPaymentIntentId: 'pi_verify_old',
      activePaymentIntentId: 'pi_old',
      createdAt: oldDate,
      initialAuthorizationAt: oldDate,
      lastAuthorizationAt: oldDate,
      captureHistory: [],
      authorizationHistory: [],
      metadata: { rental_id: 'rent_2' },
    };
    await repository.create(deposit);

    stripeMock.createPaymentIntent = async (payload) => {
      stripeMock.reauthPayload = payload;
      return { id: 'pi_new', status: 'requires_capture' };
    };

    let cancelled;
    stripeMock.cancelPaymentIntent = async (paymentIntentId) => {
      cancelled = paymentIntentId;
      return { id: paymentIntentId, status: 'canceled' };
    };

    const { deposit: updated } = await service.reauthorizeDeposit({ depositId: 'dep_2', metadata: { cycle: 'renewal_1' } });

    assert.equal(updated.activePaymentIntentId, 'pi_new');
    assert.equal(updated.authorizationHistory.length, 1);
    assert.equal(updated.authorizationHistory[0].paymentIntentId, 'pi_new');
    assert.equal(cancelled, 'pi_old');
    assert.equal(stripeMock.reauthPayload.capture_method, 'manual');
    assert.equal(stripeMock.reauthPayload.metadata.cycle, 'renewal_1');

    assert.equal(notifications.at(-1).type, 'deposit.authorized');
  });

  test('reauthorizeDeposit marks deposit as requires_action when Stripe demands 3DS', async () => {
    const oldDate = clock.now().toISOString();
    const deposit = {
      id: 'dep_3',
      customerId: 'cus_edge',
      paymentMethodId: 'pm_edge',
      currency: 'usd',
      holdAmount: 18000,
      status: 'authorized',
      verificationPaymentIntentId: 'pi_verify_edge',
      activePaymentIntentId: 'pi_active_old',
      createdAt: oldDate,
      initialAuthorizationAt: oldDate,
      lastAuthorizationAt: oldDate,
      captureHistory: [],
      authorizationHistory: [],
      metadata: {},
    };
    await repository.create(deposit);

    stripeMock.createPaymentIntent = async () => ({
      id: 'pi_need_action',
      status: 'requires_action',
      client_secret: 'pi_need_action_secret',
      next_action: {
        type: 'redirect_to_url',
        redirect_to_url: { url: 'https://stripe.test' },
      },
    });

    let cancelledOld;
    stripeMock.cancelPaymentIntent = async (paymentIntentId) => {
      cancelledOld = paymentIntentId;
      return { id: paymentIntentId, status: 'canceled' };
    };

    const { deposit: updated } = await service.reauthorizeDeposit({ depositId: 'dep_3' });

    assert.equal(updated.status, 'requires_action');
    assert.equal(updated.activePaymentIntentId, 'pi_need_action');
    assert.equal(updated.actionRequired.clientSecret, 'pi_need_action_secret');
    assert.equal(cancelledOld, 'pi_active_old');

    assert.equal(notifications.at(-1).type, 'deposit.requires_action');
  });

  test('resolveDepositRequiresAction marks deposit as authorized and clears actionRequired', async () => {
    const deposit = {
      id: 'dep_resolve',
      customerId: 'cus_resolve',
      paymentMethodId: 'pm_resolve',
      currency: 'usd',
      holdAmount: 15000,
      status: 'requires_action',
      verificationPaymentIntentId: 'pi_verify',
      activePaymentIntentId: 'pi_active',
      createdAt: clock.now().toISOString(),
      initialAuthorizationAt: null,
      lastAuthorizationAt: clock.now().toISOString(),
      captureHistory: [],
      authorizationHistory: [
        {
          paymentIntentId: 'pi_active',
          amount: 15000,
          authorizedAt: null,
          status: 'requires_action',
        },
      ],
      metadata: { order_id: 'order_1' },
      actionRequired: { clientSecret: 'secret', paymentIntentId: 'pi_active' },
    };
    await repository.create(deposit);

    const { deposit: updated } = await service.resolveDepositRequiresAction({
      depositId: 'dep_resolve',
      metadata: { resolvedBy: 'operator_1' },
    });

    assert.equal(updated.status, 'authorized');
    assert.equal(updated.actionRequired, undefined);
    assert.equal(updated.lastError, undefined);
    assert.equal(updated.authorizationHistory[0].status, 'authorized');
    assert.equal(updated.metadata.resolvedBy, 'operator_1');
    assert.equal(notifications.at(-1).type, 'deposit.authorized');
  });

  test('resolveDepositRequiresAction fails if deposit is not waiting for action', async () => {
    const deposit = {
      id: 'dep_wrong_status',
      customerId: 'cus1',
      paymentMethodId: 'pm1',
      currency: 'usd',
      holdAmount: 10000,
      status: 'authorized',
      verificationPaymentIntentId: 'pi_v',
      activePaymentIntentId: 'pi_a',
      createdAt: clock.now().toISOString(),
      initialAuthorizationAt: clock.now().toISOString(),
      lastAuthorizationAt: clock.now().toISOString(),
      captureHistory: [],
      authorizationHistory: [],
      metadata: {},
    };
    await repository.create(deposit);

    await assert.rejects(
      () => service.resolveDepositRequiresAction({ depositId: 'dep_wrong_status' }),
      /not waiting for customer action/i,
    );
  });
});

describe('ReauthorizationJob', () => {
  test('re-authorizes deposits older than threshold', async () => {
    const now = new Date('2024-02-01T00:00:00.000Z');
    const oldDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const repository = new InMemoryDepositRepository([
      {
        id: 'dep_old',
        customerId: 'cus_1',
        paymentMethodId: 'pm_1',
        currency: 'usd',
        holdAmount: 10000,
        status: 'authorized',
        verificationPaymentIntentId: 'pi_v',
        activePaymentIntentId: 'pi_old',
        createdAt: oldDate.toISOString(),
        initialAuthorizationAt: oldDate.toISOString(),
        lastAuthorizationAt: oldDate.toISOString(),
        captureHistory: [],
        authorizationHistory: [],
        metadata: {},
      },
      {
        id: 'dep_recent',
        customerId: 'cus_2',
        paymentMethodId: 'pm_2',
        currency: 'usd',
        holdAmount: 20000,
        status: 'authorized',
        verificationPaymentIntentId: 'pi_v2',
        activePaymentIntentId: 'pi_recent',
        createdAt: now.toISOString(),
        initialAuthorizationAt: now.toISOString(),
        lastAuthorizationAt: now.toISOString(),
        captureHistory: [],
        authorizationHistory: [],
        metadata: {},
      },
      {
        id: 'dep_requires_action',
        customerId: 'cus_3',
        paymentMethodId: 'pm_3',
        currency: 'usd',
        holdAmount: 15000,
        status: 'requires_action',
        verificationPaymentIntentId: 'pi_v3',
        activePaymentIntentId: 'pi_pending',
        createdAt: now.toISOString(),
        initialAuthorizationAt: null,
        lastAuthorizationAt: now.toISOString(),
        captureHistory: [],
        authorizationHistory: [],
        metadata: {},
      },
    ]);

    const called = [];
    const depositService = {
      async reauthorizeDeposit({ depositId }) {
        called.push(depositId);
      },
    };

    const job = new ReauthorizationJob({
      depositService,
      repository,
      clock: { now: () => now },
      logger: createSilentLogger(),
      reauthorizeAfterDays: 5,
    });

    await job.runCycle();

    assert.deepEqual(called, ['dep_old']);
  });

  test('records health metrics for every cycle', async () => {
    const now = new Date('2024-02-10T00:00:00.000Z');
    const oldDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const repository = new InMemoryDepositRepository([
      {
        id: 'dep_metrics',
        customerId: 'cus_metrics',
        paymentMethodId: 'pm_metrics',
        currency: 'usd',
        holdAmount: 12000,
        status: 'authorized',
        verificationPaymentIntentId: 'pi_v',
        activePaymentIntentId: 'pi_old',
        createdAt: oldDate.toISOString(),
        initialAuthorizationAt: oldDate.toISOString(),
        lastAuthorizationAt: oldDate.toISOString(),
        captureHistory: [],
        authorizationHistory: [],
        metadata: {},
      },
    ]);

    const called = [];
    const depositService = {
      async reauthorizeDeposit({ depositId }) {
        called.push(depositId);
      },
    };

    const healthRecords = [];
    const job = new ReauthorizationJob({
      depositService,
      repository,
      clock: { now: () => now },
      logger: createSilentLogger(),
      reauthorizeAfterDays: 5,
      healthStore: {
        async recordRun(payload) {
          healthRecords.push(payload);
        },
      },
    });

    await job.runCycle();

    assert.deepEqual(called, ['dep_metrics']);
    assert.equal(healthRecords.length, 1);

    const record = healthRecords[0];
    assert.equal(record.jobName, 'reauthorization');
    assert.equal(record.success, true);
    assert.equal(record.stats.reauthorized, 1);
    assert.equal(record.stats.failures, 0);
  });
});
