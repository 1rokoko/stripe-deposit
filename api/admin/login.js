/**
 * Admin Login API Endpoint
 * Handles admin authentication and JWT token generation
 */

const { verifyAdminCredentials, generateAdminToken, logAdminAction } = require('../../lib/admin-auth');

export default async function handler(req, res) {
  console.log('🔐 Admin login endpoint called:', { method: req.method, url: req.url });

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse request body
    let body;
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body || {};
    }

    console.log('Login attempt:', { email: body.email, hasPassword: !!body.password });

    const { email, password } = body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Verify admin credentials
    const adminUser = verifyAdminCredentials(email, password);
    if (!adminUser) {
      console.log('❌ Invalid credentials for:', email);
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token
    const token = generateAdminToken(adminUser);

    // Log admin login
    logAdminAction(adminUser, 'LOGIN', {
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    console.log('✅ Admin login successful:', { email: adminUser.email, role: adminUser.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
