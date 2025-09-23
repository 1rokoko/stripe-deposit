/**
 * Enhanced Health Check API Endpoint
 * Provides comprehensive system health information
 */

const { createMonitoringService } = require('../src/monitoring/monitoringService');
const { loadEnv } = require('../src/config');
const { createStripeClient } = require('../src/stripe/stripeClient');
const { createRepositoryFactory } = require('../src/repositories/repositoryFactory');

// Initialize monitoring service
let monitoringService = null;

function initializeMonitoring() {
  if (monitoringService) {
    return monitoringService;
  }
  
  try {
    const env = loadEnv();
    const stripeClient = createStripeClient(env);
    const repositoryFactory = createRepositoryFactory(env);
    const repository = repositoryFactory.createDepositRepository();
    
    monitoringService = createMonitoringService({
      service: 'stripe-deposit',
      environment: process.env.NODE_ENV || 'development',
      repository,
      stripeClient,
      enablePeriodicHealthChecks: false, // Disable for serverless
      enableAlerts: process.env.NODE_ENV === 'production',
      notifications: {
        enableSlack: !!process.env.SLACK_WEBHOOK_URL,
        webhookUrl: process.env.SLACK_WEBHOOK_URL
      }
    });
    
    return monitoringService;
  } catch (error) {
    console.error('Failed to initialize monitoring service:', error);
    return null;
  }
}

/**
 * Basic health check (public endpoint)
 */
async function basicHealthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'stripe-deposit',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
}

/**
 * Detailed health check (requires authentication)
 */
async function detailedHealthCheck() {
  const monitoring = initializeMonitoring();
  
  if (!monitoring) {
    return {
      status: 'error',
      message: 'Monitoring service not available',
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    const status = await monitoring.getStatus();
    
    return {
      ...status,
      version: '1.0.0',
      checks: {
        database: await checkDatabase(),
        stripe: await checkStripe(),
        memory: await checkMemory(),
        environment: await checkEnvironment()
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Database connectivity check
 */
async function checkDatabase() {
  try {
    const env = loadEnv();
    const repositoryFactory = createRepositoryFactory(env);
    const repository = repositoryFactory.createDepositRepository();
    
    const startTime = Date.now();
    await repository.count();
    const duration = Date.now() - startTime;
    
    return {
      status: 'healthy',
      message: `Database responsive in ${duration}ms`,
      duration,
      type: env.DATABASE_TYPE || 'sqlite'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database error: ${error.message}`,
      error: error.name
    };
  }
}

/**
 * Stripe API connectivity check
 */
async function checkStripe() {
  try {
    const env = loadEnv();
    const stripeClient = createStripeClient(env);
    
    const startTime = Date.now();
    const account = await stripeClient.accounts.retrieve();
    const duration = Date.now() - startTime;
    
    return {
      status: 'healthy',
      message: `Stripe API responsive in ${duration}ms`,
      duration,
      account: {
        id: account.id,
        country: account.country,
        defaultCurrency: account.default_currency
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Stripe API error: ${error.message}`,
      error: error.type || error.name
    };
  }
}

/**
 * Memory usage check
 */
async function checkMemory() {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  let status = 'healthy';
  let message = `Memory usage normal: ${heapUsedPercent.toFixed(1)}%`;
  
  if (heapUsedPercent > 90) {
    status = 'unhealthy';
    message = `High memory usage: ${heapUsedPercent.toFixed(1)}%`;
  } else if (heapUsedPercent > 75) {
    status = 'degraded';
    message = `Elevated memory usage: ${heapUsedPercent.toFixed(1)}%`;
  }
  
  return {
    status,
    message,
    details: {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      heapUsedPercent: Math.round(heapUsedPercent * 100) / 100,
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
    }
  };
}

/**
 * Environment configuration check
 */
async function checkEnvironment() {
  const env = loadEnv();
  const requiredVars = ['STRIPE_SECRET_KEY', 'API_AUTH_TOKEN'];
  const missing = [];
  const present = [];
  
  for (const varName of requiredVars) {
    if (env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }
  
  const status = missing.length === 0 ? 'healthy' : 'unhealthy';
  const message = missing.length === 0 
    ? 'All required environment variables present'
    : `Missing required environment variables: ${missing.join(', ')}`;
  
  return {
    status,
    message,
    details: {
      present: present.length,
      missing: missing.length,
      missingVars: missing,
      nodeEnv: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version
    }
  };
}

/**
 * Check if request is authorized
 */
function isAuthorized(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.slice('Bearer '.length).trim();
  const env = loadEnv();
  
  return token === env.API_AUTH_TOKEN;
}

/**
 * Main handler function
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const detailed = url.searchParams.get('detailed') === 'true';
    
    // Basic health check (public)
    if (!detailed) {
      const health = await basicHealthCheck();
      return res.status(200).json(health);
    }
    
    // Detailed health check (requires authentication)
    if (!isAuthorized(req)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token required for detailed health check'
      });
    }
    
    const health = await detailedHealthCheck();
    
    // Set appropriate status code based on health
    let statusCode = 200;
    if (health.health?.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (health.health?.status === 'degraded') {
      statusCode = 200; // OK but with warnings
    }
    
    return res.status(statusCode).json(health);
    
  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
module.exports = {
  handler,
  basicHealthCheck,
  detailedHealthCheck,
  checkDatabase,
  checkStripe,
  checkMemory,
  checkEnvironment
};
