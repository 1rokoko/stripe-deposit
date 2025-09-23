/**
 * Comprehensive Monitoring Dashboard API
 * Provides detailed monitoring data and metrics
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
 * Get system overview
 */
async function getSystemOverview() {
  const monitoring = initializeMonitoring();
  if (!monitoring) {
    throw new Error('Monitoring service not available');
  }
  
  const dashboardData = await monitoring.getDashboardData();
  
  return {
    service: 'stripe-deposit',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    overview: {
      status: dashboardData.health.status,
      uptime: Math.round(dashboardData.uptime / 1000), // seconds
      healthScore: dashboardData.dashboard.healthScore,
      performanceScore: dashboardData.dashboard.performanceScore,
      errorRate: dashboardData.dashboard.errorRate,
      activeAlerts: dashboardData.dashboard.alerts.length
    },
    quickStats: {
      memoryUsage: `${dashboardData.memory.heapUsedPercent}%`,
      totalErrors: dashboardData.errors.total,
      criticalErrors: dashboardData.errors.bySeverity.critical || 0,
      healthyChecks: dashboardData.health.summary.healthy,
      totalChecks: dashboardData.health.summary.total
    }
  };
}

/**
 * Get detailed health information
 */
async function getDetailedHealth() {
  const monitoring = initializeMonitoring();
  if (!monitoring) {
    throw new Error('Monitoring service not available');
  }
  
  const status = await monitoring.getStatus();
  
  return {
    timestamp: status.timestamp,
    uptime: status.uptime,
    health: status.health,
    checks: status.health.checks.map(check => ({
      name: check.name,
      status: check.status,
      message: check.message,
      duration: check.duration,
      critical: check.critical,
      timestamp: check.timestamp
    }))
  };
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics() {
  const monitoring = initializeMonitoring();
  if (!monitoring) {
    throw new Error('Monitoring service not available');
  }
  
  const status = await monitoring.getStatus();
  
  return {
    timestamp: status.timestamp,
    performance: status.performance,
    memory: status.memory,
    metrics: Object.entries(status.performance.metrics || {}).map(([operation, metric]) => ({
      operation,
      count: metric.count,
      avgDuration: metric.avgDuration,
      p95Duration: metric.p95Duration,
      successRate: metric.successRate,
      lastUpdated: metric.lastUpdated
    }))
  };
}

/**
 * Get error statistics
 */
async function getErrorStatistics() {
  const monitoring = initializeMonitoring();
  if (!monitoring) {
    throw new Error('Monitoring service not available');
  }
  
  const status = await monitoring.getStatus();
  
  return {
    timestamp: status.timestamp,
    errors: status.errors,
    breakdown: {
      bySeverity: status.errors.bySeverity,
      byCategory: status.errors.byCategory,
      trends: {
        lastHour: status.errors.lastHour,
        lastDay: status.errors.lastDay,
        total: status.errors.total
      }
    }
  };
}

/**
 * Get alerts and notifications
 */
async function getAlerts() {
  const monitoring = initializeMonitoring();
  if (!monitoring) {
    throw new Error('Monitoring service not available');
  }
  
  const dashboardData = await monitoring.getDashboardData();
  
  return {
    timestamp: new Date().toISOString(),
    activeAlerts: dashboardData.dashboard.alerts,
    alertSummary: {
      total: dashboardData.dashboard.alerts.length,
      critical: dashboardData.dashboard.alerts.filter(a => a.severity === 'critical').length,
      warning: dashboardData.dashboard.alerts.filter(a => a.severity === 'warning').length
    }
  };
}

/**
 * Get system configuration
 */
async function getSystemConfiguration() {
  const env = loadEnv();
  
  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: process.platform,
    nodeVersion: process.version,
    configuration: {
      databaseType: env.DATABASE_TYPE || 'sqlite',
      stripeMode: env.STRIPE_SECRET_KEY?.includes('sk_test') ? 'test' : 'live',
      authEnabled: !!env.API_AUTH_TOKEN,
      webhookConfigured: !!env.STRIPE_WEBHOOK_SECRET,
      logLevel: process.env.LOG_LEVEL || 'info'
    },
    features: {
      monitoring: true,
      healthChecks: true,
      errorTracking: true,
      performanceMonitoring: true,
      structuredLogging: true
    }
  };
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
  
  // Require authentication
  if (!isAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token required for monitoring data'
    });
  }
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = url.searchParams.get('endpoint') || 'overview';
    
    let data;
    
    switch (endpoint) {
      case 'overview':
        data = await getSystemOverview();
        break;
        
      case 'health':
        data = await getDetailedHealth();
        break;
        
      case 'performance':
        data = await getPerformanceMetrics();
        break;
        
      case 'errors':
        data = await getErrorStatistics();
        break;
        
      case 'alerts':
        data = await getAlerts();
        break;
        
      case 'config':
        data = await getSystemConfiguration();
        break;
        
      case 'dashboard':
        // Full dashboard data
        const monitoring = initializeMonitoring();
        if (!monitoring) {
          throw new Error('Monitoring service not available');
        }
        data = await monitoring.getDashboardData();
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid endpoint',
          message: `Unknown endpoint: ${endpoint}`,
          availableEndpoints: ['overview', 'health', 'performance', 'errors', 'alerts', 'config', 'dashboard']
        });
    }
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Monitoring API error:', error);
    
    return res.status(500).json({
      error: 'Monitoring error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
module.exports = {
  handler,
  getSystemOverview,
  getDetailedHealth,
  getPerformanceMetrics,
  getErrorStatistics,
  getAlerts,
  getSystemConfiguration
};
