const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { StripeWebhookHandler } = require('../src/stripe/webhookHandler');
const { InMemoryDepositRepository } = require('../src/repositories/depositRepository');

function createSilentLogger() {
  return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
}

describe('StripeWebhookHandler', () => {
  let repository;
  let notifications;
  let notifier;
  let handler;
  const clock = { now: () => new Date('2024-02-01T00:00:00.000Z') };

  beforeEach(() => {
    repository = new InMemoryDepositRepository([
      {
        id: 'dep_base',
        customerId: 'cus_1',
        paymentMethodId: 'pm_1',
        currency: 'usd',
        holdAmount: 10000,
        status: 'requires_action',
        verificationPaymentIntentId: 'pi_verify',
        activePaymentIntentId: 'pi_auth',
        createdAt: '2024-01-01T00:00:00.000Z',
        initialAuthorizationAt: null,
        lastAuthorizationAt: '2024-01-01T00:00:00.000Z',
        captureHistory: [],
        authorizationHistory: [],
        metadata: {},
        actionRequired: {
          paymentIntentId: 'pi_auth',
          clientSecret: 'secret',
        },
      },
    ]);
    notifications = [];
    notifier = {
      async notify(event) {
        notifications.push(event);
      },
    };

    handler = new StripeWebhookHandler({
      repository,
      clock,
      logger: createSilentLogger(),
      notifier,
    });
  });

  test('marks deposit authorized when amount becomes capturable', async () => {
    await handler.handleEvent({
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: 'pi_auth',
          amount_capturable: 10000,
          metadata: { deposit_id: 'dep_base' },
        },
      },
    });

    const updated = await repository.findById('dep_base');
    assert.equal(updated.status, 'authorized');
    assert.equal(updated.lastAuthorizationAt, clock.now().toISOString());
    assert.equal(updated.authorizationHistory.length, 1);
    assert.equal(updated.authorizationHistory[0].paymentIntentId, 'pi_auth');
    assert.equal(updated.actionRequired, undefined);
    assert.equal(updated.lastError, undefined);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.authorized');
    assert.equal(notifications[0].depositId, 'dep_base');
  });

  test('sets requires_action when Stripe requests confirmation', async () => {
    await handler.handleEvent({
      type: 'payment_intent.requires_action',
      data: {
        object: {
          id: 'pi_auth',
          client_secret: 'cs_123',
          next_action: {
            type: 'use_stripe_sdk',
            use_stripe_sdk: { type: 'three_d_secure_redirect' },
          },
          metadata: { deposit_id: 'dep_base' },
        },
      },
    });

    const updated = await repository.findById('dep_base');
    assert.equal(updated.status, 'requires_action');
    assert.equal(updated.actionRequired.clientSecret, 'cs_123');
    assert.equal(updated.actionRequired.type, 'use_stripe_sdk');

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.requires_action');
  });

  test('marks authorization_failed when payment fails', async () => {
    await handler.handleEvent({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_auth',
          metadata: { deposit_id: 'dep_base' },
          last_payment_error: {
            code: 'card_declined',
            message: 'Card was declined',
          },
        },
      },
    });

    const updated = await repository.findById('dep_base');
    assert.equal(updated.status, 'authorization_failed');
    assert.equal(updated.lastError.code, 'card_declined');
    assert.equal(updated.actionRequired, undefined);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'deposit.authorization_failed');
    assert.equal(notifications[0].payload.error.code, 'card_declined');
  });
});
