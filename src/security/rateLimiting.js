/**
 * Enhanced Rate Limiting System
 * Provides multiple rate limiting strategies with different buckets
 */

/**
 * Rate limiting configurations for different endpoint types
 */
const RATE_LIMIT_CONFIGS = {
  // Global IP-based rate limiting
  global: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,         // 100 requests per minute per IP
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => getClientIP(req)
  },
  
  // Authentication endpoints (more restrictive)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,           // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
    keyGenerator: (req) => getClientIP(req)
  },
  
  // API endpoints (per authenticated user)
  api: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,          // 60 requests per minute per user
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => req.auth?.userId || getClientIP(req)
  },
  
  // Deposit creation (more restrictive)
  deposits: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 deposit creations per minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => req.auth?.userId || getClientIP(req)
  },
  
  // Webhook endpoints
  webhook: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 1000,        // 1000 webhooks per minute (Stripe can send many)
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => 'webhook'
  },
  
  // Health check endpoints (very permissive)
  health: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 1000,        // 1000 health checks per minute
    skipSuccessfulRequests: true,
    skipFailedRequests: true,
    keyGenerator: (req) => getClientIP(req)
  }
};

/**
 * In-memory rate limit store
 * In production, consider using Redis for distributed rate limiting
 */
class MemoryRateLimitStore {
  constructor() {
    this.buckets = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }
  
  get(key) {
    return this.buckets.get(key);
  }
  
  set(key, value) {
    this.buckets.set(key, value);
  }
  
  delete(key) {
    this.buckets.delete(key);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetTime < now) {
        this.buckets.delete(key);
      }
    }
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
  }
}

// Global store instance
const rateLimitStore = new MemoryRateLimitStore();

/**
 * Extract client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Check rate limit for a specific key and configuration
 */
function checkRateLimit(key, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  let bucket = rateLimitStore.get(key);
  
  if (!bucket) {
    bucket = {
      requests: [],
      resetTime: now + config.windowMs
    };
  }
  
  // Remove old requests outside the window
  bucket.requests = bucket.requests.filter(timestamp => timestamp > windowStart);
  
  // Update reset time if window has passed
  if (now > bucket.resetTime) {
    bucket.requests = [];
    bucket.resetTime = now + config.windowMs;
  }
  
  // Check if limit exceeded
  const currentCount = bucket.requests.length;
  const allowed = currentCount < config.maxRequests;
  
  if (allowed) {
    bucket.requests.push(now);
    rateLimitStore.set(key, bucket);
  }
  
  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0)),
    resetTime: bucket.resetTime,
    retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetTime - now) / 1000),
    limit: config.maxRequests,
    windowMs: config.windowMs
  };
}

/**
 * Create rate limiting middleware
 */
function createRateLimitMiddleware(configName = 'global', customConfig = {}) {
  const config = { ...RATE_LIMIT_CONFIGS[configName], ...customConfig };
  
  if (!config) {
    throw new Error(`Unknown rate limit configuration: ${configName}`);
  }
  
  return (req, res, next) => {
    const key = config.keyGenerator(req);
    const result = checkRateLimit(key, config);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    res.setHeader('X-RateLimit-Window', Math.ceil(config.windowMs / 1000));
    
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds);
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
        retryAfterSeconds: result.retryAfterSeconds,
        limit: result.limit,
        windowMs: result.windowMs
      });
    }
    
    if (next) {
      next();
    }
  };
}

/**
 * Adaptive rate limiting based on response status
 */
function createAdaptiveRateLimitMiddleware(configName = 'global') {
  const baseConfig = RATE_LIMIT_CONFIGS[configName];
  
  return (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override response methods to check status
    res.send = function(body) {
      handleResponse.call(this, body);
      return originalSend.call(this, body);
    };
    
    res.json = function(body) {
      handleResponse.call(this, body);
      return originalJson.call(this, body);
    };
    
    function handleResponse(body) {
      const status = this.statusCode;
      const key = baseConfig.keyGenerator(req);
      
      // Skip counting based on configuration and status
      if (baseConfig.skipSuccessfulRequests && status < 400) {
        return;
      }
      
      if (baseConfig.skipFailedRequests && status >= 400) {
        return;
      }
      
      // Apply stricter limits for failed requests
      let config = baseConfig;
      if (status >= 400) {
        config = {
          ...baseConfig,
          maxRequests: Math.floor(baseConfig.maxRequests * 0.5) // Reduce limit by 50% for errors
        };
      }
      
      checkRateLimit(key, config);
    }
    
    // Apply initial rate limit check
    const key = baseConfig.keyGenerator(req);
    const result = checkRateLimit(key, baseConfig);
    
    res.setHeader('X-RateLimit-Limit', baseConfig.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds);
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSeconds: result.retryAfterSeconds
      });
    }
    
    if (next) {
      next();
    }
  };
}

/**
 * Burst protection - allows short bursts but enforces longer-term limits
 */
function createBurstProtectionMiddleware(shortConfig, longConfig) {
  return (req, res, next) => {
    const key = shortConfig.keyGenerator(req);
    
    // Check short-term limit (burst)
    const shortResult = checkRateLimit(`short:${key}`, shortConfig);
    
    // Check long-term limit
    const longResult = checkRateLimit(`long:${key}`, longConfig);
    
    // Set headers based on most restrictive limit
    const mostRestrictive = shortResult.remaining < longResult.remaining ? shortResult : longResult;
    
    res.setHeader('X-RateLimit-Limit', `${shortConfig.maxRequests},${longConfig.maxRequests}`);
    res.setHeader('X-RateLimit-Remaining', mostRestrictive.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(mostRestrictive.resetTime / 1000));
    
    if (!shortResult.allowed || !longResult.allowed) {
      const retryAfter = Math.max(shortResult.retryAfterSeconds, longResult.retryAfterSeconds);
      res.setHeader('Retry-After', retryAfter);
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: !shortResult.allowed ? 'Burst limit exceeded' : 'Long-term limit exceeded',
        retryAfterSeconds: retryAfter
      });
    }
    
    if (next) {
      next();
    }
  };
}

/**
 * Get rate limit status for a key
 */
function getRateLimitStatus(key, configName = 'global') {
  const config = RATE_LIMIT_CONFIGS[configName];
  const bucket = rateLimitStore.get(key);
  
  if (!bucket) {
    return {
      requests: 0,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      limit: config.maxRequests
    };
  }
  
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const validRequests = bucket.requests.filter(timestamp => timestamp > windowStart);
  
  return {
    requests: validRequests.length,
    remaining: Math.max(0, config.maxRequests - validRequests.length),
    resetTime: bucket.resetTime,
    limit: config.maxRequests
  };
}

/**
 * Reset rate limit for a specific key
 */
function resetRateLimit(key) {
  rateLimitStore.delete(key);
}

/**
 * Get all rate limit statistics
 */
function getRateLimitStats() {
  const stats = {
    totalKeys: rateLimitStore.buckets.size,
    buckets: {}
  };
  
  for (const [key, bucket] of rateLimitStore.buckets.entries()) {
    stats.buckets[key] = {
      requests: bucket.requests.length,
      resetTime: bucket.resetTime
    };
  }
  
  return stats;
}

module.exports = {
  RATE_LIMIT_CONFIGS,
  MemoryRateLimitStore,
  getClientIP,
  checkRateLimit,
  createRateLimitMiddleware,
  createAdaptiveRateLimitMiddleware,
  createBurstProtectionMiddleware,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitStats,
  rateLimitStore
};
