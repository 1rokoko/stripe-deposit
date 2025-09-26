/**
 * Admin API Authentication Helper
 * Provides authentication for admin API endpoints
 */

import jwt from 'jsonwebtoken';

/**
 * Verify JWT token for admin authentication
 */
function verifyJWTToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin-secret-key');

    // Basic validation
    if (!decoded.id || !decoded.role || decoded.role !== 'admin') {
      throw new Error('Invalid token payload');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid admin token');
  }
}

/**
 * Verify admin authentication from request
 * Supports both API token and JWT token authentication
 */
export function verifyAdminAuth(req) {
  try {
    // Check for API token in headers (for admin API calls)
    const apiToken = req.headers['x-api-token'] || req.headers['authorization']?.replace('Bearer ', '');
    
    // Use API_AUTH_TOKEN for simple API authentication
    if (apiToken && apiToken === process.env.API_AUTH_TOKEN) {
      return { success: true, admin: { id: 'api', role: 'admin', type: 'api' } };
    }

    // Check for JWT token in authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Skip API token check if it's already been checked
      if (token === process.env.API_AUTH_TOKEN) {
        return { success: true, admin: { id: 'api', role: 'admin', type: 'api' } };
      }
      
      // Try JWT verification
      const decoded = verifyJWTToken(token);
      return { success: true, admin: { ...decoded, type: 'jwt' } };
    }

    return { success: false, error: 'Admin authentication required' };
  } catch (error) {
    console.error('Admin auth error:', error);
    return { success: false, error: 'Invalid admin token' };
  }
}

/**
 * Middleware wrapper for admin API endpoints
 */
export function withAdminAuth(handler) {
  return async (req, res) => {
    const authResult = verifyAdminAuth(req);
    if (!authResult.success) {
      return res.status(401).json({ error: authResult.error });
    }
    
    // Add admin info to request
    req.admin = authResult.admin;
    
    return await handler(req, res);
  };
}
