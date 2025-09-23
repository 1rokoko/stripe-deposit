/**
 * Enhanced authentication middleware
 * Provides Bearer token authentication with additional security features
 */

const { buildLogger } = require('../utils/logger');

class AuthMiddleware {
  constructor(options = {}) {
    this.apiToken = options.apiToken;
    this.logger = options.logger || buildLogger('auth-middleware');
    this.rateLimiter = options.rateLimiter;
    this.enableLogging = options.enableLogging !== false;
  }

  /**
   * Extract and validate Bearer token from request headers
   */
  extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return { valid: false, error: 'Missing Authorization header' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Invalid Authorization header format. Expected: Bearer <token>' };
    }

    const token = authHeader.slice('Bearer '.length).trim();
    
    if (!token) {
      return { valid: false, error: 'Empty token in Authorization header' };
    }

    return { valid: true, token };
  }

  /**
   * Validate token against configured API token
   */
  validateToken(token) {
    if (!this.apiToken) {
      return { valid: false, error: 'API authentication not configured' };
    }

    if (token !== this.apiToken) {
      return { valid: false, error: 'Invalid token' };
    }

    return { valid: true };
  }

  /**
   * Get client IP address for logging
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           'unknown';
  }

  /**
   * Log authentication attempt
   */
  logAuthAttempt(req, success, error = null) {
    if (!this.enableLogging) return;

    const logData = {
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method,
      url: req.url,
      success,
      timestamp: new Date().toISOString()
    };

    if (error) {
      logData.error = error;
    }

    if (success) {
      this.logger.info('Authentication successful', logData);
    } else {
      this.logger.warn('Authentication failed', logData);
    }
  }

  /**
   * Check if request is authorized
   */
  isAuthorized(req) {
    // Extract token
    const tokenResult = this.extractToken(req);
    if (!tokenResult.valid) {
      this.logAuthAttempt(req, false, tokenResult.error);
      return { authorized: false, error: tokenResult.error };
    }

    // Validate token
    const validationResult = this.validateToken(tokenResult.token);
    if (!validationResult.valid) {
      this.logAuthAttempt(req, false, validationResult.error);
      return { authorized: false, error: validationResult.error };
    }

    this.logAuthAttempt(req, true);
    return { authorized: true };
  }

  /**
   * Express/Vercel middleware function
   */
  middleware() {
    return (req, res, next) => {
      const result = this.isAuthorized(req);
      
      if (!result.authorized) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: result.error
        });
      }

      // Add auth info to request
      req.auth = {
        authenticated: true,
        timestamp: new Date().toISOString()
      };

      if (next) {
        next();
      }
    };
  }

  /**
   * Simple function for direct use in serverless functions
   */
  requireAuth(req, res) {
    const result = this.isAuthorized(req);
    
    if (!result.authorized) {
      res.status(401).json({
        error: 'Unauthorized',
        message: result.error
      });
      return false;
    }

    // Add auth info to request
    req.auth = {
      authenticated: true,
      timestamp: new Date().toISOString()
    };

    return true;
  }
}

/**
 * Create auth middleware instance
 */
function createAuthMiddleware(options = {}) {
  return new AuthMiddleware(options);
}

/**
 * Simple auth check function (backward compatibility)
 */
function isAuthorized(req, apiToken) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token === apiToken;
}

/**
 * Enhanced auth check with detailed error information
 */
function checkAuthorization(req, apiToken, options = {}) {
  const middleware = new AuthMiddleware({
    apiToken,
    enableLogging: options.enableLogging,
    logger: options.logger
  });
  
  return middleware.isAuthorized(req);
}

module.exports = {
  AuthMiddleware,
  createAuthMiddleware,
  isAuthorized,
  checkAuthorization
};
