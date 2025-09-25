export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { amount, customerId, paymentMethodId, currency = 'usd' } = req.body;

    // Validate required fields
    if (!amount || !customerId || !paymentMethodId) {
      return res.status(400).json({
        error: 'Missing required fields: amount, customerId, paymentMethodId'
      });
    }

    // Validate amount
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (amountInCents < 50) { // Minimum $0.50
      return res.status(400).json({
        error: 'Amount must be at least $0.50'
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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: 'manual', // This creates a hold/authorization
      confirmation_method: 'manual',
      confirm: true,
      metadata: {
        created_via: 'deposit_api',
        mode: mode
      }
    });

    return res.status(200).json({
      success: true,
      depositId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      customerId: paymentIntent.customer,
      message: 'Deposit created successfully',
      mode
    });

  } catch (error) {
    console.error('Error creating deposit:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Card error',
        details: error.message,
        code: error.code
      });
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to create deposit',
      details: error.message
    });
  }
}
