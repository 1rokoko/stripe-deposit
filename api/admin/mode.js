import { verifyAdminToken } from '../../lib/admin-auth';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = verifyAdminToken(req);
  if (!authResult.success) {
    return res.status(401).json({ error: authResult.error });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await handleGetMode(req, res);
      case 'POST':
        return await handleSetMode(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Admin mode API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function handleGetMode(req, res) {
  try {
    // Check if live keys are configured
    const hasLiveKeys = !!(process.env.STRIPE_SECRET_KEY_LIVE && process.env.STRIPE_WEBHOOK_SECRET_LIVE);
    
    // Default to test mode
    const mode = 'test';

    return res.status(200).json({
      success: true,
      mode,
      hasLiveKeys,
      testKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
      liveKeyConfigured: !!process.env.STRIPE_SECRET_KEY_LIVE
    });

  } catch (error) {
    console.error('Error getting mode:', error);
    return res.status(500).json({
      error: 'Failed to get mode',
      details: error.message
    });
  }
}

async function handleSetMode(req, res) {
  try {
    const { mode } = req.body;

    if (!mode || !['test', 'live'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode. Must be "test" or "live"'
      });
    }

    // Check if live keys are available when switching to live
    if (mode === 'live') {
      if (!process.env.STRIPE_SECRET_KEY_LIVE) {
        return res.status(400).json({
          error: 'Live mode not available. STRIPE_SECRET_KEY_LIVE not configured.'
        });
      }
    }

    // In a real implementation, you might store this in a session or database
    // For now, we'll just return success
    return res.status(200).json({
      success: true,
      mode,
      message: `Switched to ${mode} mode`
    });

  } catch (error) {
    console.error('Error setting mode:', error);
    return res.status(500).json({
      error: 'Failed to set mode',
      details: error.message
    });
  }
}
