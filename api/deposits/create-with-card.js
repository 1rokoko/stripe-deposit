export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { 
      amount, 
      customerId, 
      cardNumber, 
      expMonth, 
      expYear, 
      cvc,
      currency = 'usd',
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!amount || !customerId || !cardNumber || !expMonth || !expYear || !cvc) {
      return res.status(400).json({
        error: 'Missing required fields: amount, customerId, cardNumber, expMonth, expYear, cvc'
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

    console.log(`🔄 Creating deposit in ${mode} mode for $${amount}`);

    // Create payment method with card details
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardNumber.replace(/\s/g, ''),
        exp_month: parseInt(expMonth),
        exp_year: parseInt(expYear),
        cvc: cvc
      }
    });

    console.log(`✅ Payment method created: ${paymentMethod.id}`);

    // Create or retrieve customer
    let customer;
    try {
      // Try to retrieve existing customer
      customer = await stripe.customers.retrieve(customerId);
    } catch (error) {
      // Customer doesn't exist, create new one
      customer = await stripe.customers.create({
        id: customerId,
        metadata: {
          created_via: 'deposit_api',
          mode: mode
        }
      });
      console.log(`✅ Customer created: ${customer.id}`);
    }

    // Create payment intent with manual capture (hold)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customer.id,
      payment_method: paymentMethod.id,
      capture_method: 'manual', // This creates a hold/authorization
      confirmation_method: 'manual',
      confirm: true,
      metadata: {
        created_via: 'deposit_api_with_card',
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
      message: 'Deposit created successfully',
      mode
    });

  } catch (error) {
    console.error('❌ Error creating deposit:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Card was declined',
        details: error.message,
        code: error.code,
        decline_code: error.decline_code
      });
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid card information',
        details: error.message
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid Stripe API key'
      });
    }

    return res.status(500).json({
      error: 'Failed to create deposit',
      details: error.message
    });
  }
}
