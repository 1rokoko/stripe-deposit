/**
 * Admin Login API Endpoint
 * Handles admin authentication and token generation
 */

import { verifyAdminCredentials, generateAdminToken, logAdminAction } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Verify credentials
    const adminUser = verifyAdminCredentials(email, password);
    
    if (!adminUser) {
      // Log failed login attempt
      console.warn('Failed admin login attempt:', {
        email,
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token
    const token = generateAdminToken(adminUser);

    // Log successful login
    logAdminAction(adminUser, 'LOGIN', {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Set secure HTTP-only cookie
    const cookieOptions = [
      `adminToken=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${24 * 60 * 60}` // 24 hours
    ];

    // Add Secure flag in production
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token, // For localStorage storage
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}
