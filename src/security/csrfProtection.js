/**
 * CSRF Protection Implementation
 * Protects against Cross-Site Request Forgery attacks
 */

const crypto = require('crypto');

/**
 * CSRF token store (in production, use Redis or database)
 */
class CSRFTokenStore {
  constructor() {
    this.tokens = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // Cleanup every 5 minutes
  }
  
  set(sessionId, token, expiresAt) {
    this.tokens.set(sessionId, { token, expiresAt });
  }
  
  get(sessionId) {
    const entry = this.tokens.get(sessionId);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(sessionId);
      return null;
    }
    
    return entry.token;
  }
  
  delete(sessionId) {
    this.tokens.delete(sessionId);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [sessionId, entry] of this.tokens.entries()) {
      if (now > entry.expiresAt) {
        this.tokens.delete(sessionId);
      }
    }
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tokens.clear();
  }
}

// Global token store
const csrfTokenStore = new CSRFTokenStore();

/**
 * CSRF configuration
 */
const CSRF_CONFIG = {
  tokenLength: 32,                    // Token length in bytes
  tokenExpiry: 60 * 60 * 1000,       // 1 hour
  cookieName: 'csrf-token',
  headerName: 'x-csrf-token',
  bodyField: 'csrfToken',
  sessionField: 'sessionId',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false // Client needs to read this for AJAX requests
};

/**
 * Generate cryptographically secure CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
}

/**
 * Generate session ID
 */
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Get or create session ID from request
 */
function getSessionId(req) {
  // Try to get session ID from various sources
  let sessionId = req.headers['x-session-id'] ||
                  req.cookies?.[CSRF_CONFIG.sessionField] ||
                  req.body?.[CSRF_CONFIG.sessionField];
  
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  return sessionId;
}

/**
 * Create CSRF token for a session
 */
function createCSRFToken(sessionId) {
  const token = generateCSRFToken();
  const expiresAt = Date.now() + CSRF_CONFIG.tokenExpiry;
  
  csrfTokenStore.set(sessionId, token, expiresAt);
  
  return {
    token,
    sessionId,
    expiresAt
  };
}

/**
 * Validate CSRF token
 */
function validateCSRFToken(sessionId, providedToken) {
  if (!sessionId || !providedToken) {
    return { valid: false, error: 'Missing CSRF token or session ID' };
  }
  
  const storedToken = csrfTokenStore.get(sessionId);
  
  if (!storedToken) {
    return { valid: false, error: 'Invalid or expired CSRF token' };
  }
  
  // Use constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(providedToken))) {
    return { valid: false, error: 'CSRF token mismatch' };
  }
  
  return { valid: true };
}

/**
 * Extract CSRF token from request
 */
function extractCSRFToken(req) {
  // Try multiple sources for the token
  return req.headers[CSRF_CONFIG.headerName] ||
         req.body?.[CSRF_CONFIG.bodyField] ||
         req.query?.[CSRF_CONFIG.bodyField];
}

/**
 * CSRF protection middleware
 */
function csrfProtection(options = {}) {
  const config = { ...CSRF_CONFIG, ...options };
  
  return (req, res, next) => {
    // Skip CSRF protection for safe methods
    if (config.ignoreMethods.includes(req.method)) {
      return next();
    }
    
    // Skip for webhook endpoints (they use signature verification)
    if (req.url.includes('/webhook')) {
      return next();
    }
    
    const sessionId = getSessionId(req);
    const providedToken = extractCSRFToken(req);
    
    const validation = validateCSRFToken(sessionId, providedToken);
    
    if (!validation.valid) {
      return res.status(403).json({
        error: 'CSRF protection failed',
        message: validation.error,
        code: 'CSRF_TOKEN_INVALID'
      });
    }
    
    // Add session info to request
    req.csrfSession = {
      sessionId,
      tokenValidated: true
    };
    
    if (next) {
      next();
    }
  };
}

/**
 * Endpoint to get CSRF token
 */
function getCSRFTokenEndpoint(req, res) {
  const sessionId = getSessionId(req);
  const { token, expiresAt } = createCSRFToken(sessionId);
  
  // Set session ID cookie if not already set
  if (!req.cookies?.[CSRF_CONFIG.sessionField]) {
    res.cookie(CSRF_CONFIG.sessionField, sessionId, {
      httpOnly: true,
      secure: CSRF_CONFIG.secure,
      sameSite: CSRF_CONFIG.sameSite,
      maxAge: CSRF_CONFIG.tokenExpiry
    });
  }
  
  res.status(200).json({
    csrfToken: token,
    sessionId: sessionId,
    expiresAt: new Date(expiresAt).toISOString(),
    usage: {
      header: `${CSRF_CONFIG.headerName}: ${token}`,
      body: `{ "${CSRF_CONFIG.bodyField}": "${token}" }`,
      query: `?${CSRF_CONFIG.bodyField}=${token}`
    }
  });
}

/**
 * Double Submit Cookie pattern implementation
 */
function doubleSubmitCookieProtection(options = {}) {
  const config = { ...CSRF_CONFIG, ...options };
  
  return (req, res, next) => {
    // Skip for safe methods
    if (config.ignoreMethods.includes(req.method)) {
      return next();
    }
    
    const cookieToken = req.cookies?.[config.cookieName];
    const headerToken = req.headers[config.headerName];
    
    if (!cookieToken || !headerToken) {
      return res.status(403).json({
        error: 'CSRF protection failed',
        message: 'Missing CSRF token in cookie or header',
        code: 'CSRF_TOKEN_MISSING'
      });
    }
    
    // Verify tokens match
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      return res.status(403).json({
        error: 'CSRF protection failed',
        message: 'CSRF token mismatch',
        code: 'CSRF_TOKEN_MISMATCH'
      });
    }
    
    if (next) {
      next();
    }
  };
}

/**
 * Set CSRF token cookie
 */
function setCSRFTokenCookie(res, token) {
  res.cookie(CSRF_CONFIG.cookieName, token, {
    httpOnly: false, // Client needs to read this
    secure: CSRF_CONFIG.secure,
    sameSite: CSRF_CONFIG.sameSite,
    maxAge: CSRF_CONFIG.tokenExpiry
  });
}

/**
 * Origin validation middleware
 */
function originValidation(allowedOrigins = []) {
  return (req, res, next) => {
    const origin = req.headers.origin || req.headers.referer;
    
    if (!origin) {
      // Allow requests without origin (e.g., same-origin requests)
      return next();
    }
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (!isAllowed) {
      return res.status(403).json({
        error: 'Origin not allowed',
        message: 'Request origin is not in the allowed list',
        code: 'ORIGIN_NOT_ALLOWED'
      });
    }
    
    if (next) {
      next();
    }
  };
}

/**
 * SameSite cookie enforcement
 */
function enforceSameSite(req, res, next) {
  // Override res.cookie to enforce SameSite
  const originalCookie = res.cookie;
  
  res.cookie = function(name, value, options = {}) {
    const secureOptions = {
      ...options,
      sameSite: options.sameSite || 'strict',
      secure: options.secure !== false && process.env.NODE_ENV === 'production'
    };
    
    return originalCookie.call(this, name, value, secureOptions);
  };
  
  if (next) {
    next();
  }
}

/**
 * Get CSRF protection status
 */
function getCSRFStatus() {
  return {
    tokensActive: csrfTokenStore.tokens.size,
    config: {
      tokenLength: CSRF_CONFIG.tokenLength,
      tokenExpiry: CSRF_CONFIG.tokenExpiry,
      ignoreMethods: CSRF_CONFIG.ignoreMethods
    }
  };
}

/**
 * Clear expired tokens manually
 */
function clearExpiredTokens() {
  csrfTokenStore.cleanup();
}

/**
 * Vercel serverless function wrapper with CSRF protection
 */
function withCSRFProtection(handler, options = {}) {
  const middleware = csrfProtection(options);

  return async (req, res) => {
    return new Promise((resolve, reject) => {
      middleware(req, res, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(handler(req, res));
        }
      });
    });
  };
}

module.exports = {
  CSRF_CONFIG,
  CSRFTokenStore,
  generateCSRFToken,
  generateSessionId,
  createCSRFToken,
  validateCSRFToken,
  extractCSRFToken,
  csrfProtection,
  getCSRFTokenEndpoint,
  doubleSubmitCookieProtection,
  setCSRFTokenCookie,
  originValidation,
  enforceSameSite,
  getCSRFStatus,
  clearExpiredTokens,
  withCSRFProtection,
  csrfTokenStore
};
