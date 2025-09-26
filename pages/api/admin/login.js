/**
 * Admin login API endpoint
 * POST /api/admin/login - Authenticate admin user
 */

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, username, password } = req.body;

    // Support both email and username for login
    const loginField = email || username;

    // Simple admin authentication (in production, use proper password hashing)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@stripe-deposit.com';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if login matches either email or username
    const isValidUser = (loginField === adminEmail || loginField === adminUsername) && password === adminPassword;

    if (!isValidUser) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email/username or password is incorrect'
      });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'admin-secret-key';
    const token = jwt.sign(
      {
        id: 'admin',
        email: adminEmail,
        username: adminUsername,
        role: 'admin',
        type: 'jwt'
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    console.log('✅ Admin login successful');

    return res.status(200).json({
      success: true,
      token,
      admin: {
        id: 'admin',
        email: adminEmail,
        username: adminUsername,
        role: 'admin'
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
