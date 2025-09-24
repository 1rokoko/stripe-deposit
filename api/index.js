// Vercel serverless function adapter for stripe-deposit
const { loadEnv } = require('../src/config');
const { StripeClient } = require('../src/stripe/stripeClient');
const { verifyStripeSignature } = require('../src/stripe/webhookVerifier');
const { StripeWebhookHandler } = require('../src/stripe/webhookHandler');
const { DepositService } = require('../src/services/depositService');
const { NotificationService } = require('../src/services/notificationService');
const { buildLogger } = require('../src/utils/logger');
const { createDepositRepository } = require('../src/repositories/repositoryFactory');

// Repository will be created using factory pattern

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
  
  // Use repository factory to get the best available repository (SQLite > Memory)
  const repository = createDepositRepository({
    filePath: '/tmp/deposits.db' // Use /tmp for Vercel serverless functions
  });
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
    repository,
    depositService,
    webhookHandler,
    jobHealthStore,
    webhookRetryQueue,
    notificationService
  };

  return services;
}

// Import enhanced auth middleware
const { createAuthMiddleware } = require('../src/auth/authMiddleware');

// Import admin authentication
const {
  verifyAdminCredentials,
  generateAdminToken,
  verifyAdminToken,
  logAdminAction
} = require('../lib/admin-auth');

// Utility functions (keeping for backward compatibility)
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

    // All Admin API endpoints (no main API auth required)
    if (pathname.startsWith('/api/admin')) {
      // Admin login (public - no auth required)
      if (pathname === '/api/admin/login' && method === 'POST') {
        console.log('Admin login attempt:', { pathname, method, headers: req.headers });

        let body;
        try {
          // Parse JSON body manually for admin login
          if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
          } else {
            body = req.body || {};
          }
          console.log('Parsed body:', body);
        } catch (error) {
          console.error('JSON parse error:', error);
          return res.status(400).json({ error: 'Invalid JSON in request body' });
        }

        const { email, password } = body;

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        const adminUser = verifyAdminCredentials(email, password);
        if (!adminUser) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateAdminToken(adminUser);

        // Log admin login
        logAdminAction(adminUser, 'LOGIN', {
          ip: clientIP,
          userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
          token,
          admin: {
            id: adminUser.id,
            email: adminUser.email,
            role: adminUser.role
          }
        });
      }

      // All other admin endpoints require admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      let adminAuth;
      try {
        const token = authHeader.substring(7);
        adminAuth = verifyAdminToken(token);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }

      // Initialize services for admin endpoints
      const { logger, repository, depositService, webhookHandler, jobHealthStore, webhookRetryQueue, notificationService } = initializeServices();

      // Admin mode endpoint
      if (pathname === '/api/admin/mode' && method === 'GET') {
        const currentMode = env.STRIPE_SECRET_KEY?.includes('sk_test') ? 'test' : 'live';
        return res.status(200).json({
          mode: currentMode,
          hasLiveKeys: !!(env.STRIPE_SECRET_KEY_LIVE && env.STRIPE_WEBHOOK_SECRET_LIVE)
        });
      }

      if (pathname === '/api/admin/mode' && method === 'POST') {
        const { mode } = req.body || {};

        if (!mode || !['test', 'live'].includes(mode)) {
          return res.status(400).json({ error: 'Mode must be "test" or "live"' });
        }

        if (mode === 'live' && (!env.STRIPE_SECRET_KEY_LIVE || !env.STRIPE_WEBHOOK_SECRET_LIVE)) {
          return res.status(400).json({ error: 'Live mode keys not configured' });
        }

        // In a real implementation, you'd store this preference in a database
        // For now, we'll just return success - the frontend will handle the mode
        logAdminAction(adminAuth.user, 'MODE_SWITCH', {
          mode,
          ip: clientIP
        });

        return res.status(200).json({
          mode,
          message: `Switched to ${mode} mode`
        });
      }

      // Admin deposits endpoint
      if (pathname === '/api/admin/deposits' && method === 'GET') {
        const { status, customerId, limit } = req.query || {};
        const result = await repository.findAll({
          status,
          customerId,
          limit: limit ? parseInt(limit) : 100
        });

        logAdminAction(adminAuth.user, 'VIEW_DEPOSITS', {
          filters: { status, customerId, limit },
          ip: clientIP
        });

        // Return the result directly - it already has the correct structure { deposits: [...], total: ... }
        return res.status(200).json(result);
      }

      // Admin deposit actions
      const adminDepositMatch = pathname.match(/^\/api\/admin\/deposits\/([^\/]+)\/(.+)$/);
      if (adminDepositMatch && method === 'POST') {
        const depositId = adminDepositMatch[1];
        const action = adminDepositMatch[2];

        const body = req.body || {};
        let result;

        try {
          switch (action) {
            case 'capture':
              result = await depositService.captureDeposit({
                depositId,
                amount: body.amount,
                metadata: body.metadata
              });
              break;

            case 'release':
              result = await depositService.releaseDeposit({ depositId });
              break;

            case 'reauthorize':
              result = await depositService.reauthorizeDeposit({
                depositId,
                metadata: body.metadata
              });
              break;

            default:
              return res.status(404).json({ error: 'Invalid action' });
          }

          logAdminAction(adminAuth.user, `DEPOSIT_${action.toUpperCase()}`, {
            depositId,
            ip: clientIP
          });

          return res.status(200).json(result);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      return res.status(404).json({ error: 'Admin endpoint not found' });
    }

    // All other routes require authentication
    // Create auth middleware instance
    const authMiddleware = createAuthMiddleware({
      apiToken: env.API_AUTH_TOKEN,
      enableLogging: true
    });

    // Check authorization with enhanced middleware
    if (!authMiddleware.requireAuth(req, res)) {
      return; // Response already sent by middleware
    }

    // Initialize services only after auth check
    const { logger, repository, depositService, webhookHandler, jobHealthStore, webhookRetryQueue, notificationService } = initializeServices();

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
          const result = await repository.findAll({
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
