export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-stripe-mode');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { 
      amount, 
      paymentMethodId,
      currency = 'usd',
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!amount || !paymentMethodId) {
      return res.status(400).json({
        error: 'Missing required fields: amount, paymentMethodId'
      });
    }

    // Validate amount
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (amountInCents < 100) { // Minimum $1.00
      return res.status(400).json({
        error: 'Amount must be at least $1.00'
      });
    }

    if (amountInCents > 1000000) { // Maximum $10,000.00
      return res.status(400).json({
        error: 'Amount must not exceed $10,000.00'
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

    console.log(`🔄 Creating secure deposit in ${mode} mode for $${amount}`, {
      mode,
      amount,
      paymentMethodId
    });

    // Generate automatic customer ID
    const customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create customer
    console.log(`🔄 Creating customer: ${customerId}`);
    const customer = await stripe.customers.create({
      metadata: {
        created_via: 'secure_deposit_api',
        mode: mode,
        created_at: new Date().toISOString()
      }
    });

    console.log(`✅ Customer created: ${customer.id}`);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    console.log(`✅ Payment method attached to customer`);

    // Create payment intent with manual capture (hold)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      capture_method: 'manual', // This creates a hold/authorization
      confirmation_method: 'manual',
      confirm: true,
      metadata: {
        created_via: 'secure_deposit_api',
        mode: mode,
        original_amount: amount,
        ...metadata
      }
    });

    console.log(`✅ Payment intent created: ${paymentIntent.id} with status: ${paymentIntent.status}`);

    return res.status(200).json({
      success: true,
      deposit: {
        id: paymentIntent.id,
        amount: amountInCents,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customerId: customer.id,
        created: new Date().toISOString(),
        metadata: paymentIntent.metadata
      },
      message: 'Secure deposit created successfully',
      mode
    });

  } catch (error) {
    console.error('❌ Error creating secure deposit:', {
      error: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      decline_code: error.decline_code,
      mode: req.headers['x-stripe-mode'] || 'test',
      stack: error.stack
    });

    // Handle specific Stripe errors with more detailed information
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Card was declined',
        details: error.message,
        code: error.code,
        decline_code: error.decline_code,
        param: error.param
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.message,
        code: error.code,
        param: error.param,
        stripe_error_type: error.type
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid Stripe API key for ' + (req.headers['x-stripe-mode'] || 'test') + ' mode',
        mode: req.headers['x-stripe-mode'] || 'test'
      });
    }

    if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: error.message
      });
    }

    if (error.type === 'StripeConnectionError') {
      return res.status(502).json({
        error: 'Connection error',
        details: 'Unable to connect to Stripe'
      });
    }

    return res.status(500).json({
      error: 'Failed to create secure deposit',
      details: error.message,
      type: error.type,
      mode: req.headers['x-stripe-mode'] || 'test'
    });
  }
}
