/**
 * Comprehensive Health Check System
 * Monitors system health and provides detailed status information
 */

const { defaultLogger } = require('./structuredLogger');
const { getPerformanceHealth } = require('./performanceMonitor');
const { errorStorage } = require('./errorTracker');

/**
 * Health check status levels
 */
const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};

/**
 * Individual health check interface
 */
class HealthCheck {
  constructor(name, checkFunction, options = {}) {
    this.name = name;
    this.checkFunction = checkFunction;
    this.timeout = options.timeout || 5000;
    this.critical = options.critical || false;
    this.interval = options.interval || 60000; // 1 minute
    this.lastCheck = null;
    this.lastResult = null;
    this.enabled = options.enabled !== false;
  }
  
  async execute() {
    if (!this.enabled) {
      return {
        name: this.name,
        status: HEALTH_STATUS.UNKNOWN,
        message: 'Check disabled',
        timestamp: new Date().toISOString(),
        duration: 0
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Execute with timeout
      const result = await Promise.race([
        this.checkFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.timeout)
        )
      ]);
      
      const duration = Date.now() - startTime;
      
      this.lastCheck = Date.now();
      this.lastResult = {
        name: this.name,
        status: result.status || HEALTH_STATUS.HEALTHY,
        message: result.message || 'OK',
        details: result.details || {},
        timestamp: new Date().toISOString(),
        duration,
        critical: this.critical
      };
      
      return this.lastResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.lastCheck = Date.now();
      this.lastResult = {
        name: this.name,
        status: HEALTH_STATUS.UNHEALTHY,
        message: error.message,
        error: error.name,
        timestamp: new Date().toISOString(),
        duration,
        critical: this.critical
      };
      
      return this.lastResult;
    }
  }
  
  isStale() {
    if (!this.lastCheck) return true;
    return Date.now() - this.lastCheck > this.interval * 2;
  }
}

/**
 * Health check manager
 */
class HealthCheckManager {
  constructor(options = {}) {
    this.checks = new Map();
    this.logger = options.logger || defaultLogger;
    this.enablePeriodicChecks = options.enablePeriodicChecks !== false;
    this.periodicInterval = options.periodicInterval || 60000; // 1 minute
    this.periodicTimer = null;
  }
  
  /**
   * Register a health check
   */
  register(name, checkFunction, options = {}) {
    const healthCheck = new HealthCheck(name, checkFunction, options);
    this.checks.set(name, healthCheck);
    
    this.logger.debug('Health check registered', { name, critical: options.critical });
    
    return healthCheck;
  }
  
  /**
   * Unregister a health check
   */
  unregister(name) {
    const removed = this.checks.delete(name);
    if (removed) {
      this.logger.debug('Health check unregistered', { name });
    }
    return removed;
  }
  
  /**
   * Execute a specific health check
   */
  async check(name) {
    const healthCheck = this.checks.get(name);
    if (!healthCheck) {
      throw new Error(`Health check '${name}' not found`);
    }
    
    return await healthCheck.execute();
  }
  
  /**
   * Execute all health checks
   */
  async checkAll() {
    const results = [];
    const promises = [];
    
    for (const [name, healthCheck] of this.checks.entries()) {
      promises.push(
        healthCheck.execute().catch(error => ({
          name,
          status: HEALTH_STATUS.UNHEALTHY,
          message: error.message,
          error: error.name,
          timestamp: new Date().toISOString(),
          duration: 0,
          critical: healthCheck.critical
        }))
      );
    }
    
    const checkResults = await Promise.all(promises);
    
    // Determine overall health status
    const overallStatus = this.determineOverallStatus(checkResults);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: checkResults,
      summary: this.generateSummary(checkResults)
    };
  }
  
  /**
   * Determine overall health status from individual checks
   */
  determineOverallStatus(checkResults) {
    const criticalChecks = checkResults.filter(check => check.critical);
    const nonCriticalChecks = checkResults.filter(check => !check.critical);
    
    // If any critical check is unhealthy, overall status is unhealthy
    if (criticalChecks.some(check => check.status === HEALTH_STATUS.UNHEALTHY)) {
      return HEALTH_STATUS.UNHEALTHY;
    }
    
    // If any critical check is degraded, overall status is degraded
    if (criticalChecks.some(check => check.status === HEALTH_STATUS.DEGRADED)) {
      return HEALTH_STATUS.DEGRADED;
    }
    
    // If any non-critical check is unhealthy, overall status is degraded
    if (nonCriticalChecks.some(check => check.status === HEALTH_STATUS.UNHEALTHY)) {
      return HEALTH_STATUS.DEGRADED;
    }
    
    // If any check is degraded, overall status is degraded
    if (checkResults.some(check => check.status === HEALTH_STATUS.DEGRADED)) {
      return HEALTH_STATUS.DEGRADED;
    }
    
    return HEALTH_STATUS.HEALTHY;
  }
  
  /**
   * Generate summary statistics
   */
  generateSummary(checkResults) {
    const total = checkResults.length;
    const healthy = checkResults.filter(check => check.status === HEALTH_STATUS.HEALTHY).length;
    const degraded = checkResults.filter(check => check.status === HEALTH_STATUS.DEGRADED).length;
    const unhealthy = checkResults.filter(check => check.status === HEALTH_STATUS.UNHEALTHY).length;
    const unknown = checkResults.filter(check => check.status === HEALTH_STATUS.UNKNOWN).length;
    
    return {
      total,
      healthy,
      degraded,
      unhealthy,
      unknown,
      healthyPercent: total > 0 ? Math.round((healthy / total) * 100) : 0
    };
  }
  
  /**
   * Start periodic health checks
   */
  startPeriodicChecks() {
    if (!this.enablePeriodicChecks || this.periodicTimer) {
      return;
    }
    
    this.periodicTimer = setInterval(async () => {
      try {
        const results = await this.checkAll();
        
        // Log overall health status
        this.logger.info('Periodic health check completed', {
          status: results.status,
          summary: results.summary,
          unhealthyChecks: results.checks
            .filter(check => check.status === HEALTH_STATUS.UNHEALTHY)
            .map(check => check.name)
        });
        
        // Alert on unhealthy status
        if (results.status === HEALTH_STATUS.UNHEALTHY) {
          this.logger.warn('System health is unhealthy', {
            unhealthyChecks: results.checks.filter(check => check.status === HEALTH_STATUS.UNHEALTHY)
          });
        }
        
      } catch (error) {
        this.logger.error('Periodic health check failed', { error: error.message });
      }
    }, this.periodicInterval);
    
    this.logger.info('Periodic health checks started', { interval: this.periodicInterval });
  }
  
  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
      this.logger.info('Periodic health checks stopped');
    }
  }
}

/**
 * Default health checks
 */

// Memory usage health check
function createMemoryHealthCheck() {
  return async () => {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    if (heapUsedPercent > 90) {
      return {
        status: HEALTH_STATUS.UNHEALTHY,
        message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`,
        details: { heapUsedPercent, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal }
      };
    }
    
    if (heapUsedPercent > 75) {
      return {
        status: HEALTH_STATUS.DEGRADED,
        message: `Elevated memory usage: ${heapUsedPercent.toFixed(1)}%`,
        details: { heapUsedPercent, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal }
      };
    }
    
    return {
      status: HEALTH_STATUS.HEALTHY,
      message: `Memory usage normal: ${heapUsedPercent.toFixed(1)}%`,
      details: { heapUsedPercent, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal }
    };
  };
}

// Error rate health check
function createErrorRateHealthCheck() {
  return async () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentErrors = errorStorage.getRecentErrors(1000)
      .filter(err => new Date(err.timestamp).getTime() > oneHourAgo);
    
    const criticalErrors = recentErrors.filter(err => err.severity === 'critical');
    
    if (criticalErrors.length > 10) {
      return {
        status: HEALTH_STATUS.UNHEALTHY,
        message: `High critical error rate: ${criticalErrors.length} in last hour`,
        details: { criticalErrors: criticalErrors.length, totalErrors: recentErrors.length }
      };
    }
    
    if (recentErrors.length > 50) {
      return {
        status: HEALTH_STATUS.DEGRADED,
        message: `Elevated error rate: ${recentErrors.length} in last hour`,
        details: { criticalErrors: criticalErrors.length, totalErrors: recentErrors.length }
      };
    }
    
    return {
      status: HEALTH_STATUS.HEALTHY,
      message: `Error rate normal: ${recentErrors.length} in last hour`,
      details: { criticalErrors: criticalErrors.length, totalErrors: recentErrors.length }
    };
  };
}

// Database health check
function createDatabaseHealthCheck(repository) {
  return async () => {
    try {
      const startTime = Date.now();
      
      // Try a simple query
      await repository.count();
      
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        return {
          status: HEALTH_STATUS.DEGRADED,
          message: `Database slow: ${duration}ms`,
          details: { duration }
        };
      }
      
      return {
        status: HEALTH_STATUS.HEALTHY,
        message: `Database responsive: ${duration}ms`,
        details: { duration }
      };
      
    } catch (error) {
      return {
        status: HEALTH_STATUS.UNHEALTHY,
        message: `Database error: ${error.message}`,
        details: { error: error.name }
      };
    }
  };
}

// Stripe API health check
function createStripeHealthCheck(stripeClient) {
  return async () => {
    try {
      const startTime = Date.now();
      
      // Try to retrieve account information
      await stripeClient.accounts.retrieve();
      
      const duration = Date.now() - startTime;
      
      if (duration > 3000) {
        return {
          status: HEALTH_STATUS.DEGRADED,
          message: `Stripe API slow: ${duration}ms`,
          details: { duration }
        };
      }
      
      return {
        status: HEALTH_STATUS.HEALTHY,
        message: `Stripe API responsive: ${duration}ms`,
        details: { duration }
      };
      
    } catch (error) {
      return {
        status: HEALTH_STATUS.UNHEALTHY,
        message: `Stripe API error: ${error.message}`,
        details: { error: error.type || error.name }
      };
    }
  };
}

// Create default health check manager with standard checks
function createDefaultHealthCheckManager(options = {}) {
  const manager = new HealthCheckManager(options);
  
  // Register default checks
  manager.register('memory', createMemoryHealthCheck(), { critical: true });
  manager.register('errors', createErrorRateHealthCheck(), { critical: false });
  
  // Register database check if repository provided
  if (options.repository) {
    manager.register('database', createDatabaseHealthCheck(options.repository), { critical: true });
  }
  
  // Register Stripe check if client provided
  if (options.stripeClient) {
    manager.register('stripe', createStripeHealthCheck(options.stripeClient), { critical: true });
  }
  
  return manager;
}

module.exports = {
  HealthCheck,
  HealthCheckManager,
  createDefaultHealthCheckManager,
  createMemoryHealthCheck,
  createErrorRateHealthCheck,
  createDatabaseHealthCheck,
  createStripeHealthCheck,
  HEALTH_STATUS
};
