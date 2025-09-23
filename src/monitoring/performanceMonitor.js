/**
 * Performance Monitoring System
 * Tracks and analyzes application performance metrics
 */

const { defaultLogger } = require('./structuredLogger');

/**
 * Performance thresholds for different operations
 */
const PERFORMANCE_THRESHOLDS = {
  api: {
    fast: 100,      // < 100ms
    normal: 500,    // < 500ms
    slow: 1000,     // < 1000ms
    critical: 5000  // > 5000ms
  },
  database: {
    fast: 50,       // < 50ms
    normal: 200,    // < 200ms
    slow: 500,      // < 500ms
    critical: 2000  // > 2000ms
  },
  stripe: {
    fast: 200,      // < 200ms
    normal: 1000,   // < 1000ms
    slow: 3000,     // < 3000ms
    critical: 10000 // > 10000ms
  }
};

/**
 * Performance metrics storage
 */
class PerformanceMetrics {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }
  
  record(operation, duration, success = true, metadata = {}) {
    const key = operation;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successCount: 0,
        errorCount: 0,
        recentDurations: []
      });
    }
    
    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    
    if (success) {
      metric.successCount++;
    } else {
      metric.errorCount++;
    }
    
    // Keep last 100 durations for percentile calculations
    metric.recentDurations.push(duration);
    if (metric.recentDurations.length > 100) {
      metric.recentDurations.shift();
    }
    
    // Store metadata for the latest operation
    metric.lastMetadata = metadata;
    metric.lastUpdated = Date.now();
  }
  
  getMetrics(operation = null) {
    if (operation) {
      const metric = this.metrics.get(operation);
      if (!metric) return null;
      
      return this.calculateStatistics(operation, metric);
    }
    
    const allMetrics = {};
    for (const [op, metric] of this.metrics.entries()) {
      allMetrics[op] = this.calculateStatistics(op, metric);
    }
    
    return allMetrics;
  }
  
  calculateStatistics(operation, metric) {
    const avgDuration = metric.count > 0 ? metric.totalDuration / metric.count : 0;
    const successRate = metric.count > 0 ? (metric.successCount / metric.count) * 100 : 0;
    
    // Calculate percentiles
    const sortedDurations = [...metric.recentDurations].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedDurations, 50);
    const p95 = this.calculatePercentile(sortedDurations, 95);
    const p99 = this.calculatePercentile(sortedDurations, 99);
    
    return {
      operation,
      count: metric.count,
      successCount: metric.successCount,
      errorCount: metric.errorCount,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration * 100) / 100,
      minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
      maxDuration: metric.maxDuration,
      p50Duration: p50,
      p95Duration: p95,
      p99Duration: p99,
      lastUpdated: metric.lastUpdated,
      lastMetadata: metric.lastMetadata
    };
  }
  
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
  
  reset() {
    this.metrics.clear();
    this.startTime = Date.now();
  }
  
  getUptime() {
    return Date.now() - this.startTime;
  }
}

// Global metrics instance
const performanceMetrics = new PerformanceMetrics();

/**
 * Performance monitoring middleware for Express/HTTP
 */
function createPerformanceMiddleware(options = {}) {
  const logger = options.logger || defaultLogger;
  const enableLogging = options.enableLogging !== false;
  
  return (req, res, next) => {
    const startTime = Date.now();
    const operation = `${req.method} ${req.route?.path || req.url}`;
    
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      // Record metrics
      performanceMetrics.record(operation, duration, success, {
        statusCode: res.statusCode,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        contentLength: res.getHeader('content-length')
      });
      
      // Log performance if enabled
      if (enableLogging) {
        logger.logPerformanceMetric(operation, duration, success, {
          statusCode: res.statusCode,
          threshold: getPerformanceThreshold('api', duration)
        });
      }
      
      // Alert on slow requests
      if (duration > PERFORMANCE_THRESHOLDS.api.critical) {
        logger.warn('Critical slow request detected', {
          operation,
          duration,
          statusCode: res.statusCode,
          threshold: 'critical'
        });
      }
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
}

/**
 * Database operation performance wrapper
 */
function monitorDatabaseOperation(operation, fn, options = {}) {
  const logger = options.logger || defaultLogger;
  
  return async (...args) => {
    const startTime = Date.now();
    const operationName = `db_${operation}`;
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      // Record metrics
      performanceMetrics.record(operationName, duration, true, {
        operation,
        args: args.length
      });
      
      // Log performance
      logger.logDatabaseEvent(operation, duration, true, {
        threshold: getPerformanceThreshold('database', duration)
      });
      
      // Alert on slow queries
      if (duration > PERFORMANCE_THRESHOLDS.database.critical) {
        logger.warn('Critical slow database operation', {
          operation,
          duration,
          threshold: 'critical'
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed metrics
      performanceMetrics.record(operationName, duration, false, {
        operation,
        error: error.message
      });
      
      // Log error
      logger.logDatabaseEvent(operation, duration, false, {
        error: error.message,
        threshold: getPerformanceThreshold('database', duration)
      });
      
      throw error;
    }
  };
}

/**
 * Stripe API operation performance wrapper
 */
function monitorStripeOperation(operation, fn, options = {}) {
  const logger = options.logger || defaultLogger;
  
  return async (...args) => {
    const startTime = Date.now();
    const operationName = `stripe_${operation}`;
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      // Record metrics
      performanceMetrics.record(operationName, duration, true, {
        operation,
        stripeObject: result?.object
      });
      
      // Log performance
      logger.logStripeEvent(operation, {
        duration,
        success: true,
        threshold: getPerformanceThreshold('stripe', duration)
      });
      
      // Alert on slow Stripe calls
      if (duration > PERFORMANCE_THRESHOLDS.stripe.critical) {
        logger.warn('Critical slow Stripe operation', {
          operation,
          duration,
          threshold: 'critical'
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed metrics
      performanceMetrics.record(operationName, duration, false, {
        operation,
        stripeError: error.type,
        stripeCode: error.code
      });
      
      // Log error
      logger.logStripeEvent(operation, {
        duration,
        success: false,
        error: error.message,
        stripeError: error.type,
        stripeCode: error.code,
        threshold: getPerformanceThreshold('stripe', duration)
      });
      
      throw error;
    }
  };
}

/**
 * Get performance threshold category for a duration
 */
function getPerformanceThreshold(type, duration) {
  const thresholds = PERFORMANCE_THRESHOLDS[type] || PERFORMANCE_THRESHOLDS.api;
  
  if (duration < thresholds.fast) return 'fast';
  if (duration < thresholds.normal) return 'normal';
  if (duration < thresholds.slow) return 'slow';
  if (duration < thresholds.critical) return 'slow';
  return 'critical';
}

/**
 * Memory usage monitoring
 */
function getMemoryUsage() {
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
 * System performance health check
 */
function getPerformanceHealth() {
  const metrics = performanceMetrics.getMetrics();
  const memory = getMemoryUsage();
  const uptime = performanceMetrics.getUptime();
  
  // Analyze performance health
  const issues = [];
  
  // Check for slow operations
  Object.values(metrics).forEach(metric => {
    if (metric.p95Duration > PERFORMANCE_THRESHOLDS.api.slow) {
      issues.push(`${metric.operation} has slow P95: ${metric.p95Duration}ms`);
    }
    
    if (metric.successRate < 95) {
      issues.push(`${metric.operation} has low success rate: ${metric.successRate}%`);
    }
  });
  
  // Check memory usage
  if (memory.heapUsedPercent > 90) {
    issues.push(`High memory usage: ${memory.heapUsedPercent}%`);
  }
  
  return {
    status: issues.length === 0 ? 'healthy' : 'degraded',
    uptime,
    memory,
    metrics,
    issues,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  PerformanceMetrics,
  performanceMetrics,
  createPerformanceMiddleware,
  monitorDatabaseOperation,
  monitorStripeOperation,
  getPerformanceThreshold,
  getMemoryUsage,
  getPerformanceHealth,
  PERFORMANCE_THRESHOLDS
};
