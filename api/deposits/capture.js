export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-stripe-mode, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { paymentIntentId, action } = req.body;

    // Validate required fields
    if (!paymentIntentId || !action) {
      return res.status(400).json({
        error: 'Missing required fields: paymentIntentId, action'
      });
    }

    // Validate action
    if (!['capture', 'cancel'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Must be "capture" or "cancel"'
      });
    }

    // Get mode from headers or default to test
    const mode = req.headers['x-stripe-mode'] || 'test';
    
    // Import Stripe with appropriate key
    const stripe = require('stripe')(
      mode === 'live' 
        ? process.env.STRIPE_SECRET_KEY_LIVE 
        : process.env.STRIPE_SECRET_KEY
    );

    console.log(`🔄 ${action === 'capture' ? 'Capturing' : 'Canceling'} payment intent ${paymentIntentId} in ${mode} mode`);

    let result;
    if (action === 'capture') {
      // Capture the payment (charge the card)
      result = await stripe.paymentIntents.capture(paymentIntentId);
      console.log(`✅ Payment intent captured: ${result.id} with status: ${result.status}`);
    } else {
      // Cancel the payment (release the hold)
      result = await stripe.paymentIntents.cancel(paymentIntentId);
      console.log(`✅ Payment intent canceled: ${result.id} with status: ${result.status}`);
    }

    return res.status(200).json({
      success: true,
      paymentIntent: {
        id: result.id,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
        captured: result.status === 'succeeded',
        canceled: result.status === 'canceled',
        updated: new Date().toISOString()
      },
      message: `Payment intent ${action === 'capture' ? 'captured' : 'canceled'} successfully`,
      mode
    });

  } catch (error) {
    console.error(`❌ Error ${req.body.action || 'processing'} payment intent:`, {
      error: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      mode: req.headers['x-stripe-mode'] || 'test',
      stack: error.stack
    });

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.message,
        code: error.code,
        param: error.param
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid Stripe API key for ' + (req.headers['x-stripe-mode'] || 'test') + ' mode',
        mode: req.headers['x-stripe-mode'] || 'test'
      });
    }

    return res.status(500).json({
      error: `Failed to ${req.body.action || 'process'} payment intent`,
      details: error.message,
      type: error.type,
      mode: req.headers['x-stripe-mode'] || 'test'
    });
  }
}
