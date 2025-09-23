// Stripe webhook handler for Vercel
const { loadEnv } = require('../../src/config');
const { verifyStripeSignature } = require('../../src/stripe/webhookVerifier');
const { StripeWebhookHandler } = require('../../src/stripe/webhookHandler');
const { buildLogger } = require('../../src/utils/logger');

// Helper function to get raw body from Vercel request
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

// Memory-based repository for serverless
class MemoryDepositRepository {
  constructor() {
    this.deposits = new Map();
  }

  async save(deposit) {
    this.deposits.set(deposit.id, { ...deposit });
    return deposit;
  }

  async findById(id) {
    return this.deposits.get(id) || null;
  }

  async findAll(filters = {}) {
    const deposits = Array.from(this.deposits.values());
    let filtered = deposits;

    if (filters.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }
    if (filters.customerId) {
      filtered = filtered.filter(d => d.customerId === filters.customerId);
    }

    return {
      deposits: filtered.slice(0, filters.limit || 100),
      total: filtered.length
    };
  }
}

// Memory-based notification service
class MemoryNotificationService {
  constructor({ logger, externalWebhookUrl, fetch, externalTimeoutMs }) {
    this.logger = logger || { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
    this.externalWebhookUrl = externalWebhookUrl || null;
    this.fetch = fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    this.externalTimeoutMs = externalTimeoutMs || 5000;
    this.notifications = [];
  }

  async notify(event, data) {
    const notification = {
      timestamp: new Date().toISOString(),
      event,
      data
    };
    
    this.notifications.push(notification);
    this.logger.info('Notification', notification);

    if (this.externalWebhookUrl && this.fetch) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.externalTimeoutMs);
        
        await this.fetch(this.externalWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (error) {
        this.logger.error('External webhook failed', { error: error.message });
      }
    }
  }
}



let webhookHandler = null;

function initializeWebhookHandler() {
  if (webhookHandler) return webhookHandler;

  const env = loadEnv();
  const logger = buildLogger('stripe-webhook');
  const repository = new MemoryDepositRepository();
  const notificationService = new MemoryNotificationService({
    logger: buildLogger('notification-service'),
    externalWebhookUrl: env.ALERT_WEBHOOK_URL,
    fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
    externalTimeoutMs: env.ALERT_WEBHOOK_TIMEOUT_MS,
  });
  const clock = { now: () => new Date() };

  webhookHandler = new StripeWebhookHandler({
    repository,
    clock,
    logger,
    notifier: notificationService,
  });

  return webhookHandler;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const env = loadEnv();
    const logger = buildLogger('stripe-webhook-vercel');
    const handler = initializeWebhookHandler();

    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    try {
      const event = verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
      await handler.handle(event);

      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Webhook verification failed', { error: error.message });
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
