/**
 * Security Headers Middleware
 * Implements comprehensive security headers for production deployment
 */

/**
 * Default security headers configuration
 */
const DEFAULT_SECURITY_CONFIG = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://uploads.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    },
    reportOnly: false
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameOptions: 'DENY',
  
  // X-Content-Type-Options
  contentTypeOptions: 'nosniff',
  
  // X-XSS-Protection
  xssProtection: '1; mode=block',
  
  // Referrer Policy
  referrerPolicy: 'strict-origin-when-cross-origin',
  
  // Permissions Policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: ['self'],
    usb: [],
    magnetometer: [],
    accelerometer: [],
    gyroscope: []
  },
  
  // Cross-Origin policies
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin'
};

/**
 * Build Content Security Policy header value
 */
function buildCSPHeader(cspConfig) {
  const directives = [];
  
  for (const [directive, sources] of Object.entries(cspConfig.directives)) {
    const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
    const sourceList = Array.isArray(sources) ? sources.join(' ') : sources;
    directives.push(`${kebabDirective} ${sourceList}`);
  }
  
  return directives.join('; ');
}

/**
 * Build Permissions Policy header value
 */
function buildPermissionsPolicyHeader(permissionsConfig) {
  const policies = [];
  
  for (const [feature, allowlist] of Object.entries(permissionsConfig)) {
    const allowlistStr = allowlist.length === 0 ? '()' : `(${allowlist.join(' ')})`;
    policies.push(`${feature}=${allowlistStr}`);
  }
  
  return policies.join(', ');
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(res, config = DEFAULT_SECURITY_CONFIG) {
  // Content Security Policy
  if (config.contentSecurityPolicy) {
    const cspHeader = buildCSPHeader(config.contentSecurityPolicy);
    const headerName = config.contentSecurityPolicy.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';
    res.setHeader(headerName, cspHeader);
  }
  
  // HTTP Strict Transport Security
  if (config.hsts) {
    let hstsValue = `max-age=${config.hsts.maxAge}`;
    if (config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }
    if (config.hsts.preload) {
      hstsValue += '; preload';
    }
    res.setHeader('Strict-Transport-Security', hstsValue);
  }
  
  // X-Frame-Options
  if (config.frameOptions) {
    res.setHeader('X-Frame-Options', config.frameOptions);
  }
  
  // X-Content-Type-Options
  if (config.contentTypeOptions) {
    res.setHeader('X-Content-Type-Options', config.contentTypeOptions);
  }
  
  // X-XSS-Protection
  if (config.xssProtection) {
    res.setHeader('X-XSS-Protection', config.xssProtection);
  }
  
  // Referrer Policy
  if (config.referrerPolicy) {
    res.setHeader('Referrer-Policy', config.referrerPolicy);
  }
  
  // Permissions Policy
  if (config.permissionsPolicy) {
    const permissionsPolicyHeader = buildPermissionsPolicyHeader(config.permissionsPolicy);
    res.setHeader('Permissions-Policy', permissionsPolicyHeader);
  }
  
  // Cross-Origin Embedder Policy
  if (config.crossOriginEmbedderPolicy) {
    res.setHeader('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
  }
  
  // Cross-Origin Opener Policy
  if (config.crossOriginOpenerPolicy) {
    res.setHeader('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
  }
  
  // Cross-Origin Resource Policy
  if (config.crossOriginResourcePolicy) {
    res.setHeader('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
  }
  
  // Additional security headers
  res.setHeader('X-Powered-By', ''); // Remove X-Powered-By header
  res.setHeader('Server', ''); // Remove Server header
  
  // Cache control for sensitive endpoints
  if (res.req && (res.req.url.includes('/api/') || res.req.url.includes('/admin'))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}

/**
 * Express middleware for security headers
 */
function securityHeadersMiddleware(customConfig = {}) {
  const config = { ...DEFAULT_SECURITY_CONFIG, ...customConfig };
  
  return (req, res, next) => {
    applySecurityHeaders(res, config);
    
    if (next) {
      next();
    }
  };
}

/**
 * Vercel serverless function wrapper
 */
function withSecurityHeaders(handler, customConfig = {}) {
  return async (req, res) => {
    const config = { ...DEFAULT_SECURITY_CONFIG, ...customConfig };
    applySecurityHeaders(res, config);
    
    return handler(req, res);
  };
}

/**
 * Development-friendly CSP configuration
 */
const DEVELOPMENT_CSP_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.stripe.com", "ws:", "wss:"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      fontSrc: ["'self'", "https:", "data:"]
    },
    reportOnly: false
  }
};

/**
 * Production-optimized CSP configuration
 */
const PRODUCTION_CSP_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://uploads.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      fontSrc: ["'self'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false
  }
};

/**
 * Get environment-appropriate security configuration
 */
function getSecurityConfig(environment = 'production') {
  const baseConfig = { ...DEFAULT_SECURITY_CONFIG };
  
  if (environment === 'development') {
    return { ...baseConfig, ...DEVELOPMENT_CSP_CONFIG };
  }
  
  return { ...baseConfig, ...PRODUCTION_CSP_CONFIG };
}

/**
 * Validate security configuration
 */
function validateSecurityConfig(config) {
  const errors = [];
  
  // Validate CSP directives
  if (config.contentSecurityPolicy && config.contentSecurityPolicy.directives) {
    const directives = config.contentSecurityPolicy.directives;
    
    // Check for unsafe directives in production
    if (process.env.NODE_ENV === 'production') {
      if (directives.scriptSrc && directives.scriptSrc.includes("'unsafe-eval'")) {
        errors.push("'unsafe-eval' should not be used in production");
      }
      
      if (directives.styleSrc && directives.styleSrc.includes("'unsafe-inline'")) {
        errors.push("'unsafe-inline' for styles should be avoided in production");
      }
    }
  }
  
  // Validate HSTS configuration
  if (config.hsts && config.hsts.maxAge < 86400) {
    errors.push('HSTS max-age should be at least 1 day (86400 seconds)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Security headers testing utility
 */
function testSecurityHeaders(headers) {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Required headers
  const requiredHeaders = [
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'strict-transport-security'
  ];
  
  for (const header of requiredHeaders) {
    if (headers[header]) {
      results.passed.push(`${header}: Present`);
    } else {
      results.failed.push(`${header}: Missing`);
    }
  }
  
  // Check for insecure values
  if (headers['x-frame-options'] && headers['x-frame-options'].toLowerCase() === 'allowall') {
    results.warnings.push('X-Frame-Options: ALLOWALL is insecure');
  }
  
  if (headers['content-security-policy'] && headers['content-security-policy'].includes("'unsafe-eval'")) {
    results.warnings.push("CSP contains 'unsafe-eval'");
  }
  
  return results;
}

module.exports = {
  DEFAULT_SECURITY_CONFIG,
  DEVELOPMENT_CSP_CONFIG,
  PRODUCTION_CSP_CONFIG,
  applySecurityHeaders,
  securityHeadersMiddleware,
  withSecurityHeaders,
  getSecurityConfig,
  validateSecurityConfig,
  testSecurityHeaders,
  buildCSPHeader,
  buildPermissionsPolicyHeader
};
