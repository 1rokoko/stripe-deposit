/**
 * Admin Authentication Middleware
 * Provides secure authentication for admin panel access
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Admin users configuration
const ADMIN_USERS = [
  {
    id: 'admin1',
    email: 'admin@stripe-deposit.com',
    role: 'admin',
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' // 'admin123'
  },
  {
    id: 'admin2',
    email: 'manager@stripe-deposit.com',
    role: 'manager',
    passwordHash: '866485796cfa8d7c0cf7111640205b83076433547577511d81f8030ae99ecea5' // 'manager123'
  }
];

/**
 * Hash password using SHA-256
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify admin credentials
 */
function verifyAdminCredentials(email, password) {
  const passwordHash = hashPassword(password);
  return ADMIN_USERS.find(user => 
    user.email === email && user.passwordHash === passwordHash
  );
}

/**
 * Generate admin JWT token
 */
function generateAdminToken(adminUser) {
  const payload = {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    type: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'admin-secret-key');
}

/**
 * Verify admin JWT token
 */
function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin-secret-key');
    
    // Verify user still exists and has admin role
    const adminUser = ADMIN_USERS.find(u => u.id === decoded.id && u.role === decoded.role);
    if (!adminUser) {
      throw new Error('Admin user not found');
    }
    
    return { ...decoded, user: adminUser };
  } catch (error) {
    throw new Error('Invalid admin token');
  }
}

/**
 * Middleware for API routes requiring admin authentication
 */
function requireAdminAuth(handler) {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'No admin token provided',
          code: 'ADMIN_AUTH_REQUIRED'
        });
      }
      
      const token = authHeader.substring(7);
      const decoded = verifyAdminToken(token);
      
      // Add admin info to request
      req.admin = decoded;
      
      return await handler(req, res);
    } catch (error) {
      console.error('Admin auth error:', error.message);
      return res.status(401).json({ 
        error: 'Invalid admin token',
        code: 'ADMIN_AUTH_INVALID'
      });
    }
  };
}

/**
 * Server-side authentication for admin pages
 */
async function requireAdminAuthSSR(context) {
  const { req, res } = context;
  
  // Check for admin token in cookies
  const adminToken = req.cookies?.adminToken;
  
  if (!adminToken) {
    return {
      redirect: {
        destination: '/admin/login',
        permanent: false,
      },
    };
  }
  
  try {
    const decoded = verifyAdminToken(adminToken);
    
    return {
      props: {
        admin: {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role
        }
      }
    };
  } catch (error) {
    // Clear invalid cookie
    res.setHeader('Set-Cookie', [
      'adminToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict'
    ]);
    
    return {
      redirect: {
        destination: '/admin/login',
        permanent: false,
      },
    };
  }
}

/**
 * Check if user has specific admin role
 */
function hasAdminRole(adminUser, requiredRole) {
  const roleHierarchy = {
    'admin': 3,
    'manager': 2,
    'viewer': 1
  };
  
  const userLevel = roleHierarchy[adminUser.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * Middleware for role-based access control
 */
function requireAdminRole(requiredRole) {
  return (handler) => {
    return requireAdminAuth(async (req, res) => {
      if (!hasAdminRole(req.admin.user, requiredRole)) {
        return res.status(403).json({ 
          error: 'Insufficient admin privileges',
          code: 'ADMIN_ROLE_INSUFFICIENT',
          required: requiredRole,
          current: req.admin.user.role
        });
      }
      
      return await handler(req, res);
    });
  };
}

/**
 * Log admin actions for audit trail
 */
function logAdminAction(adminUser, action, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    action,
    details,
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown'
  };
  
  // In production, this should go to a secure audit log
  console.log('ADMIN_ACTION:', JSON.stringify(logEntry));
  
  // TODO: Store in database or external audit service
  return logEntry;
}

module.exports = {
  ADMIN_USERS,
  hashPassword,
  verifyAdminCredentials,
  generateAdminToken,
  verifyAdminToken,
  requireAdminAuth,
  requireAdminAuthSSR,
  hasAdminRole,
  requireAdminRole,
  logAdminAction
};
