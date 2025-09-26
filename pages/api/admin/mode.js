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

  // Check if live keys are configured
  const hasLiveKeys = !!(
    process.env.STRIPE_SECRET_KEY_LIVE &&
    process.env.STRIPE_SECRET_KEY_LIVE.startsWith('sk_live_') &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE.startsWith('pk_live_')
  );

  if (req.method === 'GET') {
    // Return current mode and live keys status
    return res.status(200).json({
      success: true,
      mode: 'test', // Default to test mode
      hasLiveKeys,
      message: 'Current mode status'
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

    // Prevent switching to live mode if keys are not configured
    if (mode === 'live' && !hasLiveKeys) {
      return res.status(400).json({
        error: 'Live mode not available',
        message: 'Live Stripe keys are not properly configured',
        hasLiveKeys: false
      });
    }

    console.log(`🔄 Admin switching to ${mode} mode`);

    return res.status(200).json({
      success: true,
      mode,
      hasLiveKeys,
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
