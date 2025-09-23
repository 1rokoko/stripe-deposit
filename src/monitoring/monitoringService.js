/**
 * Comprehensive Monitoring Service
 * Integrates all monitoring components into a unified service
 */

const { createLogger } = require('./structuredLogger');
const { performanceMetrics, createPerformanceMiddleware } = require('./performanceMonitor');
const { ErrorTracker, createErrorTrackingMiddleware } = require('./errorTracker');
const { createDefaultHealthCheckManager } = require('./healthCheck');

/**
 * Notification service interface
 */
class NotificationService {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl;
    this.enableSlack = options.enableSlack && !!options.webhookUrl;
    this.enableEmail = options.enableEmail && !!options.emailConfig;
    this.emailConfig = options.emailConfig;
    this.logger = options.logger;
  }
  
  async sendAlert(alertType, message, data = {}) {
    const alert = {
      type: alertType,
      message,
      data,
      timestamp: new Date().toISOString(),
      service: 'stripe-deposit',
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Send to Slack if configured
    if (this.enableSlack) {
      await this.sendSlackAlert(alert);
    }
    
    // Send email if configured
    if (this.enableEmail) {
      await this.sendEmailAlert(alert);
    }
    
    // Log the alert
    if (this.logger) {
      this.logger.warn('Alert sent', alert);
    }
  }
  
  async sendSlackAlert(alert) {
    try {
      const payload = {
        text: `🚨 ${alert.message}`,
        attachments: [{
          color: this.getAlertColor(alert.type),
          fields: [
            { title: 'Service', value: alert.service, short: true },
            { title: 'Environment', value: alert.environment, short: true },
            { title: 'Time', value: alert.timestamp, short: true },
            { title: 'Type', value: alert.type, short: true }
          ],
          footer: 'Stripe Deposit Monitoring',
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      
      // In a real implementation, you would send this to Slack
      // await fetch(this.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });
      
      console.log('Slack alert would be sent:', payload);
      
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to send Slack alert', { error: error.message });
      }
    }
  }
  
  async sendEmailAlert(alert) {
    try {
      // Email implementation would go here
      console.log('Email alert would be sent:', alert);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to send email alert', { error: error.message });
      }
    }
  }
  
  getAlertColor(alertType) {
    const colorMap = {
      critical_errors_threshold: 'danger',
      total_errors_threshold: 'warning',
      repeated_error: 'warning',
      health_check_failed: 'danger',
      performance_degraded: 'warning'
    };
    
    return colorMap[alertType] || 'warning';
  }
}

/**
 * Main monitoring service
 */
class MonitoringService {
  constructor(options = {}) {
    this.logger = createLogger({
      service: options.service || 'stripe-deposit',
      environment: options.environment || process.env.NODE_ENV || 'development',
      logLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
      enableExternal: options.enableExternalLogging
    });
    
    this.notificationService = new NotificationService({
      ...options.notifications,
      logger: this.logger
    });
    
    this.errorTracker = new ErrorTracker({
      logger: this.logger,
      notificationService: this.notificationService,
      enableAlerts: options.enableAlerts !== false
    });
    
    this.healthCheckManager = createDefaultHealthCheckManager({
      logger: this.logger,
      repository: options.repository,
      stripeClient: options.stripeClient,
      enablePeriodicChecks: options.enablePeriodicHealthChecks !== false
    });
    
    this.startTime = Date.now();
    this.isInitialized = false;
  }
  
  /**
   * Initialize monitoring service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Start periodic health checks
      this.healthCheckManager.startPeriodicChecks();
      
      // Log initialization
      await this.logger.info('Monitoring service initialized', {
        startTime: new Date(this.startTime).toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
      
      this.isInitialized = true;
      
    } catch (error) {
      await this.logger.error('Failed to initialize monitoring service', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Shutdown monitoring service
   */
  async shutdown() {
    try {
      // Stop periodic health checks
      this.healthCheckManager.stopPeriodicChecks();
      
      await this.logger.info('Monitoring service shutdown', {
        uptime: Date.now() - this.startTime
      });
      
      this.isInitialized = false;
      
    } catch (error) {
      console.error('Error during monitoring service shutdown:', error);
    }
  }
  
  /**
   * Get Express middleware for monitoring
   */
  getMiddleware() {
    return {
      performance: createPerformanceMiddleware({ logger: this.logger }),
      errorTracking: createErrorTrackingMiddleware({ 
        logger: this.logger,
        notificationService: this.notificationService
      })
    };
  }
  
  /**
   * Track a custom event
   */
  async trackEvent(event, data = {}) {
    await this.logger.info(`Event: ${event}`, data);
  }
  
  /**
   * Track an error
   */
  async trackError(error, context = {}) {
    return await this.errorTracker.track(error, context);
  }
  
  /**
   * Get comprehensive monitoring status
   */
  async getStatus() {
    const [healthStatus, performanceHealth, errorStats] = await Promise.all([
      this.healthCheckManager.checkAll(),
      this.getPerformanceHealth(),
      this.errorTracker.getErrorStats()
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      service: 'stripe-deposit',
      environment: process.env.NODE_ENV || 'development',
      health: healthStatus,
      performance: performanceHealth,
      errors: errorStats,
      memory: this.getMemoryUsage()
    };
  }
  
  /**
   * Get performance health
   */
  getPerformanceHealth() {
    const metrics = performanceMetrics.getMetrics();
    const issues = [];
    
    // Analyze performance metrics
    Object.values(metrics).forEach(metric => {
      if (metric.p95Duration > 1000) {
        issues.push(`${metric.operation} has slow P95: ${metric.p95Duration}ms`);
      }
      
      if (metric.successRate < 95) {
        issues.push(`${metric.operation} has low success rate: ${metric.successRate}%`);
      }
    });
    
    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      metrics,
      issues,
      uptime: performanceMetrics.getUptime()
    };
  }
  
  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapUsedPercent: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }
  
  /**
   * Create monitoring dashboard data
   */
  async getDashboardData() {
    const status = await this.getStatus();
    
    return {
      ...status,
      dashboard: {
        healthScore: this.calculateHealthScore(status.health),
        performanceScore: this.calculatePerformanceScore(status.performance),
        errorRate: this.calculateErrorRate(status.errors),
        alerts: this.getActiveAlerts(status)
      }
    };
  }
  
  calculateHealthScore(health) {
    if (!health.summary) return 0;
    return health.summary.healthyPercent;
  }
  
  calculatePerformanceScore(performance) {
    if (performance.status === 'healthy') return 100;
    if (performance.status === 'degraded') return 70;
    return 30;
  }
  
  calculateErrorRate(errors) {
    if (errors.lastHour === 0) return 0;
    return Math.min(errors.lastHour, 100); // Cap at 100 for display
  }
  
  getActiveAlerts(status) {
    const alerts = [];
    
    // Health alerts
    if (status.health.status === 'unhealthy') {
      alerts.push({
        type: 'health',
        severity: 'critical',
        message: 'System health is unhealthy'
      });
    }
    
    // Performance alerts
    if (status.performance.issues.length > 0) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `${status.performance.issues.length} performance issues detected`
      });
    }
    
    // Error alerts
    if (status.errors.bySeverity.critical > 0) {
      alerts.push({
        type: 'errors',
        severity: 'critical',
        message: `${status.errors.bySeverity.critical} critical errors in the last hour`
      });
    }
    
    // Memory alerts
    if (status.memory.heapUsedPercent > 90) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `High memory usage: ${status.memory.heapUsedPercent}%`
      });
    }
    
    return alerts;
  }
}

/**
 * Create monitoring service with default configuration
 */
function createMonitoringService(options = {}) {
  return new MonitoringService(options);
}

/**
 * Vercel serverless function wrapper with monitoring
 */
function withMonitoring(handler, monitoringService) {
  return async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Add monitoring context to request
      req.monitoring = monitoringService;
      
      // Execute handler
      const result = await handler(req, res);
      
      // Track successful request
      const duration = Date.now() - startTime;
      await monitoringService.trackEvent('request_completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration
      });
      
      return result;
      
    } catch (error) {
      // Track error
      await monitoringService.trackError(error, {
        method: req.method,
        url: req.url,
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  };
}

module.exports = {
  MonitoringService,
  NotificationService,
  createMonitoringService,
  withMonitoring
};
