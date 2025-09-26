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
    const { username, password } = req.body;

    // Simple admin authentication (in production, use proper password hashing)
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { 
        id: 'admin',
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
