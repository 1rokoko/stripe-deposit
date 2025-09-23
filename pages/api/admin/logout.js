/**
 * Admin Logout API Endpoint
 * Handles admin logout and token invalidation
 */

const { requireAdminAuth, logAdminAction } = require('../../../lib/admin-auth');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Log admin logout action
    logAdminAction(req.admin.user, 'LOGOUT', {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Clear the admin token cookie
    const cookieOptions = [
      'adminToken=',
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ];

    // Add Secure flag in production
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    
    // Even if there's an error, we should still clear the cookie
    res.setHeader('Set-Cookie', [
      'adminToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict'
    ]);
    
    res.status(500).json({ 
      error: 'Logout error',
      code: 'LOGOUT_ERROR'
    });
  }
}

module.exports = requireAdminAuth(handler);
