import { verifyAdminAuth } from '../../lib/admin-api-auth';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = verifyAdminAuth(req);
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

    console.log(`🔄 Fetching deposits from ${mode} mode...`, new Date().toISOString());

    if (mode === 'test') {
      // In test mode, fetch from demo API to show demo deposits
      try {
        // Use relative URL to avoid domain issues
        const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'https://stripe-deposit.vercel.app';
        const demoResponse = await fetch(`${baseUrl}/api/demo/deposits`);
        if (demoResponse.ok) {
          const demoData = await demoResponse.json();
          const demoDeposits = demoData.deposits || [];

          // Convert demo deposits to admin format
          const formattedDeposits = demoDeposits.map(deposit => ({
            id: deposit.id,
            customer: deposit.customerId || 'Unknown',
            amount: deposit.amount, // Already in cents
            currency: deposit.currency || 'usd',
            status: deposit.status,
            created: new Date(deposit.createdAt).getTime() / 1000,
            metadata: deposit.metadata || {},
            // Add fields for refund functionality
            capturedAmount: deposit.status === 'captured' ? deposit.amount : 0,
            refundedAmount: deposit.refundedAmount || 0
          }));

          console.log(`✅ Successfully fetched ${formattedDeposits.length} deposits from test mode at ${new Date().toISOString()}`);

          return res.status(200).json({
            deposits: formattedDeposits,
            total: formattedDeposits.length,
            mode: 'test'
          });
        } else {
          console.warn('⚠️ Failed to fetch from demo API, falling back to empty list');
          return res.status(200).json({
            deposits: [],
            total: 0,
            mode: 'test'
          });
        }
      } catch (demoError) {
        console.warn('⚠️ Failed to fetch from demo API:', demoError.message);
        return res.status(200).json({
          deposits: [],
          total: 0,
          mode: 'test'
        });
      }
    }

    // For live mode, use Stripe API
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);

    // Fetch payment intents from Stripe
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      expand: ['data.charges']
    });

    // Map Stripe statuses to our internal statuses
    const mapStripeStatus = (stripeStatus, amountRefunded, amountReceived) => {
      if (amountRefunded > 0) {
        return amountRefunded >= amountReceived ? 'refunded' : 'partially_refunded';
      }

      switch (stripeStatus) {
        case 'succeeded':
          return 'captured';
        case 'requires_capture':
          return 'pending';
        case 'canceled':
          return 'released';
        case 'requires_payment_method':
          return 'failed';
        default:
          return stripeStatus;
      }
    };

    // Transform Stripe data to our format
    const deposits = paymentIntents.data.map(pi => {
      const amountRefunded = pi.charges?.data?.[0]?.amount_refunded || 0;
      const amountReceived = pi.amount_received || 0;

      return {
        id: pi.id,
        customer: pi.customer || 'Unknown',
        amount: pi.amount,
        currency: pi.currency,
        status: mapStripeStatus(pi.status, amountRefunded, amountReceived),
        created: new Date(pi.created * 1000).toISOString(),
        capturedAmount: amountReceived,
        refundedAmount: amountRefunded,
        metadata: pi.metadata || {}
      };
    });

    console.log(`✅ Successfully fetched ${deposits.length} deposits from live mode at ${new Date().toISOString()}`);

    return res.status(200).json({
      deposits,
      total: deposits.length,
      mode: 'live'
    });

  } catch (error) {
    console.error('Error fetching deposits from Stripe:', error);
    return res.status(500).json({
      error: 'Failed to fetch deposits',
      details: error.message
    });
  }
}
