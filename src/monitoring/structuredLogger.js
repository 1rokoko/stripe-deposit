/**
 * Enhanced Structured Logging System
 * Provides comprehensive logging with structured data and multiple outputs
 */

/**
 * Log levels with numeric values for filtering
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Log categories for better organization
 */
const LOG_CATEGORIES = {
  API: 'api',
  AUTH: 'auth',
  DEPOSIT: 'deposit',
  STRIPE: 'stripe',
  WEBHOOK: 'webhook',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  DATABASE: 'database',
  SYSTEM: 'system',
  ERROR: 'error'
};

/**
 * Enhanced structured logger class
 */
class StructuredLogger {
  constructor(options = {}) {
    this.service = options.service || 'stripe-deposit';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || '1.0.0';
    this.logLevel = this.parseLogLevel(options.logLevel || process.env.LOG_LEVEL || 'info');
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.enableExternal = options.enableExternal || false;
    this.externalEndpoint = options.externalEndpoint;
    this.sensitiveFields = new Set(options.sensitiveFields || [
      'password', 'token', 'secret', 'key', 'authorization', 'cardNumber', 'cvc'
    ]);
  }
  
  parseLogLevel(level) {
    return LOG_LEVELS[level.toLowerCase()] !== undefined ? level.toLowerCase() : 'info';
  }
  
  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.logLevel];
  }
  
  /**
   * Sanitize sensitive data from log entries
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveFields.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...[TRUNCATED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * Create structured log entry
   */
  createLogEntry(level, message, data = {}, category = LOG_CATEGORIES.SYSTEM) {
    const timestamp = new Date().toISOString();
    const sanitizedData = this.sanitizeData(data);
    
    return {
      timestamp,
      level,
      message,
      category,
      service: this.service,
      environment: this.environment,
      version: this.version,
      ...sanitizedData,
      // Add correlation ID if available
      correlationId: data.correlationId || this.generateCorrelationId(),
      // Add request context if available
      ...(data.requestId && { requestId: data.requestId }),
      ...(data.userId && { userId: data.userId }),
      ...(data.sessionId && { sessionId: data.sessionId })
    };
  }
  
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Output log entry to various destinations
   */
  async outputLog(logEntry) {
    // Console output
    if (this.enableConsole) {
      this.outputToConsole(logEntry);
    }
    
    // File output (if enabled)
    if (this.enableFile) {
      await this.outputToFile(logEntry);
    }
    
    // External service output (if enabled)
    if (this.enableExternal && this.externalEndpoint) {
      await this.outputToExternal(logEntry);
    }
  }
  
  outputToConsole(logEntry) {
    const { level, timestamp, message, category, ...rest } = logEntry;
    
    if (this.environment === 'development') {
      // Pretty format for development
      const colorMap = {
        error: '\x1b[31m',   // Red
        warn: '\x1b[33m',    // Yellow
        info: '\x1b[36m',    // Cyan
        debug: '\x1b[35m',   // Magenta
        trace: '\x1b[37m'    // White
      };
      
      const reset = '\x1b[0m';
      const color = colorMap[level] || '';
      
      console.log(`${color}[${timestamp}] ${level.toUpperCase()} [${category}]${reset} ${message}`);
      
      if (Object.keys(rest).length > 0) {
        console.log(`${color}Data:${reset}`, JSON.stringify(rest, null, 2));
      }
    } else {
      // JSON format for production
      console.log(JSON.stringify(logEntry));
    }
  }
  
  async outputToFile(logEntry) {
    // File logging implementation would go here
    // For serverless environments, this might write to a cloud storage service
    try {
      // Example: append to log file or send to cloud storage
      // await fs.appendFile('/tmp/app.log', JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }
  
  async outputToExternal(logEntry) {
    // External service logging (e.g., Datadog, LogRocket, etc.)
    try {
      if (this.externalEndpoint) {
        // Example HTTP POST to external logging service
        // await fetch(this.externalEndpoint, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(logEntry)
        // });
      }
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }
  
  /**
   * Core logging methods
   */
  async log(level, message, data = {}, category = LOG_CATEGORIES.SYSTEM) {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const logEntry = this.createLogEntry(level, message, data, category);
    await this.outputLog(logEntry);
    return logEntry;
  }
  
  async error(message, data = {}, category = LOG_CATEGORIES.ERROR) {
    return this.log('error', message, data, category);
  }
  
  async warn(message, data = {}, category = LOG_CATEGORIES.SYSTEM) {
    return this.log('warn', message, data, category);
  }
  
  async info(message, data = {}, category = LOG_CATEGORIES.SYSTEM) {
    return this.log('info', message, data, category);
  }
  
  async debug(message, data = {}, category = LOG_CATEGORIES.SYSTEM) {
    return this.log('debug', message, data, category);
  }
  
  async trace(message, data = {}, category = LOG_CATEGORIES.SYSTEM) {
    return this.log('trace', message, data, category);
  }
  
  /**
   * Specialized logging methods for different domains
   */
  
  // API Request/Response logging
  async logAPIRequest(req, res, duration) {
    const data = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      requestId: req.headers['x-request-id'],
      contentLength: res.getHeader('content-length')
    };
    
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
    
    return this.log(level, message, data, LOG_CATEGORIES.API);
  }
  
  // Authentication logging
  async logAuthEvent(event, data = {}) {
    const message = `Authentication ${event}`;
    const level = event === 'success' ? 'info' : 'warn';
    
    return this.log(level, message, data, LOG_CATEGORIES.AUTH);
  }
  
  // Deposit operations logging
  async logDepositEvent(event, depositId, data = {}) {
    const message = `Deposit ${event}: ${depositId}`;
    
    return this.log('info', message, { depositId, ...data }, LOG_CATEGORIES.DEPOSIT);
  }
  
  // Stripe API logging
  async logStripeEvent(event, data = {}) {
    const message = `Stripe ${event}`;
    const level = data.error ? 'error' : 'info';
    
    return this.log(level, message, data, LOG_CATEGORIES.STRIPE);
  }
  
  // Webhook logging
  async logWebhookEvent(event, data = {}) {
    const message = `Webhook ${event}`;
    
    return this.log('info', message, data, LOG_CATEGORIES.WEBHOOK);
  }
  
  // Security events logging
  async logSecurityEvent(event, data = {}) {
    const message = `Security ${event}`;
    const level = data.severity || 'warn';
    
    return this.log(level, message, data, LOG_CATEGORIES.SECURITY);
  }
  
  // Performance logging
  async logPerformanceMetric(operation, duration, success = true, data = {}) {
    const message = `Performance: ${operation} ${duration}ms ${success ? 'success' : 'failed'}`;
    const level = success ? 'info' : 'warn';
    
    return this.log(level, message, { operation, duration, success, ...data }, LOG_CATEGORIES.PERFORMANCE);
  }
  
  // Database operations logging
  async logDatabaseEvent(operation, duration, success = true, data = {}) {
    const message = `Database ${operation} ${duration}ms ${success ? 'success' : 'failed'}`;
    const level = success ? 'debug' : 'error';
    
    return this.log(level, message, { operation, duration, success, ...data }, LOG_CATEGORIES.DATABASE);
  }
  
  // Error logging with stack trace
  async logError(error, context = {}) {
    const data = {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code,
      ...context
    };
    
    return this.log('error', `Error: ${error.message}`, data, LOG_CATEGORIES.ERROR);
  }
}

/**
 * Create logger instance with default configuration
 */
function createLogger(options = {}) {
  return new StructuredLogger(options);
}

/**
 * Default logger instance
 */
const defaultLogger = createLogger({
  service: 'stripe-deposit',
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  enableExternal: process.env.NODE_ENV === 'production'
});

module.exports = {
  StructuredLogger,
  createLogger,
  defaultLogger,
  LOG_LEVELS,
  LOG_CATEGORIES
};
