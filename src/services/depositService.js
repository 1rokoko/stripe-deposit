const { randomUUID } = require('crypto');

class DepositService {
  constructor({ stripeClient, repository, clock, logger, notifier }) {
    if (!stripeClient) {
      throw new Error('DepositService requires a stripeClient');
    }

    if (!repository) {
      throw new Error('DepositService requires a repository');
    }

    this.stripeClient = stripeClient;
    this.repository = repository;
    this.clock = clock || { now: () => new Date() };
    this.logger = logger || { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
    this.notifier = notifier || null;
  }

  async #notify(event) {
    if (!this.notifier || !event) {
      return;
    }

    try {
      await this.notifier.notify(event);
    } catch (error) {
      this.logger.error('Notification failed', {
        error: error.message,
        eventType: event.type,
        depositId: event.depositId,
      });
    }
  }

  #buildActionRequired(intent) {
    if (!intent) {
      return undefined;
    }

    const nextAction = intent.next_action ? { ...intent.next_action } : undefined;
    if (!nextAction && !intent.client_secret) {
      return undefined;
    }

    return {
      paymentIntentId: intent.id,
      type: nextAction?.type,
      nextAction,
      clientSecret: intent.client_secret,
    };
  }

  #extractLastError(intent) {
    const error = intent?.last_payment_error;
    if (!error) {
      return undefined;
    }

    return {
      code: error.code,
      message: error.message,
    };
  }

  #failureFromIntent(intent, fallbackMessage) {
    const lastError = this.#extractLastError(intent);
    const message = lastError?.message || fallbackMessage;
    const error = new Error(message);
    error.code = lastError?.code;
    error.statusCode = 402;
    return {
      state: 'error',
      error,
      lastError,
    };
  }

  #interpretAuthorizationIntent(intent) {
    const status = intent.status;
    switch (status) {
      case 'requires_capture':
        return { state: 'authorized' };
      case 'requires_action':
        return {
          state: 'requires_action',
          actionRequired: this.#buildActionRequired(intent),
        };
      case 'processing':
        return { state: 'processing' };
      case 'succeeded': {
        const capturedAmount = intent.amount_received ?? intent.amount ?? null;
        return {
          state: 'captured',
          capturedAmount: capturedAmount ?? undefined,
        };
      }
      case 'requires_payment_method':
        return this.#failureFromIntent(intent, 'Stripe declined the card; a new payment method is required.');
      case 'canceled':
        return this.#failureFromIntent(intent, 'Payment authorization was canceled by Stripe.');
      case 'requires_confirmation':
      case 'requires_source':
      case 'requires_source_action':
      case 'requires_source_payment_method':
      case 'payment_failed':
        return this.#failureFromIntent(intent, `Stripe cannot authorize the payment (status: ${status}).`);
      default:
        return this.#failureFromIntent(intent, `Unexpected PaymentIntent status: ${status}.`);
    }
  }

  async initializeDeposit({ customerId, paymentMethodId, holdAmount, currency = 'usd', metadata = {} }) {
    if (!customerId) {
      throw new Error('customerId is required');
    }

    if (!paymentMethodId) {
      throw new Error('paymentMethodId is required');
    }

    if (!Number.isInteger(holdAmount) || holdAmount <= 0) {
      throw new Error('holdAmount must be a positive integer representing cents');
    }

    const now = this.clock.now();
    const depositId = randomUUID();

    this.logger.info('Initializing deposit', { customerId, holdAmount, depositId });

    const verificationIntent = await this.stripeClient.createPaymentIntent({
      amount: 100,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      capture_method: 'automatic',
      description: 'Card verification for rental security deposit',
      metadata: { ...metadata, deposit_id: depositId, purpose: 'verification_charge' },
    });

    if (verificationIntent.status !== 'succeeded') {
      try {
        await this.stripeClient.cancelPaymentIntent(verificationIntent.id);
      } catch (error) {
        this.logger.warn('Unable to cancel verification payment intent after failure', {
          depositId,
          error: error.message,
        });
      }

      throw new Error('Failed to verify card before creating a deposit hold');
    }

    await this.stripeClient.createRefund({
      payment_intent: verificationIntent.id,
      reason: 'requested_by_customer',
      metadata: { ...metadata, deposit_id: depositId, purpose: 'verification_refund' },
    });

    const authorizationIntent = await this.stripeClient.createPaymentIntent({
      amount: holdAmount,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      capture_method: 'manual',
      setup_future_usage: 'off_session',
      description: `Rental security deposit hold ${holdAmount / 100} ${currency.toUpperCase()}`,
      metadata: { ...metadata, deposit_id: depositId, purpose: 'rental_security_deposit' },
    });

    const interpretation = this.#interpretAuthorizationIntent(authorizationIntent);
    if (interpretation.state === 'error') {
      try {
        await this.stripeClient.cancelPaymentIntent(authorizationIntent.id);
      } catch (error) {
        this.logger.warn('Unable to cancel failed authorization intent', {
          depositId,
          error: error.message,
        });
      }

      throw interpretation.error;
    }

    const nowIso = now.toISOString();
    const authorizationHistoryEntry = {
      paymentIntentId: authorizationIntent.id,
      amount: holdAmount,
      authorizedAt: nowIso,
      status: interpretation.state,
    };

    const deposit = {
      id: depositId,
      customerId,
      paymentMethodId,
      currency,
      holdAmount,
      status: interpretation.state === 'captured' ? 'captured' : interpretation.state,
      verificationPaymentIntentId: verificationIntent.id,
      activePaymentIntentId: authorizationIntent.id,
      createdAt: nowIso,
      initialAuthorizationAt: interpretation.state === 'authorized' ? nowIso : null,
      lastAuthorizationAt: nowIso,
      captureHistory: [],
      authorizationHistory: [authorizationHistoryEntry],
      metadata,
      actionRequired: interpretation.actionRequired,
      lastError: interpretation.lastError,
    };

    if (interpretation.state === 'captured') {
      const capturedAmount = interpretation.capturedAmount ?? holdAmount;
      deposit.capturedAmount = capturedAmount;
      deposit.capturedAt = nowIso;
      deposit.capturePaymentIntentId = authorizationIntent.id;
      deposit.captureHistory = [
        {
          paymentIntentId: authorizationIntent.id,
          amount: capturedAmount,
          capturedAt: nowIso,
        },
      ];
      deposit.releasedAmount = 0;
    }

    if (interpretation.state === 'requires_action') {
      deposit.initialAuthorizationAt = null;
    }

    await this.repository.create(deposit);

    const baseNotification = {
      depositId,
      status: deposit.status,
      payload: {
        customerId,
        holdAmount,
        paymentIntentId: authorizationIntent.id,
      },
    };

    switch (deposit.status) {
      case 'requires_action':
        await this.#notify({
          ...baseNotification,
          type: 'deposit.requires_action',
          message: 'Stripe требует дополнительного подтверждения карты',
          payload: {
            ...baseNotification.payload,
            actionRequired: deposit.actionRequired,
          },
        });
        break;
      case 'authorized':
        await this.#notify({
          ...baseNotification,
          type: 'deposit.authorized',
          message: 'Депозит успешно авторизован',
        });
        break;
      case 'captured':
        await this.#notify({
          ...baseNotification,
          type: 'deposit.captured',
          message: 'Stripe автоматически списал депозит во время авторизации',
          payload: {
            ...baseNotification.payload,
            capturedAmount: deposit.capturedAmount,
          },
        });
        break;
      case 'processing':
        await this.#notify({
          ...baseNotification,
          type: 'deposit.processing',
          message: 'Депозит ожидает подтверждения Stripe',
        });
        break;
      default:
        break;
    }

    return {
      deposit,
      authorizationIntent,
      verificationIntent,
    };
  }

  async captureDeposit({ depositId, amountToCapture }) {
    if (!depositId) {
      throw new Error('depositId is required');
    }

    const deposit = await this.repository.findById(depositId);
    if (!deposit) {
      throw new Error(`Deposit ${depositId} not found`);
    }

    if (deposit.status !== 'authorized') {
      throw new Error(`Deposit ${depositId} is not in an authorized state`);
    }

    const amount = amountToCapture !== undefined ? amountToCapture : deposit.holdAmount;
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error('amountToCapture must be a non-negative integer representing cents');
    }

    if (amount > deposit.holdAmount) {
      throw new Error('Cannot capture more than the authorized amount');
    }

    const capturePayload = amount !== deposit.holdAmount ? { amount_to_capture: amount } : undefined;
    const captureResponse = await this.stripeClient.capturePaymentIntent(deposit.activePaymentIntentId, capturePayload);

    const now = this.clock.now();
    const releasedAmount = deposit.holdAmount - amount;

    const updated = await this.repository.update(deposit.id, (current) => ({
      ...current,
      status: 'captured',
      capturedAmount: amount,
      releasedAmount,
      capturedAt: now.toISOString(),
      capturePaymentIntentId: captureResponse.id,
      captureHistory: [
        ...(current.captureHistory || []),
        {
          paymentIntentId: captureResponse.id,
          amount,
          capturedAt: now.toISOString(),
        },
      ],
      lastError: undefined,
      actionRequired: undefined,
    }));

    await this.#notify({
      type: 'deposit.captured',
      depositId,
      status: 'captured',
      message: 'Депозит полностью или частично списан',
      payload: {
        capturedAmount: amount,
        releasedAmount,
        paymentIntentId: captureResponse.id,
      },
    });

    return {
      deposit: updated,
      captureResponse,
    };
  }

  async releaseDeposit({ depositId }) {
    if (!depositId) {
      throw new Error('depositId is required');
    }

    const deposit = await this.repository.findById(depositId);
    if (!deposit) {
      throw new Error(`Deposit ${depositId} not found`);
    }

    if (deposit.status !== 'authorized') {
      throw new Error(`Deposit ${depositId} is not in an authorized state`);
    }

    await this.stripeClient.cancelPaymentIntent(deposit.activePaymentIntentId);

    const now = this.clock.now();
    const updated = await this.repository.update(deposit.id, (current) => ({
      ...current,
      status: 'released',
      releasedAmount: current.holdAmount,
      releasedAt: now.toISOString(),
      lastError: undefined,
      actionRequired: undefined,
    }));

    await this.#notify({
      type: 'deposit.released',
      depositId,
      status: 'released',
      message: 'Депозит полностью освобождён оператором',
      payload: {
        releasedAmount: deposit.holdAmount,
        paymentIntentId: deposit.activePaymentIntentId,
      },
    });

    return { deposit: updated };
  }

  async reauthorizeDeposit({ depositId, metadata = {} }) {
    if (!depositId) {
      throw new Error('depositId is required');
    }

    const deposit = await this.repository.findById(depositId);
    if (!deposit) {
      throw new Error(`Deposit ${depositId} not found`);
    }

    if (deposit.status !== 'authorized' && deposit.status !== 'processing') {
      throw new Error(`Deposit ${depositId} cannot be reauthorized because it is ${deposit.status}`);
    }

    const now = this.clock.now();

    const newIntent = await this.stripeClient.createPaymentIntent({
      amount: deposit.holdAmount,
      currency: deposit.currency,
      customer: deposit.customerId,
      payment_method: deposit.paymentMethodId,
      confirm: true,
      off_session: true,
      capture_method: 'manual',
      setup_future_usage: 'off_session',
      description: `Re-authorization for rental security deposit ${deposit.id}`,
      metadata: { ...deposit.metadata, ...metadata, deposit_id: deposit.id, purpose: 'rental_security_deposit_renewal' },
    });

    const interpretation = this.#interpretAuthorizationIntent(newIntent);
    if (interpretation.state === 'error') {
      this.logger.warn('Reauthorization failed', {
        depositId,
        paymentIntentId: newIntent.id,
        error: interpretation.error.message,
      });

      await this.repository.update(deposit.id, (current) => ({
        ...current,
        lastError: interpretation.lastError,
      }));

      await this.#notify({
        type: 'deposit.authorization_failed',
        depositId,
        status: 'authorization_failed',
        message: interpretation.error.message,
        payload: {
          paymentIntentId: newIntent.id,
          lastError: interpretation.lastError,
        },
      });

      try {
        await this.stripeClient.cancelPaymentIntent(newIntent.id);
      } catch (error) {
        this.logger.warn('Unable to cancel failed reauthorization intent', {
          depositId,
          error: error.message,
        });
      }

      throw interpretation.error;
    }

    if (deposit.activePaymentIntentId) {
      try {
        await this.stripeClient.cancelPaymentIntent(deposit.activePaymentIntentId);
      } catch (error) {
        this.logger.warn('Unable to cancel previous authorization intent', {
          depositId,
          error: error.message,
        });
      }
    }

    const nowIso = now.toISOString();

    const updated = await this.repository.update(deposit.id, (current) => {
      const history = current.authorizationHistory || [];
      const hasEntry = history.some((entry) => entry.paymentIntentId === newIntent.id);
      const updatedHistory = hasEntry
        ? history
        : [
            ...history,
            {
              paymentIntentId: newIntent.id,
              amount: current.holdAmount,
              authorizedAt: nowIso,
              status: interpretation.state,
            },
          ];

      const base = {
        ...current,
        status: interpretation.state === 'captured' ? 'captured' : interpretation.state,
        activePaymentIntentId: newIntent.id,
        lastAuthorizationAt: nowIso,
        authorizationHistory: updatedHistory,
        actionRequired: interpretation.actionRequired,
        lastError: interpretation.lastError,
      };

      if (interpretation.state === 'authorized') {
        base.initialAuthorizationAt = base.initialAuthorizationAt || nowIso;
      }

      if (interpretation.state === 'captured') {
        const capturedAmount = interpretation.capturedAmount ?? current.holdAmount;
        base.capturedAmount = capturedAmount;
        base.capturedAt = nowIso;
        base.capturePaymentIntentId = newIntent.id;
        base.captureHistory = [
          ...(current.captureHistory || []),
          {
            paymentIntentId: newIntent.id,
            amount: capturedAmount,
            capturedAt: nowIso,
          },
        ];
        base.releasedAmount = 0;
      }

      if (interpretation.state === 'requires_action') {
        base.initialAuthorizationAt = current.initialAuthorizationAt;
      }

      return base;
    });

    const baseNotification = {
      type: 'deposit.authorized',
      depositId,
      status: updated.status,
      payload: {
        paymentIntentId: newIntent.id,
        holdAmount: deposit.holdAmount,
      },
    };

    switch (updated.status) {
      case 'authorized':
        baseNotification.message = 'Депозит успешно переавторизован';
        await this.#notify(baseNotification);
        break;
      case 'requires_action':
        await this.#notify({
          type: 'deposit.requires_action',
          depositId,
          status: 'requires_action',
          message: 'Stripe требует подтверждения карты после переавторизации',
          payload: {
            paymentIntentId: newIntent.id,
            actionRequired: updated.actionRequired,
            holdAmount: deposit.holdAmount,
          },
        });
        break;
      case 'processing':
        await this.#notify({
          type: 'deposit.processing',
          depositId,
          status: 'processing',
          message: 'Stripe обрабатывает переавторизацию',
          payload: {
            paymentIntentId: newIntent.id,
            holdAmount: deposit.holdAmount,
          },
        });
        break;
      case 'captured':
        await this.#notify({
          type: 'deposit.captured',
          depositId,
          status: 'captured',
          message: 'Stripe списал депозит во время переавторизации',
          payload: {
            paymentIntentId: newIntent.id,
            capturedAmount: updated.capturedAmount,
          },
        });
        break;
      default:
        break;
    }

    return { deposit: updated, authorizationIntent: newIntent };
  }

  async resolveDepositRequiresAction({ depositId, metadata = {} }) {
    if (!depositId) {
      throw new Error('depositId is required');
    }

    const deposit = await this.repository.findById(depositId);
    if (!deposit) {
      throw new Error(`Deposit ${depositId} not found`);
    }

    if (deposit.status !== 'requires_action') {
      throw new Error(`Deposit ${depositId} is not waiting for customer action`);
    }

    const now = this.clock.now();
    const nowIso = now.toISOString();

    const updated = await this.repository.update(depositId, (current) => {
      const history = Array.isArray(current.authorizationHistory) ? [...current.authorizationHistory] : [];
      const activeIntentId = current.activePaymentIntentId;
      let updatedHistory = history;

      if (activeIntentId) {
        const index = history.findIndex((entry) => entry.paymentIntentId === activeIntentId);
        if (index >= 0) {
          updatedHistory = history.map((entry, entryIndex) => {
            if (entryIndex !== index) {
              return entry;
            }
            return {
              ...entry,
              status: 'authorized',
              authorizedAt: entry.authorizedAt || nowIso,
            };
          });
        } else {
          updatedHistory = [
            ...history,
            {
              paymentIntentId: activeIntentId,
              amount: current.holdAmount,
              authorizedAt: nowIso,
              status: 'authorized',
            },
          ];
        }
      }

      return {
        ...current,
        status: 'authorized',
        actionRequired: undefined,
        lastError: undefined,
        lastAuthorizationAt: nowIso,
        initialAuthorizationAt: current.initialAuthorizationAt || nowIso,
        metadata: { ...(current.metadata || {}), ...metadata },
        authorizationHistory: updatedHistory,
      };
    });

    await this.#notify({
      type: 'deposit.authorized',
      depositId,
      status: 'authorized',
      message: 'Оператор подтвердил, что клиент завершил подтверждение карты',
      payload: {
        paymentIntentId: updated.activePaymentIntentId,
        holdAmount: updated.holdAmount,
      },
    });

    return { deposit: updated };
  }

  async getDeposit(depositId) {
    if (!depositId) {
      throw new Error('depositId is required');
    }

    const deposit = await this.repository.findById(depositId);
    if (!deposit) {
      throw new Error(`Deposit ${depositId} not found`);
    }

    return deposit;
  }

  async listDeposits() {
    return this.repository.list();
  }
}

module.exports = { DepositService };
