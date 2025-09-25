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
        return await handleGetDeposits(req, res);
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Admin deposits API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function handleGetDeposits(req, res) {
  try {
    // Get admin mode from session or default to test
    const mode = req.headers['x-stripe-mode'] || 'test';
    
    // Import Stripe with appropriate key
    const stripe = require('stripe')(
      mode === 'live' 
        ? process.env.STRIPE_SECRET_KEY_LIVE 
        : process.env.STRIPE_SECRET_KEY
    );

    // Fetch payment intents from Stripe
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      expand: ['data.charges']
    });

    // Transform Stripe data to our format
    const deposits = paymentIntents.data.map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      customerId: pi.customer || 'Unknown',
      created_at: new Date(pi.created * 1000).toISOString(),
      capturedAmount: pi.amount_received,
      refundedAmount: pi.charges?.data?.[0]?.amount_refunded || 0,
      metadata: pi.metadata || {}
    }));

    return res.status(200).json({
      success: true,
      deposits,
      mode,
      count: deposits.length
    });

  } catch (error) {
    console.error('Error fetching deposits from Stripe:', error);
    return res.status(500).json({
      error: 'Failed to fetch deposits',
      details: error.message
    });
  }
}
