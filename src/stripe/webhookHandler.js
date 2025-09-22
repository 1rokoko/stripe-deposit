class StripeWebhookHandler {
  constructor({ repository, clock, logger, notifier }) {
    if (!repository) {
      throw new Error('StripeWebhookHandler requires a repository');
    }

    this.repository = repository;
    this.clock = clock || { now: () => new Date() };
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    this.notifier = notifier || null;
  }

  async #notify(event) {
    if (!this.notifier || !event) {
      return;
    }

    try {
      await this.notifier.notify(event);
    } catch (error) {
      this.logger.error('Failed to emit notification from webhook handler', {
        error: error.message,
        eventType: event.type,
        depositId: event.depositId,
      });
    }
  }

  async handleEvent(event) {
    if (!event || !event.type) {
      throw new Error('Invalid Stripe event payload');
    }

    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        await this.#handleAmountCapturableUpdated(event.data.object);
        break;
      case 'payment_intent.requires_action':
        await this.#handleRequiresAction(event.data.object);
        break;
      case 'payment_intent.payment_failed':
      case 'payment_intent.requires_payment_method':
        await this.#handlePaymentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        await this.#handleCanceled(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await this.#handleSucceeded(event.data.object);
        break;
      default:
        this.logger.debug('Unhandled Stripe event type', { type: event.type });
    }
  }

  #extractDepositId(intent) {
    const depositId = intent?.metadata?.deposit_id;
    if (!depositId) {
      this.logger.warn('Stripe event missing deposit_id metadata', {
        paymentIntentId: intent?.id,
      });
    }
    return depositId;
  }

  async #updateDeposit(depositId, updater) {
    try {
      await this.repository.update(depositId, updater);
    } catch (error) {
      if (error.message.includes('not found')) {
        this.logger.warn('Stripe event for unknown deposit', { depositId });
        return;
      }
      throw error;
    }
  }

  async #handleAmountCapturableUpdated(intent) {
    const depositId = this.#extractDepositId(intent);
    if (!depositId) {
      return;
    }

    const nowIso = this.clock.now().toISOString();
    const holdAmount = typeof intent.amount_capturable === 'number' && intent.amount_capturable > 0
      ? intent.amount_capturable
      : intent.amount;

    await this.#updateDeposit(depositId, (current) => {
      const history = current.authorizationHistory || [];
      const hasEntry = history.some((entry) => entry.paymentIntentId === intent.id);
      const updatedHistory = hasEntry
        ? history
        : [
            ...history,
            {
              paymentIntentId: intent.id,
              amount: holdAmount ?? current.holdAmount,
              authorizedAt: nowIso,
            },
          ];

      return {
        ...current,
        status: 'authorized',
        activePaymentIntentId: intent.id,
        lastAuthorizationAt: nowIso,
        initialAuthorizationAt: current.initialAuthorizationAt || nowIso,
        holdAmount: holdAmount ?? current.holdAmount,
        actionRequired: undefined,
        lastError: undefined,
        authorizationHistory: updatedHistory,
      };
    });

    await this.#notify({
      type: 'deposit.authorized',
      depositId,
      status: 'authorized',
      message: 'Stripe подтвердил авторизацию (webhook amount_capturable_updated)',
      payload: {
        paymentIntentId: intent.id,
        amount: holdAmount ?? intent.amount,
      },
    });
    this.logger.info('Updated deposit after amount capturable event', {
      depositId,
      paymentIntentId: intent.id,
    });
  }

  async #handleRequiresAction(intent) {
    const depositId = this.#extractDepositId(intent);
    if (!depositId) {
      return;
    }

    const actionPayload = intent.next_action ? { ...intent.next_action } : undefined;
    const actionInfo = actionPayload
      ? {
          type: actionPayload.type,
          nextAction: actionPayload,
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
        }
      : {
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
        };

    await this.#updateDeposit(depositId, (current) => ({
      ...current,
      status: 'requires_action',
      actionRequired: actionInfo,
      lastError: undefined,
    }));

    await this.#notify({
      type: 'deposit.requires_action',
      depositId,
      status: 'requires_action',
      message: 'Stripe требует подтверждения карты (webhook)',
      payload: {
        paymentIntentId: intent.id,
        actionRequired: actionInfo,
      },
    });
    this.logger.info('Marked deposit as requiring customer action', {
      depositId,
      paymentIntentId: intent.id,
    });
  }

  async #handlePaymentFailed(intent) {
    const depositId = this.#extractDepositId(intent);
    if (!depositId) {
      return;
    }

    const errorInfo = intent.last_payment_error
      ? {
          code: intent.last_payment_error.code,
          message: intent.last_payment_error.message,
        }
      : { code: 'unknown', message: 'Payment failed' };

    await this.#updateDeposit(depositId, (current) => ({
      ...current,
      status: 'authorization_failed',
      lastError: errorInfo,
      actionRequired: undefined,
    }));

    await this.#notify({
      type: 'deposit.authorization_failed',
      depositId,
      status: 'authorization_failed',
      message: errorInfo.message,
      payload: {
        paymentIntentId: intent.id,
        error: errorInfo,
      },
    });
    this.logger.warn('Marked deposit as authorization_failed', {
      depositId,
      paymentIntentId: intent.id,
      error: errorInfo,
    });
  }

  async #handleCanceled(intent) {
    const depositId = this.#extractDepositId(intent);
    if (!depositId) {
      return;
    }

    const nowIso = this.clock.now().toISOString();
    await this.#updateDeposit(depositId, (current) => ({
      ...current,
      status: 'canceled',
      releasedAt: nowIso,
      releasedAmount: current.holdAmount,
      actionRequired: undefined,
    }));

    await this.#notify({
      type: 'deposit.canceled',
      depositId,
      status: 'canceled',
      message: 'Stripe отменил авторизацию',
      payload: {
        paymentIntentId: intent.id,
      },
    });
    this.logger.info('Marked deposit as canceled after Stripe cancellation', {
      depositId,
      paymentIntentId: intent.id,
    });
  }

  async #handleSucceeded(intent) {
    const depositId = this.#extractDepositId(intent);
    if (!depositId) {
      return;
    }

    const nowIso = this.clock.now().toISOString();
    const capturedAmount = intent.amount_received ?? intent.amount;

    await this.#updateDeposit(depositId, (current) => {
      const history = current.captureHistory || [];
      const hasEntry = history.some((entry) => entry.paymentIntentId === intent.id);
      const updatedHistory = hasEntry
        ? history
        : [
            ...history,
            {
              paymentIntentId: intent.id,
              amount: capturedAmount,
              capturedAt: nowIso,
            },
          ];

      return {
        ...current,
        status: 'captured',
        capturePaymentIntentId: intent.id,
        capturedAmount,
        capturedAt: nowIso,
        releasedAmount: 0,
        captureHistory: updatedHistory,
        actionRequired: undefined,
        lastError: undefined,
      };
    });

    await this.#notify({
      type: 'deposit.captured',
      depositId,
      status: 'captured',
      message: 'Stripe сообщил об успешном списании депозита',
      payload: {
        paymentIntentId: intent.id,
        capturedAmount,
      },
    });
    this.logger.info('Marked deposit as captured from Stripe event', {
      depositId,
      paymentIntentId: intent.id,
      capturedAmount,
    });
  }
}

module.exports = { StripeWebhookHandler };
