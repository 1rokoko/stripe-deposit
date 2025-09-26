/**
 * Admin mode switching API
 * POST /api/admin/mode - Switch between test and live mode
 */

import { verifyAdminAuth } from '../../../lib/admin-api-auth';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = verifyAdminAuth(req);
  if (!authResult.success) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Admin authentication required' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode } = req.body;

    if (!mode || !['test', 'live'].includes(mode)) {
      return res.status(400).json({ 
        error: 'Invalid mode',
        message: 'Mode must be either "test" or "live"'
      });
    }

    console.log(`🔄 Admin switching to ${mode} mode`);

    return res.status(200).json({
      success: true,
      mode,
      message: `Switched to ${mode} mode`
    });

  } catch (error) {
    console.error('❌ Admin mode switch error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
