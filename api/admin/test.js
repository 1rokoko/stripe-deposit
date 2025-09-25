// Simple test endpoint to verify admin API routing works
export default function handler(req, res) {
  console.log('🧪 Admin test endpoint called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check environment variables
  const envCheck = {
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    hasLiveKey: !!process.env.STRIPE_SECRET_KEY_LIVE,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasApiToken: !!process.env.API_AUTH_TOKEN,
    nodeEnv: process.env.NODE_ENV
  };

  console.log('🔍 Environment check:', envCheck);

  return res.status(200).json({
    success: true,
    message: 'Admin API routing works!',
    timestamp: new Date().toISOString(),
    environment: envCheck
  });
}
