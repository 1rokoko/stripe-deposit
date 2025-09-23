const http = require('http');
const { loadEnv } = require('./config');
const { StripeClient } = require('./stripe/stripeClient');
const { verifyStripeSignature } = require('./stripe/webhookVerifier');
const { StripeWebhookHandler } = require('./stripe/webhookHandler');
const { WebhookRetryQueue } = require('./stripe/webhookRetryQueue');
const { DepositService } = require('./services/depositService');
const { NotificationService } = require('./services/notificationService');
const { buildLogger } = require('./utils/logger');
const { JobHealthStore } = require('./utils/jobHealthStore');
const { createDepositRepository } = require('./repositories/repositoryFactory');

const env = loadEnv();

if (!env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY must be set before starting the server');
  process.exit(1);
}

if (!env.API_AUTH_TOKEN) {
  console.error('API_AUTH_TOKEN must be set before starting the server');
  process.exit(1);
}

const logger = buildLogger('server');
const stripeClient = new StripeClient({ apiKey: env.STRIPE_SECRET_KEY });
const repository = createDepositRepository({ filePath: env.DATABASE_FILE });
const notificationService = new NotificationService({
  filePath: env.NOTIFICATIONS_FILE,
  logger: buildLogger('notification-service'),
  maxSizeBytes: env.NOTIFICATIONS_MAX_BYTES,
  maxBackups: env.NOTIFICATIONS_MAX_BACKUPS,
  externalWebhookUrl: env.ALERT_WEBHOOK_URL,
  fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  externalTimeoutMs: env.ALERT_WEBHOOK_TIMEOUT_MS,
});
const jobHealthStore = new JobHealthStore({
  filePath: env.JOB_HEALTH_FILE,
  logger: buildLogger('job-health'),
});
const webhookRetryQueue = new WebhookRetryQueue({
  filePath: env.WEBHOOK_RETRY_QUEUE_FILE,
  deadLetterPath: env.WEBHOOK_RETRY_DEAD_LETTER_FILE,
  logger: buildLogger('webhook-retry-queue'),
});
const clock = { now: () => new Date() };
const depositService = new DepositService({
  stripeClient,
  repository,
  clock,
  logger: buildLogger('deposit-service'),
  notifier: notificationService,
});

const webhookHandler = new StripeWebhookHandler({
  repository,
  clock,
  logger: buildLogger('stripe-webhook'),
  notifier: notificationService,
});

const PUBLIC_ROUTES = new Set(['/healthz', '/api/stripe/webhook']);
const RATE_LIMIT_LIMIT = Math.max(1, Number.isFinite(env.RATE_LIMIT_MAX_REQUESTS) ? env.RATE_LIMIT_MAX_REQUESTS : 120);
const RATE_LIMIT_WINDOW = Math.max(1_000, Number.isFinite(env.RATE_LIMIT_WINDOW_MS) ? env.RATE_LIMIT_WINDOW_MS : 60_000);
const REQUEST_TIMEOUT = Math.max(1_000, Number.isFinite(env.REQUEST_TIMEOUT_MS) ? env.REQUEST_TIMEOUT_MS : 15_000);
const LOG_HTTP_REQUESTS = Boolean(env.LOG_HTTP_REQUESTS);
const metrics = {
  startedAt: Date.now(),
  requestsTotal: 0,
  requestsByStatus: Object.create(null),
  rateLimitHits: 0,
};

function createRateLimiter({ windowMs, maxRequests }) {
  const buckets = new Map();

  function cleanup(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    check(key) {
      const now = Date.now();
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        cleanup(now);
        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - 1),
          resetAt,
        };
      }

      if (bucket.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
          resetAt: bucket.resetAt,
        };
      }

      bucket.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - bucket.count),
        resetAt: bucket.resetAt,
      };
    },
  };
}

const rateLimiter = createRateLimiter({ windowMs: RATE_LIMIT_WINDOW, maxRequests: RATE_LIMIT_LIMIT });

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: 'Method not allowed' });
}

function unauthorized(res) {
  sendJson(res, 401, { error: 'Unauthorized' });
}

function isAuthorized(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token === env.API_AUTH_TOKEN;
}

async function collectRawBody(req) {
  if (req.rawBodyBuffer) {
    return req.rawBodyBuffer;
  }

  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    req
      .on('data', (chunk) => {
        chunks.push(chunk);
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks));
      })
      .on('error', (error) => {
        reject(error);
      });
  });

  req.rawBodyBuffer = buffer;
  return buffer;
}

async function parseJsonBody(req) {
  const buffer = await collectRawBody(req);
  if (!buffer.length) {
    return {};
  }

  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const remoteAddress = req.socket.remoteAddress || 'unknown';
  const method = req.method;
  const startedAt = Date.now();

  let rateLimitContext;

  res.once('finish', () => {
    const durationMs = Date.now() - startedAt;
    const status = res.statusCode || 0;

    metrics.requestsTotal += 1;
    metrics.requestsByStatus[status] = (metrics.requestsByStatus[status] || 0) + 1;

    if (LOG_HTTP_REQUESTS) {
      logger.info('HTTP request handled', {
        method,
        path: pathname,
        status,
        durationMs,
        remoteAddress,
        userAgent: req.headers['user-agent'],
        rateLimitRemaining: rateLimitContext?.remaining,
      });
    }
  });

  if (LOG_HTTP_REQUESTS) {
    res.once('close', () => {
      if (!res.writableEnded) {
        const durationMs = Date.now() - startedAt;
        logger.warn('HTTP request aborted', {
          method,
          path: pathname,
          remoteAddress,
          durationMs,
        });
      }
    });
  }

  req.setTimeout(REQUEST_TIMEOUT, () => {
    logger.warn('Request timed out', {
      method,
      path: pathname,
      remoteAddress,
      timeoutMs: REQUEST_TIMEOUT,
    });
    if (!res.headersSent) {
      res.setHeader('Connection', 'close');
      sendJson(res, 503, { error: 'Request timeout' });
    }
    req.destroy();
  });

  rateLimitContext = rateLimiter.check(remoteAddress);
  if (!rateLimitContext.allowed) {
    metrics.rateLimitHits += 1;
    res.setHeader('Retry-After', String(rateLimitContext.retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_LIMIT));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimitContext.resetAt / 1000)));
    sendJson(res, 429, { error: 'Too many requests' });
    return;
  }

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rateLimitContext.remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimitContext.resetAt / 1000)));

  try {
    if (!PUBLIC_ROUTES.has(pathname) && !isAuthorized(req)) {
      unauthorized(res);
      return;
    }

    if (pathname === '/healthz' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (pathname === '/metrics' && req.method === 'GET') {
      const jobHealth = await jobHealthStore.readAll();
      const webhookRetryPending = await webhookRetryQueue.count();
      sendJson(res, 200, {
        uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000),
        rateLimit: {
          limit: RATE_LIMIT_LIMIT,
          windowMs: RATE_LIMIT_WINDOW,
          hits: metrics.rateLimitHits,
        },
        requests: {
          total: metrics.requestsTotal,
          byStatus: metrics.requestsByStatus,
        },
        jobs: jobHealth,
        webhookRetry: {
          pending: webhookRetryPending,
        },
      });
      return;
    }

    if (pathname === '/api/stripe/webhook') {
      if (req.method !== 'POST') {
        methodNotAllowed(res);
        return;
      }

      if (!env.STRIPE_WEBHOOK_SECRET) {
        logger.error('Received Stripe webhook but STRIPE_WEBHOOK_SECRET is not configured');
        sendJson(res, 500, { error: 'Stripe webhook secret is not configured' });
        return;
      }

      const rawBody = await collectRawBody(req);
      const signatureHeader = req.headers['stripe-signature'];

      let event;

      try {
        event = verifyStripeSignature({
          payload: rawBody,
          header: signatureHeader,
          secret: env.STRIPE_WEBHOOK_SECRET,
        });

        await webhookHandler.handleEvent(event);
        sendJson(res, 200, { received: true });
      } catch (error) {
        const status = /signature|timestamp|parse/i.test(error.message) ? 400 : 500;
        logger.error('Stripe webhook handling failed', {
          error: error.message,
        });
        if (event && status >= 500) {
          try {
            await webhookRetryQueue.enqueue(event, { receivedAt: new Date().toISOString() });
          } catch (queueError) {
            logger.error('Failed to enqueue webhook for retry', {
              error: queueError.message,
              originalError: error.message,
            });
          }
        }
        sendJson(res, status, { error: error.message });
      }
      return;
    }

    if (pathname === '/api/deposits' && req.method === 'GET') {
      const deposits = await depositService.listDeposits();
      sendJson(res, 200, { deposits });
      return;
    }

    const holdMatch = pathname.match(/^\/api\/deposits\/hold\/(\d+)$/);
    if (holdMatch) {
      if (req.method !== 'POST') {
        methodNotAllowed(res);
        return;
      }

      const holdAmountDollars = Number(holdMatch[1]);
      if (!Number.isFinite(holdAmountDollars) || holdAmountDollars <= 0) {
        sendJson(res, 400, { error: 'Invalid hold amount' });
        return;
      }

      const body = await parseJsonBody(req);
      const { customerId, paymentMethodId, currency = 'usd', metadata } = body;
      const holdAmount = toCents(holdAmountDollars);
      const result = await depositService.initializeDeposit({
        customerId,
        paymentMethodId,
        holdAmount,
        currency,
        metadata,
      });

      sendJson(res, 201, result);
      return;
    }

    const captureMatch = pathname.match(/^\/api\/deposits\/([a-zA-Z0-9\-]+)/);
    if (captureMatch) {
      const depositId = captureMatch[1];

      if (pathname.endsWith(`/api/deposits/${depositId}`) && req.method === 'GET') {
        const deposit = await depositService.getDeposit(depositId);
        sendJson(res, 200, { deposit });
        return;
      }

      if (pathname.endsWith(`/api/deposits/${depositId}/capture`)) {
        if (req.method !== 'POST') {
          methodNotAllowed(res);
          return;
        }

        const body = await parseJsonBody(req);
        const amount = body.amount !== undefined ? Number(body.amount) : undefined;
        const amountInCents = amount !== undefined ? toCents(amount) : undefined;
        const result = await depositService.captureDeposit({
          depositId,
          amountToCapture: amountInCents,
        });

        sendJson(res, 200, result);
        return;
      }

      if (pathname.endsWith(`/api/deposits/${depositId}/release`)) {
        if (req.method !== 'POST') {
          methodNotAllowed(res);
          return;
        }

        const result = await depositService.releaseDeposit({ depositId });
        sendJson(res, 200, result);
        return;
      }

      if (pathname.endsWith(`/api/deposits/${depositId}/reauthorize`)) {
        if (req.method !== 'POST') {
          methodNotAllowed(res);
          return;
        }

        const body = await parseJsonBody(req);
        const result = await depositService.reauthorizeDeposit({ depositId, metadata: body.metadata });
        sendJson(res, 200, result);
        return;
      }

      if (pathname.endsWith(`/api/deposits/${depositId}/resolve`)) {
        if (req.method !== 'POST') {
          methodNotAllowed(res);
          return;
        }

        const body = await parseJsonBody(req);
        const result = await depositService.resolveDepositRequiresAction({
          depositId,
          metadata: body.metadata,
        });
        sendJson(res, 200, result);
        return;
      }
    }

    notFound(res);
  } catch (error) {
    logger.error('Request failed', {
      error: error.message,
      path: pathname,
    });
    const status = error.statusCode || error.status || 400;
    sendJson(res, status, { error: error.message });
  }
});

const port = env.PORT || 3000;
server.listen(port, () => {
  logger.info('Server started', { port });
});

function handleShutdown(signal) {
  logger.info('Received shutdown signal', { signal });
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
