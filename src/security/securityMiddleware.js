/**
 * Comprehensive Security Middleware Integration
 * Combines all security features into easy-to-use middleware
 */

const { createAuthMiddleware } = require('../auth/authMiddleware');
const { applySecurityHeaders, getSecurityConfig } = require('./securityHeaders');
const { createRateLimitMiddleware } = require('./rateLimiting');
const { createValidationMiddleware } = require('./inputValidation');
const { csrfProtection } = require('./csrfProtection');

/**
 * Security configuration for different environments
 */
const SECURITY_CONFIGS = {
  development: {
    rateLimiting: {
      global: { windowMs: 60000, maxRequests: 1000 },
      api: { windowMs: 60000, maxRequests: 300 },
      deposits: { windowMs: 60000, maxRequests: 50 }
    },
    csrf: {
      enabled: false // Disabled in development for easier testing
    },
    headers: getSecurityConfig('development'),
    validation: {
      strict: false
    }
  },
  
  production: {
    rateLimiting: {
      global: { windowMs: 60000, maxRequests: 100 },
      api: { windowMs: 60000, maxRequests: 60 },
      deposits: { windowMs: 60000, maxRequests: 10 }
    },
    csrf: {
      enabled: true,
      tokenExpiry: 60 * 60 * 1000 // 1 hour
    },
    headers: getSecurityConfig('production'),
    validation: {
      strict: true
    }
  }
};

/**
 * Get security configuration for current environment
 */
function getEnvironmentSecurityConfig() {
  const env = process.env.NODE_ENV || 'development';
  return SECURITY_CONFIGS[env] || SECURITY_CONFIGS.development;
}

/**
 * Create comprehensive security middleware stack
 */
function createSecurityMiddleware(options = {}) {
  const config = { ...getEnvironmentSecurityConfig(), ...options };
  const middlewares = [];
  
  // 1. Security Headers (always first)
  middlewares.push((req, res, next) => {
    applySecurityHeaders(res, config.headers);
    next();
  });
  
  // 2. Rate Limiting (before auth to prevent brute force)
  if (config.rateLimiting) {
    middlewares.push(createRateLimitMiddleware('global', config.rateLimiting.global));
  }
  
  // 3. Input Validation (sanitize early)
  if (config.validation) {
    middlewares.push((req, res, next) => {
      // Basic request sanitization
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeRequestBody(req.body);
      }
      
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeRequestQuery(req.query);
      }
      
      next();
    });
  }
  
  return middlewares;
}

/**
 * Create endpoint-specific security middleware
 */
function createEndpointSecurity(endpointType, options = {}) {
  const config = getEnvironmentSecurityConfig();
  const middlewares = [];
  
  switch (endpointType) {
    case 'public':
      // Only basic security for public endpoints
      middlewares.push((req, res, next) => {
        applySecurityHeaders(res, config.headers);
        next();
      });
      break;
      
    case 'api':
      // Full security stack for API endpoints
      middlewares.push(
        // Security headers
        (req, res, next) => {
          applySecurityHeaders(res, config.headers);
          next();
        },
        // Rate limiting
        createRateLimitMiddleware('api', config.rateLimiting.api),
        // Authentication
        createAuthMiddleware({
          apiToken: process.env.API_AUTH_TOKEN,
          enableLogging: true
        }).middleware()
      );
      break;
      
    case 'deposits':
      // Enhanced security for deposit endpoints
      middlewares.push(
        // Security headers
        (req, res, next) => {
          applySecurityHeaders(res, config.headers);
          next();
        },
        // Stricter rate limiting
        createRateLimitMiddleware('deposits', config.rateLimiting.deposits),
        // Authentication
        createAuthMiddleware({
          apiToken: process.env.API_AUTH_TOKEN,
          enableLogging: true
        }).middleware(),
        // Input validation
        createValidationMiddleware('depositCreation')
      );
      break;
      
    case 'webhook':
      // Webhook-specific security
      middlewares.push(
        // Security headers
        (req, res, next) => {
          applySecurityHeaders(res, config.headers);
          next();
        },
        // Webhook rate limiting
        createRateLimitMiddleware('webhook', config.rateLimiting.webhook || { windowMs: 60000, maxRequests: 1000 })
      );
      break;
      
    default:
      throw new Error(`Unknown endpoint type: ${endpointType}`);
  }
  
  return middlewares;
}

/**
 * Sanitize request body
 */
function sanitizeRequestBody(body, maxDepth = 3) {
  if (maxDepth <= 0 || !body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = {};
  const maxKeys = 50;
  const keys = Object.keys(body).slice(0, maxKeys);
  
  for (const key of keys) {
    const sanitizedKey = sanitizeString(key);
    if (sanitizedKey) {
      const value = body[key];
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = sanitizeRequestBody(value, maxDepth - 1);
      } else if (typeof value === 'number' && isFinite(value)) {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Sanitize request query parameters
 */
function sanitizeRequestQuery(query) {
  const sanitized = {};
  const maxParams = 20;
  const keys = Object.keys(query).slice(0, maxParams);
  
  for (const key of keys) {
    const sanitizedKey = sanitizeString(key);
    if (sanitizedKey) {
      const value = query[key];
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.slice(0, 10).map(v => sanitizeString(String(v)));
      }
    }
  }
  
  return sanitized;
}

/**
 * Basic string sanitization
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '')           // Remove HTML tags
    .replace(/['"]/g, '')           // Remove quotes
    .replace(/javascript:/gi, '')   // Remove javascript: protocol
    .replace(/on\w+=/gi, '')        // Remove event handlers
    .substring(0, 1000);            // Limit length
}

/**
 * Vercel serverless function wrapper with comprehensive security
 */
function withSecurity(handler, endpointType = 'api', options = {}) {
  const middlewares = createEndpointSecurity(endpointType, options);
  
  return async (req, res) => {
    // Apply middlewares sequentially
    for (const middleware of middlewares) {
      await new Promise((resolve, reject) => {
        middleware(req, res, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    
    // Call the actual handler
    return handler(req, res);
  };
}

/**
 * Express middleware chain for comprehensive security
 */
function securityMiddlewareChain(endpointType = 'api', options = {}) {
  return createEndpointSecurity(endpointType, options);
}

/**
 * Security health check
 */
function getSecurityHealth() {
  const config = getEnvironmentSecurityConfig();
  
  return {
    environment: process.env.NODE_ENV || 'development',
    securityFeatures: {
      rateLimiting: !!config.rateLimiting,
      csrf: config.csrf?.enabled || false,
      securityHeaders: !!config.headers,
      inputValidation: !!config.validation,
      authentication: !!process.env.API_AUTH_TOKEN
    },
    configuration: {
      rateLimits: config.rateLimiting,
      csrfEnabled: config.csrf?.enabled,
      validationStrict: config.validation?.strict
    }
  };
}

/**
 * Security metrics collection
 */
class SecurityMetrics {
  constructor() {
    this.metrics = {
      rateLimitHits: 0,
      authFailures: 0,
      validationFailures: 0,
      csrfFailures: 0,
      totalRequests: 0
    };
  }
  
  recordRateLimitHit() {
    this.metrics.rateLimitHits++;
  }
  
  recordAuthFailure() {
    this.metrics.authFailures++;
  }
  
  recordValidationFailure() {
    this.metrics.validationFailures++;
  }
  
  recordCSRFFailure() {
    this.metrics.csrfFailures++;
  }
  
  recordRequest() {
    this.metrics.totalRequests++;
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  reset() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
  }
}

// Global security metrics instance
const securityMetrics = new SecurityMetrics();

module.exports = {
  SECURITY_CONFIGS,
  getEnvironmentSecurityConfig,
  createSecurityMiddleware,
  createEndpointSecurity,
  sanitizeRequestBody,
  sanitizeRequestQuery,
  sanitizeString,
  withSecurity,
  securityMiddlewareChain,
  getSecurityHealth,
  SecurityMetrics,
  securityMetrics
};
