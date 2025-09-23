/**
 * Comprehensive Error Tracking System
 * Tracks, categorizes, and reports application errors
 */

const { defaultLogger } = require('./structuredLogger');

/**
 * Error severity levels
 */
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Error categories for classification
 */
const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  STRIPE_API: 'stripe_api',
  DATABASE: 'database',
  NETWORK: 'network',
  SYSTEM: 'system',
  BUSINESS_LOGIC: 'business_logic',
  EXTERNAL_SERVICE: 'external_service',
  UNKNOWN: 'unknown'
};

/**
 * Error patterns for automatic classification
 */
const ERROR_PATTERNS = {
  [ERROR_CATEGORIES.VALIDATION]: [
    /validation/i,
    /invalid.*format/i,
    /required.*field/i,
    /missing.*parameter/i
  ],
  [ERROR_CATEGORIES.AUTHENTICATION]: [
    /unauthorized/i,
    /invalid.*token/i,
    /authentication.*failed/i,
    /invalid.*credentials/i
  ],
  [ERROR_CATEGORIES.AUTHORIZATION]: [
    /forbidden/i,
    /access.*denied/i,
    /insufficient.*permissions/i
  ],
  [ERROR_CATEGORIES.STRIPE_API]: [
    /stripe/i,
    /payment.*failed/i,
    /card.*declined/i,
    /insufficient.*funds/i
  ],
  [ERROR_CATEGORIES.DATABASE]: [
    /database/i,
    /sql/i,
    /connection.*timeout/i,
    /constraint.*violation/i
  ],
  [ERROR_CATEGORIES.NETWORK]: [
    /network/i,
    /timeout/i,
    /connection.*refused/i,
    /dns.*resolution/i
  ]
};

/**
 * Error tracking storage
 */
class ErrorStorage {
  constructor() {
    this.errors = new Map();
    this.errorCounts = new Map();
    this.maxStoredErrors = 1000;
  }
  
  store(errorId, errorData) {
    // Store error details
    this.errors.set(errorId, errorData);
    
    // Update error counts by category
    const category = errorData.category;
    this.errorCounts.set(category, (this.errorCounts.get(category) || 0) + 1);
    
    // Cleanup old errors if we exceed the limit
    if (this.errors.size > this.maxStoredErrors) {
      const oldestKey = this.errors.keys().next().value;
      this.errors.delete(oldestKey);
    }
  }
  
  getError(errorId) {
    return this.errors.get(errorId);
  }
  
  getErrorsByCategory(category) {
    const errors = [];
    for (const [id, error] of this.errors.entries()) {
      if (error.category === category) {
        errors.push({ id, ...error });
      }
    }
    return errors;
  }
  
  getErrorCounts() {
    return Object.fromEntries(this.errorCounts);
  }
  
  getRecentErrors(limit = 50) {
    const recentErrors = [];
    const entries = Array.from(this.errors.entries()).slice(-limit);
    
    for (const [id, error] of entries) {
      recentErrors.push({ id, ...error });
    }
    
    return recentErrors.reverse(); // Most recent first
  }
  
  clear() {
    this.errors.clear();
    this.errorCounts.clear();
  }
}

// Global error storage
const errorStorage = new ErrorStorage();

/**
 * Error tracker class
 */
class ErrorTracker {
  constructor(options = {}) {
    this.logger = options.logger || defaultLogger;
    this.enableAlerts = options.enableAlerts !== false;
    this.alertThresholds = options.alertThresholds || {
      criticalErrorsPerMinute: 5,
      totalErrorsPerMinute: 20,
      errorRatePercent: 10
    };
    this.notificationService = options.notificationService;
    this.lastAlertTime = new Map();
    this.alertCooldown = 5 * 60 * 1000; // 5 minutes
  }
  
  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Classify error based on message and type
   */
  classifyError(error) {
    const message = error.message || '';
    const name = error.name || '';
    const searchText = `${message} ${name}`.toLowerCase();
    
    for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(searchText)) {
          return category;
        }
      }
    }
    
    return ERROR_CATEGORIES.UNKNOWN;
  }
  
  /**
   * Determine error severity
   */
  determineSeverity(error, context = {}) {
    // Critical errors
    if (error.name === 'SystemError' || 
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('Out of memory') ||
        context.statusCode >= 500) {
      return ERROR_SEVERITY.CRITICAL;
    }
    
    // High severity errors
    if (error.name === 'DatabaseError' ||
        error.message?.includes('Stripe') ||
        context.statusCode === 401 ||
        context.statusCode === 403) {
      return ERROR_SEVERITY.HIGH;
    }
    
    // Medium severity errors
    if (context.statusCode >= 400 ||
        error.name === 'ValidationError') {
      return ERROR_SEVERITY.MEDIUM;
    }
    
    return ERROR_SEVERITY.LOW;
  }
  
  /**
   * Track an error
   */
  async track(error, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    const category = this.classifyError(error);
    const severity = this.determineSeverity(error, context);
    
    const errorData = {
      id: errorId,
      timestamp,
      message: error.message,
      name: error.name,
      stack: error.stack,
      category,
      severity,
      context: this.sanitizeContext(context),
      fingerprint: this.generateFingerprint(error),
      // Additional error properties
      ...(error.code && { code: error.code }),
      ...(error.type && { type: error.type }),
      ...(error.statusCode && { statusCode: error.statusCode })
    };
    
    // Store error
    errorStorage.store(errorId, errorData);
    
    // Log error
    await this.logger.logError(error, {
      errorId,
      category,
      severity,
      ...context
    });
    
    // Check for alerts
    if (this.enableAlerts) {
      await this.checkAlertConditions(errorData);
    }
    
    return errorId;
  }
  
  /**
   * Generate error fingerprint for grouping similar errors
   */
  generateFingerprint(error) {
    const message = error.message || '';
    const name = error.name || '';
    const stack = error.stack || '';
    
    // Extract the first few lines of stack trace for fingerprinting
    const stackLines = stack.split('\n').slice(0, 3).join('\n');
    
    // Create a simple hash-like fingerprint
    const fingerprint = `${name}:${message}:${stackLines}`
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/['"]/g, '') // Remove quotes
      .substring(0, 100);
    
    return Buffer.from(fingerprint).toString('base64').substring(0, 16);
  }
  
  /**
   * Sanitize context to remove sensitive information
   */
  sanitizeContext(context) {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...context };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Check if alert conditions are met
   */
  async checkAlertConditions(errorData) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Get recent errors
    const recentErrors = errorStorage.getRecentErrors(100)
      .filter(err => new Date(err.timestamp).getTime() > oneMinuteAgo);
    
    const criticalErrors = recentErrors.filter(err => err.severity === ERROR_SEVERITY.CRITICAL);
    
    // Check critical error threshold
    if (criticalErrors.length >= this.alertThresholds.criticalErrorsPerMinute) {
      await this.sendAlert('critical_errors_threshold', {
        count: criticalErrors.length,
        threshold: this.alertThresholds.criticalErrorsPerMinute,
        recentErrors: criticalErrors.slice(0, 5) // Include first 5 errors
      });
    }
    
    // Check total error threshold
    if (recentErrors.length >= this.alertThresholds.totalErrorsPerMinute) {
      await this.sendAlert('total_errors_threshold', {
        count: recentErrors.length,
        threshold: this.alertThresholds.totalErrorsPerMinute
      });
    }
    
    // Check for repeated errors (same fingerprint)
    const fingerprintCounts = {};
    recentErrors.forEach(err => {
      fingerprintCounts[err.fingerprint] = (fingerprintCounts[err.fingerprint] || 0) + 1;
    });
    
    for (const [fingerprint, count] of Object.entries(fingerprintCounts)) {
      if (count >= 5) { // Same error 5 times in a minute
        await this.sendAlert('repeated_error', {
          fingerprint,
          count,
          error: recentErrors.find(err => err.fingerprint === fingerprint)
        });
      }
    }
  }
  
  /**
   * Send alert notification
   */
  async sendAlert(alertType, data) {
    const alertKey = `${alertType}_${JSON.stringify(data).substring(0, 50)}`;
    const now = Date.now();
    
    // Check cooldown
    if (this.lastAlertTime.has(alertKey)) {
      const lastAlert = this.lastAlertTime.get(alertKey);
      if (now - lastAlert < this.alertCooldown) {
        return; // Skip alert due to cooldown
      }
    }
    
    this.lastAlertTime.set(alertKey, now);
    
    const alertMessage = this.formatAlertMessage(alertType, data);
    
    // Log alert
    await this.logger.warn('Error alert triggered', {
      alertType,
      data,
      message: alertMessage
    });
    
    // Send to notification service if available
    if (this.notificationService) {
      try {
        await this.notificationService.sendAlert(alertType, alertMessage, data);
      } catch (error) {
        await this.logger.error('Failed to send alert notification', { error: error.message });
      }
    }
  }
  
  /**
   * Format alert message
   */
  formatAlertMessage(alertType, data) {
    switch (alertType) {
      case 'critical_errors_threshold':
        return `🚨 Critical Error Alert: ${data.count} critical errors in the last minute (threshold: ${data.threshold})`;
      
      case 'total_errors_threshold':
        return `⚠️ High Error Rate: ${data.count} total errors in the last minute (threshold: ${data.threshold})`;
      
      case 'repeated_error':
        return `🔄 Repeated Error: Same error occurred ${data.count} times in the last minute - ${data.error.message}`;
      
      default:
        return `🚨 Error Alert: ${alertType}`;
    }
  }
  
  /**
   * Get error statistics
   */
  getErrorStats() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    
    const allErrors = errorStorage.getRecentErrors(1000);
    const lastHourErrors = allErrors.filter(err => new Date(err.timestamp).getTime() > oneHourAgo);
    const lastDayErrors = allErrors.filter(err => new Date(err.timestamp).getTime() > oneDayAgo);
    
    return {
      total: allErrors.length,
      lastHour: lastHourErrors.length,
      lastDay: lastDayErrors.length,
      bySeverity: {
        critical: allErrors.filter(err => err.severity === ERROR_SEVERITY.CRITICAL).length,
        high: allErrors.filter(err => err.severity === ERROR_SEVERITY.HIGH).length,
        medium: allErrors.filter(err => err.severity === ERROR_SEVERITY.MEDIUM).length,
        low: allErrors.filter(err => err.severity === ERROR_SEVERITY.LOW).length
      },
      byCategory: errorStorage.getErrorCounts(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Express error handling middleware
 */
function createErrorTrackingMiddleware(options = {}) {
  const errorTracker = new ErrorTracker(options);
  
  return async (err, req, res, next) => {
    // Track the error
    const errorId = await errorTracker.track(err, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userId: req.user?.id,
      statusCode: res.statusCode
    });
    
    // Add error ID to response headers for debugging
    res.setHeader('X-Error-ID', errorId);
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'Internal server error',
        errorId
      });
    } else {
      res.status(500).json({
        error: err.message,
        stack: err.stack,
        errorId
      });
    }
  };
}

// Default error tracker instance
const defaultErrorTracker = new ErrorTracker();

module.exports = {
  ErrorTracker,
  ErrorStorage,
  defaultErrorTracker,
  errorStorage,
  createErrorTrackingMiddleware,
  ERROR_SEVERITY,
  ERROR_CATEGORIES,
  ERROR_PATTERNS
};
