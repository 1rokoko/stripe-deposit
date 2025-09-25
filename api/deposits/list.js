export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Get mode from headers or default to test
    const mode = req.headers['x-stripe-mode'] || 'test';
    
    console.log(`🔄 Fetching deposits from ${mode} mode...`);

    if (mode === 'test') {
      // For test mode, use demo API
      try {
        const demoResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/demo/deposits`);
        if (demoResponse.ok) {
          const demoData = await demoResponse.json();
          console.log(`✅ Successfully fetched ${demoData.deposits?.length || 0} deposits from demo API`);
          return res.status(200).json(demoData);
        } else {
          console.log('⚠️ Demo API not available, returning empty list');
          return res.status(200).json({ deposits: [] });
        }
      } catch (error) {
        console.log('⚠️ Demo API error, returning empty list:', error.message);
        return res.status(200).json({ deposits: [] });
      }
    }

    // For live mode, use Stripe API
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);

    // Get payment intents (deposits) from Stripe
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      expand: ['data.customer']
    });

    // Transform Stripe payment intents to our deposit format
    const deposits = paymentIntents.data.map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      customerId: pi.customer?.id || 'Unknown',
      created: new Date(pi.created * 1000).toISOString(),
      metadata: pi.metadata || {}
    }));

    console.log(`✅ Successfully fetched ${deposits.length} deposits from live mode`);

    return res.status(200).json({
      deposits,
      mode: 'live',
      total: deposits.length
    });

  } catch (error) {
    console.error('❌ Error fetching deposits:', error);
    
    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid Stripe API key'
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch deposits',
      details: error.message
    });
  }
}
