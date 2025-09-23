// Vercel serverless function adapter for stripe-deposit
const { loadEnv } = require('../src/config');
const { StripeClient } = require('../src/stripe/stripeClient');
const { verifyStripeSignature } = require('../src/stripe/webhookVerifier');
const { StripeWebhookHandler } = require('../src/stripe/webhookHandler');
const { DepositService } = require('../src/services/depositService');
const { NotificationService } = require('../src/services/notificationService');
const { buildLogger } = require('../src/utils/logger');

// Mock implementations for serverless environment
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

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  async findByCustomerId(customerId) {
    return Array.from(this.deposits.values()).filter(d => d.customerId === customerId);
  }

  async findByStatus(status) {
    return Array.from(this.deposits.values()).filter(d => d.status === status);
  }

  async findByPaymentIntentId(paymentIntentId) {
    return Array.from(this.deposits.values()).find(d => d.paymentIntentId === paymentIntentId) || null;
  }

  async findOlderThan(date) {
    return Array.from(this.deposits.values()).filter(d => new Date(d.createdAt) < date);
  }

  async count(filters = {}) {
    const deposits = await this.findAll(filters);
    return deposits.length;
  }
}

class MemoryNotificationService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.externalWebhookUrl = options.externalWebhookUrl;
    this.fetch = options.fetch;
    this.externalTimeoutMs = options.externalTimeoutMs || 5000;
    this.notifications = [];
  }

  async notify(event, data) {
    const notification = {
      id: Date.now().toString(),
      event,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.notifications.push(notification);
    this.logger.info('Notification logged', { event, data });

    if (this.externalWebhookUrl && this.fetch) {
      try {
        await this.fetch(this.externalWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification),
          timeout: this.externalTimeoutMs
        });
      } catch (error) {
        this.logger.error('External webhook failed', { error: error.message });
      }
    }
  }

  async getNotifications(filters = {}) {
    let filtered = [...this.notifications];
    
    if (filters.event) {
      filtered = filtered.filter(n => n.event === filters.event);
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

class MemoryJobHealthStore {
  constructor() {
    this.healthData = new Map();
  }

  async recordJobHealth(jobName, health) {
    this.healthData.set(jobName, {
      ...health,
      timestamp: new Date().toISOString()
    });
  }

  async getJobHealth(jobName) {
    return this.healthData.get(jobName) || null;
  }

  async getAllJobHealth() {
    const result = {};
    for (const [jobName, health] of this.healthData.entries()) {
      result[jobName] = health;
    }
    return result;
  }
}

class MemoryWebhookRetryQueue {
  constructor() {
    this.queue = [];
    this.deadLetter = [];
  }

  async enqueue(webhook) {
    this.queue.push({
      ...webhook,
      id: Date.now().toString(),
      enqueuedAt: new Date().toISOString(),
      attempts: 0
    });
  }

  async dequeue() {
    return this.queue.shift() || null;
  }

  async requeue(webhook) {
    webhook.attempts = (webhook.attempts || 0) + 1;
    webhook.lastAttemptAt = new Date().toISOString();
    
    if (webhook.attempts >= 3) {
      this.deadLetter.push(webhook);
    } else {
      this.queue.push(webhook);
    }
  }

  async getStats() {
    return {
      pending: this.queue.length,
      deadLetter: this.deadLetter.length
    };
  }

  async drain() {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }
}

// Rate limiting
const rateLimitBuckets = new Map();

function checkRateLimit(clientIP, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitBuckets.has(clientIP)) {
    rateLimitBuckets.set(clientIP, []);
  }
  
  const bucket = rateLimitBuckets.get(clientIP);
  
  // Remove old requests outside the window
  const validRequests = bucket.filter(timestamp => timestamp > windowStart);
  rateLimitBuckets.set(clientIP, validRequests);
  
  // Check if limit exceeded
  if (validRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...validRequests);
    const retryAfterMs = oldestRequest + windowMs - now;
    
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      resetAt: new Date(oldestRequest + windowMs).toISOString()
    };
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitBuckets.set(clientIP, validRequests);
  
  return {
    allowed: true,
    remaining: maxRequests - validRequests.length,
    retryAfterSeconds: 0,
    resetAt: new Date(now + windowMs).toISOString()
  };
}

// Service initialization
let services = null;

function initializeServices() {
  if (services) return services;

  const env = loadEnv();
  const logger = buildLogger('vercel-api');

  // Validate required environment variables
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  if (!env.API_AUTH_TOKEN) {
    throw new Error('API_AUTH_TOKEN environment variable is required');
  }
  
  const repository = new MemoryDepositRepository();
  const notificationService = new MemoryNotificationService({
    logger: buildLogger('notification-service'),
    externalWebhookUrl: env.ALERT_WEBHOOK_URL,
    fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
    externalTimeoutMs: env.ALERT_WEBHOOK_TIMEOUT_MS,
  });
  
  const stripeClient = new StripeClient({ apiKey: env.STRIPE_SECRET_KEY });
  const clock = { now: () => new Date() };
  
  const depositService = new DepositService({
    repository,
    stripeClient,
    notificationService,
    clock,
    logger: buildLogger('deposit-service')
  });

  const webhookHandler = new StripeWebhookHandler({
    repository,
    clock,
    notificationService,
    logger: buildLogger('stripe-webhook')
  });

  const jobHealthStore = new MemoryJobHealthStore();
  const webhookRetryQueue = new MemoryWebhookRetryQueue();

  services = {
    env,
    logger,
    depositService,
    webhookHandler,
    jobHealthStore,
    webhookRetryQueue,
    notificationService
  };

  return services;
}

// Utility functions
function isAuthorized(req, apiToken) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token === apiToken;
}

// Main handler
export default async function handler(req, res) {
  try {
    // Basic environment loading for health check and auth
    const env = loadEnv();

    const pathname = req.url;
    const method = req.method;

    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                     req.headers['x-real-ip'] ||
                     'unknown';

    // Rate limiting
    const rateLimit = checkRateLimit(clientIP, env.RATE_LIMIT_MAX_REQUESTS, env.RATE_LIMIT_WINDOW_MS);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }

    // Health check (public)
    if (pathname === '/healthz') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'stripe-deposit',
        version: '1.0.0'
      });
    }

    // All other routes require authentication
    if (!isAuthorized(req, env.API_AUTH_TOKEN)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Initialize services only after auth check
    const { logger, depositService, webhookHandler, jobHealthStore, webhookRetryQueue, notificationService } = initializeServices();

    // Metrics endpoint
    if (pathname === '/metrics') {
      const jobHealth = await jobHealthStore.getAllJobHealth();
      const webhookStats = await webhookRetryQueue.getStats();
      
      return res.status(200).json({
        timestamp: new Date().toISOString(),
        jobs: jobHealth,
        webhookRetry: webhookStats,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt
        }
      });
    }

    // Deposits API
    if (pathname.startsWith('/api/deposits')) {
      // List deposits
      if (pathname === '/api/deposits') {
        if (method === 'GET') {
          const { status, customerId, limit } = req.query || {};
          const result = await depositService.listDeposits({ 
            status, 
            customerId, 
            limit: limit ? parseInt(limit) : 100 
          });
          return res.status(200).json(result);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Hold endpoints
      const holdMatch = pathname.match(/^\/api\/deposits\/hold\/(\d+)$/);
      if (holdMatch) {
        if (method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const amount = parseInt(holdMatch[1]);
        if (![100, 200].includes(amount)) {
          return res.status(400).json({ error: 'Invalid hold amount. Must be 100 or 200.' });
        }
        
        const body = req.body || {};
        const result = await depositService.initializeDeposit({
          customerId: body.customerId,
          paymentMethodId: body.paymentMethodId,
          holdAmount: amount,
          currency: body.currency || 'usd',
          metadata: body.metadata
        });
        
        return res.status(200).json(result);
      }

      // Individual deposit operations
      const depositMatch = pathname.match(/^\/api\/deposits\/([^\/]+)(?:\/(.+))?$/);
      if (depositMatch) {
        const depositId = depositMatch[1];
        const action = depositMatch[2];

        if (!action) {
          // GET /api/deposits/{id}
          if (method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
          }
          
          const deposit = await depositService.getDeposit({ depositId });
          if (!deposit) {
            return res.status(404).json({ error: 'Deposit not found' });
          }
          
          return res.status(200).json(deposit);
        }

        // POST operations
        if (method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = req.body || {};

        switch (action) {
          case 'capture':
            const captureResult = await depositService.captureDeposit({
              depositId,
              amount: body.amount,
              metadata: body.metadata
            });
            return res.status(200).json(captureResult);

          case 'release':
            const releaseResult = await depositService.releaseDeposit({ depositId });
            return res.status(200).json(releaseResult);

          case 'reauthorize':
            const reauthorizeResult = await depositService.reauthorizeDeposit({
              depositId,
              metadata: body.metadata
            });
            return res.status(200).json(reauthorizeResult);

          case 'resolve':
            const resolveResult = await depositService.resolveDepositRequiresAction({
              depositId,
              metadata: body.metadata
            });
            return res.status(200).json(resolveResult);

          default:
            return res.status(404).json({ error: 'Not found' });
        }
      }
    }

    return res.status(404).json({ error: 'Not found' });

  } catch (error) {
    console.error('Request failed:', error);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
