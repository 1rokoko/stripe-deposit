// Simple environment check endpoint (no auth required)
export default function handler(req, res) {
  console.log('🔍 Environment check endpoint called');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for specific keys we need
    const envCheck = {
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_SECRET_KEY_LIVE: !!process.env.STRIPE_SECRET_KEY_LIVE,
      JWT_SECRET: !!process.env.JWT_SECRET,
      API_AUTH_TOKEN: !!process.env.API_AUTH_TOKEN,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV
    };

    // Get all Stripe-related keys
    const stripeKeys = Object.keys(process.env).filter(key => key.includes('STRIPE'));

    // Get all keys that contain 'SECRET' or 'TOKEN'
    const secretKeys = Object.keys(process.env).filter(key =>
      key.includes('SECRET') || key.includes('TOKEN') || key.includes('JWT')
    );

    // Get total environment variable count
    const totalEnvVars = Object.keys(process.env).length;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      envCheck,
      stripeKeysFound: stripeKeys,
      secretKeysFound: secretKeys,
      totalEnvVars,
      message: 'Environment variables check completed',
      deployment: {
        isVercel: !!process.env.VERCEL,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
        region: process.env.VERCEL_REGION
      }
    };

    console.log('🔍 Environment check result:', result);

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Environment check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
