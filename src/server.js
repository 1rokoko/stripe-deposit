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
const { verifyAdminCredentials, generateAdminToken, verifyAdminToken, logAdminAction } = require('../lib/admin-auth');

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

const PUBLIC_ROUTES = new Set(['/healthz', '/api/stripe/webhook', '/api/admin/login']);
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
    // Admin routes have their own authentication
    if (pathname.startsWith('/api/admin/')) {
      await handleAdminRoutes(req, res, pathname);
      return;
    }

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

// Analytics generation functions
async function generateAnalytics(startDate, endDate) {
  const [
    summary,
    depositsOverTime,
    revenueOverTime,
    statusDistribution,
    averageAmountOverTime,
    topCustomers,
    performance
  ] = await Promise.all([
    generateSummary(startDate, endDate),
    generateDepositsOverTime(startDate, endDate),
    generateRevenueOverTime(startDate, endDate),
    generateStatusDistribution(startDate, endDate),
    generateAverageAmountOverTime(startDate, endDate),
    generateTopCustomers(startDate, endDate),
    generatePerformanceMetrics(startDate, endDate)
  ]);

  return {
    summary,
    depositsOverTime,
    revenueOverTime,
    statusDistribution,
    averageAmountOverTime,
    topCustomers,
    performance,
    timestamp: new Date().toISOString()
  };
}

async function generateSummary(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  const totalDeposits = deposits.length;
  const totalAmount = deposits.reduce((sum, d) => sum + d.amount, 0);
  const averageAmount = totalAmount / totalDeposits || 0;
  const successfulDeposits = deposits.filter(d => d.status === 'captured').length;
  const successRate = totalDeposits > 0 ? Math.round((successfulDeposits / totalDeposits) * 100) : 0;

  return {
    totalDeposits,
    totalAmount,
    averageAmount,
    successRate,
    pendingDeposits: deposits.filter(d => d.status === 'pending').length,
    failedDeposits: deposits.filter(d => d.status === 'failed').length,
    capturedDeposits: successfulDeposits
  };
}

async function generateDepositsOverTime(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  // Группировка по дням
  const dailyData = {};
  deposits.forEach(deposit => {
    const date = new Date(deposit.created_at).toISOString().split('T')[0];
    dailyData[date] = (dailyData[date] || 0) + 1;
  });

  const labels = Object.keys(dailyData).sort();
  const data = labels.map(date => dailyData[date]);

  return {
    labels,
    datasets: [{
      label: 'Deposits',
      data,
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1
    }]
  };
}

async function generateRevenueOverTime(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  // Группировка по дням с суммированием
  const dailyRevenue = {};
  deposits.forEach(deposit => {
    if (deposit.status === 'captured') {
      const date = new Date(deposit.created_at).toISOString().split('T')[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + deposit.amount;
    }
  });

  const labels = Object.keys(dailyRevenue).sort();
  const data = labels.map(date => dailyRevenue[date] / 100); // Convert to dollars

  return {
    labels,
    datasets: [{
      label: 'Revenue ($)',
      data,
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };
}

async function generateStatusDistribution(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  const statusCounts = {};
  deposits.forEach(deposit => {
    statusCounts[deposit.status] = (statusCounts[deposit.status] || 0) + 1;
  });

  return {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF'
      ]
    }]
  };
}

async function generateAverageAmountOverTime(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  // Группировка по дням с расчетом среднего
  const dailyAmounts = {};
  deposits.forEach(deposit => {
    const date = new Date(deposit.created_at).toISOString().split('T')[0];
    if (!dailyAmounts[date]) {
      dailyAmounts[date] = { total: 0, count: 0 };
    }
    dailyAmounts[date].total += deposit.amount;
    dailyAmounts[date].count += 1;
  });

  const labels = Object.keys(dailyAmounts).sort();
  const data = labels.map(date => {
    const dayData = dailyAmounts[date];
    return dayData.count > 0 ? (dayData.total / dayData.count) / 100 : 0;
  });

  return {
    labels,
    datasets: [{
      label: 'Average Amount ($)',
      data,
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.1
    }]
  };
}

async function generateTopCustomers(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  const customerStats = {};
  deposits.forEach(deposit => {
    const customerId = deposit.customer_id || 'unknown';
    if (!customerStats[customerId]) {
      customerStats[customerId] = {
        id: customerId,
        name: deposit.customer?.name || `Customer ${customerId.substring(0, 8)}`,
        email: deposit.customer?.email || 'N/A',
        depositCount: 0,
        totalAmount: 0,
        successfulDeposits: 0
      };
    }

    customerStats[customerId].depositCount++;
    customerStats[customerId].totalAmount += deposit.amount;
    if (deposit.status === 'captured') {
      customerStats[customerId].successfulDeposits++;
    }
  });

  // Добавление success rate и сортировка
  const topCustomers = Object.values(customerStats)
    .map(customer => ({
      ...customer,
      successRate: customer.depositCount > 0 ?
        Math.round((customer.successfulDeposits / customer.depositCount) * 100) : 0
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  return topCustomers;
}

async function generatePerformanceMetrics(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  // Success rate
  const successfulDeposits = deposits.filter(d => d.status === 'captured').length;
  const successRate = deposits.length > 0 ?
    Math.round((successfulDeposits / deposits.length) * 100) : 0;

  // Error rate
  const failedDeposits = deposits.filter(d => d.status === 'failed').length;
  const errorRate = deposits.length > 0 ?
    Math.round((failedDeposits / deposits.length) * 100) : 0;

  // Peak hour analysis
  const hourCounts = {};
  deposits.forEach(deposit => {
    const hour = new Date(deposit.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 0;

  // Average processing time (mock data for now)
  const avgProcessingTime = Math.round(Math.random() * 5000 + 1000);

  return {
    avgProcessingTime,
    successRate,
    errorRate,
    peakHour: parseInt(peakHour)
  };
}

async function getDepositsByDateRange(startDate, endDate) {
  const allDeposits = await depositService.listDeposits();

  if (!startDate || !endDate) {
    return allDeposits;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return allDeposits.filter(deposit => {
    const depositDate = new Date(deposit.created_at);
    return depositDate >= start && depositDate <= end;
  });
}

// Report generation functions
async function generateDepositsReport(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  return deposits.map(deposit => ({
    id: deposit.id,
    amount: deposit.amount / 100,
    status: deposit.status,
    customer_name: deposit.customer?.name || 'N/A',
    customer_email: deposit.customer?.email || 'N/A',
    customer_id: deposit.customer_id || 'N/A',
    created_at: deposit.created_at,
    captured_at: deposit.captured_at || 'N/A',
    released_at: deposit.released_at || 'N/A',
    payment_intent_id: deposit.payment_intent_id || 'N/A',
    currency: deposit.currency || 'usd'
  }));
}

async function generateCustomersReport(startDate, endDate) {
  const deposits = await getDepositsByDateRange(startDate, endDate);

  const customerStats = {};
  deposits.forEach(deposit => {
    const customerId = deposit.customer_id || 'unknown';
    if (!customerStats[customerId]) {
      customerStats[customerId] = {
        customer_id: customerId,
        customer_name: deposit.customer?.name || 'N/A',
        customer_email: deposit.customer?.email || 'N/A',
        total_deposits: 0,
        total_amount: 0,
        successful_deposits: 0,
        failed_deposits: 0,
        pending_deposits: 0,
        first_deposit: deposit.created_at,
        last_deposit: deposit.created_at
      };
    }

    const stats = customerStats[customerId];
    stats.total_deposits++;
    stats.total_amount += deposit.amount / 100;

    if (deposit.status === 'captured') {
      stats.successful_deposits++;
    } else if (deposit.status === 'failed') {
      stats.failed_deposits++;
    } else if (deposit.status === 'pending') {
      stats.pending_deposits++;
    }

    if (new Date(deposit.created_at) < new Date(stats.first_deposit)) {
      stats.first_deposit = deposit.created_at;
    }
    if (new Date(deposit.created_at) > new Date(stats.last_deposit)) {
      stats.last_deposit = deposit.created_at;
    }
  });

  return Object.values(customerStats).map(customer => ({
    ...customer,
    success_rate: customer.total_deposits > 0 ?
      Math.round((customer.successful_deposits / customer.total_deposits) * 100) : 0,
    average_deposit: customer.total_deposits > 0 ?
      (customer.total_amount / customer.total_deposits).toFixed(2) : 0
  }));
}

function generateCSV(data) {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

// Admin routes handler
async function handleAdminRoutes(req, res, pathname) {
  try {
    // Admin login
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { email, password } = body;

      if (!email || !password) {
        sendJson(res, 400, {
          error: 'Email and password are required',
          code: 'MISSING_CREDENTIALS'
        });
        return;
      }

      const adminUser = verifyAdminCredentials(email, password);

      if (!adminUser) {
        logger.warn('Failed admin login attempt', {
          email,
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        });

        sendJson(res, 401, {
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
        return;
      }

      const token = generateAdminToken(adminUser);

      logAdminAction(adminUser, 'LOGIN', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      sendJson(res, 200, {
        success: true,
        message: 'Login successful',
        token,
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role
        }
      });
      return;
    }

    // Check admin authentication for other routes
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, {
        error: 'No admin token provided',
        code: 'ADMIN_AUTH_REQUIRED'
      });
      return;
    }

    const token = authHeader.substring(7);
    let adminAuth;
    try {
      adminAuth = verifyAdminToken(token);
    } catch (error) {
      sendJson(res, 401, {
        error: 'Invalid admin token',
        code: 'ADMIN_AUTH_INVALID'
      });
      return;
    }

    // Admin logout
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      logAdminAction(adminAuth.user, 'LOGOUT', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      sendJson(res, 200, {
        success: true,
        message: 'Logout successful'
      });
      return;
    }

    // Admin dashboard
    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      logAdminAction(adminAuth.user, 'VIEW_DASHBOARD', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const deposits = await depositService.listDeposits();

      // Calculate metrics
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const totalDeposits = deposits.length;
      const totalAmount = deposits.reduce((sum, d) => sum + d.amount, 0);
      const pendingDeposits = deposits.filter(d => d.status === 'pending').length;
      const capturedDeposits = deposits.filter(d => d.status === 'captured').length;
      const failedDeposits = deposits.filter(d => d.status === 'failed').length;

      const completedDeposits = capturedDeposits + failedDeposits;
      const successRate = completedDeposits > 0 ?
        Math.round((capturedDeposits / completedDeposits) * 100) : 0;

      const recentDeposits = deposits
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      const metrics = {
        totalDeposits,
        totalAmount,
        pendingDeposits,
        successRate,
        depositsChange: '+5.2%',
        amountChange: '+12.1%',
        pendingChange: '-2.3%',
        successRateChange: '+1.1%',
        recentDeposits,
        lastUpdated: new Date().toISOString()
      };

      sendJson(res, 200, metrics);
      return;
    }

    // Admin deposits list
    if (pathname === '/api/admin/deposits' && req.method === 'GET') {
      logAdminAction(adminAuth.user, 'VIEW_DEPOSITS', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const deposits = await depositService.listDeposits();

      sendJson(res, 200, {
        success: true,
        deposits: deposits.map(deposit => ({
          ...deposit,
          formattedAmount: (deposit.amount / 100).toFixed(2),
          customer: deposit.customer || {
            name: deposit.customer_id ? `Customer ${deposit.customer_id.substring(0, 8)}` : 'Unknown'
          }
        })),
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: deposits.length,
          itemsPerPage: deposits.length
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Admin analytics
    if (pathname === '/api/admin/analytics' && req.method === 'POST') {
      logAdminAction(adminAuth.user, 'VIEW_ANALYTICS', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const body = await parseJsonBody(req);
      const { startDate, endDate } = body;

      const analytics = await generateAnalytics(startDate, endDate);

      sendJson(res, 200, analytics);
      return;
    }

    // Admin bulk operations
    if (pathname === '/api/admin/deposits/bulk' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      sendJson(res, 400, {
        error: 'Bulk operations not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
      return;
    }

    // Admin export
    if (pathname === '/api/admin/deposits/export' && req.method === 'POST') {
      logAdminAction(adminAuth.user, 'EXPORT_DEPOSITS', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const body = await parseJsonBody(req);
      const { format = 'json', filters = {} } = body;

      const deposits = await depositService.listDeposits();

      if (format === 'csv') {
        const csvData = generateCSV(deposits);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="deposits-export.csv"');
        res.end(csvData);
      } else if (format === 'json') {
        sendJson(res, 200, {
          success: true,
          data: deposits,
          exportedAt: new Date().toISOString(),
          totalRecords: deposits.length
        });
      } else {
        sendJson(res, 400, {
          error: 'Unsupported format. Use csv or json',
          code: 'INVALID_FORMAT'
        });
      }
      return;
    }

    // Admin reports generation
    if (pathname === '/api/admin/reports/generate' && req.method === 'POST') {
      logAdminAction(adminAuth.user, 'GENERATE_REPORT', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const body = await parseJsonBody(req);
      const { reportType, startDate, endDate, format = 'json' } = body;

      let reportData;
      switch (reportType) {
        case 'deposits':
          reportData = await generateDepositsReport(startDate, endDate);
          break;
        case 'customers':
          reportData = await generateCustomersReport(startDate, endDate);
          break;
        case 'analytics':
          reportData = await generateAnalytics(startDate, endDate);
          break;
        default:
          sendJson(res, 400, { error: 'Invalid report type' });
          return;
      }

      if (format === 'csv') {
        const csvData = generateCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.csv"`);
        res.end(csvData);
      } else {
        sendJson(res, 200, {
          success: true,
          reportType,
          data: reportData,
          generatedAt: new Date().toISOString(),
          dateRange: { startDate, endDate }
        });
      }
      return;
    }

    // Admin deposit actions
    const depositActionMatch = pathname.match(/^\/api\/admin\/deposits\/([^\/]+)\/([^\/]+)$/);
    if (depositActionMatch && req.method === 'POST') {
      const [, depositId, action] = depositActionMatch;
      sendJson(res, 400, {
        error: 'Deposit actions not implemented yet',
        code: 'NOT_IMPLEMENTED',
        depositId,
        action
      });
      return;
    }

    sendJson(res, 404, { error: 'Admin endpoint not found' });

  } catch (error) {
    logger.error('Admin route error', {
      error: error.message,
      path: pathname
    });
    sendJson(res, 500, {
      error: 'Internal server error',
      code: 'ADMIN_ERROR'
    });
  }
}

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
