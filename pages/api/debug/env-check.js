/**
 * Debug Environment Variables API
 * GET /api/debug/env-check - Check Stripe environment variables configuration
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Environment variables debug check');
    
    // Get all environment variables that contain 'STRIPE'
    const allEnvVars = Object.keys(process.env).filter(key => key.includes('STRIPE')).sort();
    
    const envCheck = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      allStripeVars: allEnvVars,
      stripeKeys: {
        testSecretExists: !!process.env.STRIPE_SECRET_KEY,
        testSecretPrefix: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 8) + '...' : 'none',
        liveSecretExists: !!process.env.STRIPE_SECRET_KEY_LIVE,
        liveSecretPrefix: process.env.STRIPE_SECRET_KEY_LIVE ? process.env.STRIPE_SECRET_KEY_LIVE.substring(0, 8) + '...' : 'none',
        testPublishableExists: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        testPublishablePrefix: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.substring(0, 8) + '...' : 'none',
        livePublishableExists: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE,
        livePublishablePrefix: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE.substring(0, 8) + '...' : 'none',
      }
    };

    console.log('🔑 Environment check result:', JSON.stringify(envCheck, null, 2));

    return res.status(200).json({
      success: true,
      environment: envCheck
    });

  } catch (error) {
    console.error('❌ Environment check failed:', error);
    
    return res.status(500).json({ 
      error: 'Environment check failed',
      message: error.message
    });
  }
}
