// Debug endpoint to check environment variables
export default function handler(req, res) {
  console.log('🔍 Debug env endpoint called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get all environment variables (safely)
  const envVars = {};
  const sensitiveKeys = ['STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY_LIVE', 'JWT_SECRET', 'API_AUTH_TOKEN'];
  
  // Check for specific keys we need
  const keyCheck = {};
  sensitiveKeys.forEach(key => {
    const value = process.env[key];
    keyCheck[key] = {
      exists: !!value,
      length: value ? value.length : 0,
      prefix: value ? value.substring(0, 8) + '...' : 'NOT_FOUND'
    };
  });

  // Get all Stripe-related keys
  const stripeKeys = Object.keys(process.env).filter(key => key.includes('STRIPE'));
  
  // Get all environment variable names (not values for security)
  const allEnvKeys = Object.keys(process.env).sort();

  const result = {
    success: true,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    totalEnvVars: allEnvKeys.length,
    stripeKeysFound: stripeKeys,
    keyCheck,
    allEnvKeys: allEnvKeys.slice(0, 20), // First 20 keys only
    hasMoreKeys: allEnvKeys.length > 20
  };

  console.log('🔍 Environment debug result:', result);

  return res.status(200).json(result);
}
