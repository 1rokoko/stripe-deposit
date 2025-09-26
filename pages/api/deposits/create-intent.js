/**
 * Create Payment Intent API
 * POST /api/deposits/create-intent - Create a new payment intent for deposit
 */

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Create payment intent request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Request headers:', JSON.stringify(req.headers, null, 2));

    const { amount, currency, customerId, paymentMethodId } = req.body;

    // Validate required fields
    if (!amount || !currency || !customerId || !paymentMethodId) {
      console.error('❌ Missing required fields:', { amount, currency, customerId, paymentMethodId });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'currency', 'customerId', 'paymentMethodId'],
        received: { amount, currency, customerId, paymentMethodId }
      });
    }

    // Normalize currency to lowercase
    const normalizedCurrency = currency.toLowerCase();
    console.log(`💰 Processing payment: ${amount} ${normalizedCurrency.toUpperCase()}`);

    // Determine mode and get appropriate Stripe key
    const mode = req.headers['x-stripe-mode'] || 'test';
    const testKey = process.env.STRIPE_SECRET_KEY;
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
    
    const stripeKey = mode === 'live' ? liveKey : testKey;
    
    console.log('🔑 Stripe key configuration:', {
      mode,
      testKeyExists: !!testKey,
      liveKeyExists: !!liveKey,
      selectedKeyExists: !!stripeKey
    });

    if (!stripeKey) {
      console.error('❌ Stripe key not found:', { mode, testKeyExists: !!testKey, liveKeyExists: !!liveKey });
      
      // In test mode, create a mock response for demonstration
      if (mode === 'test') {
        console.log('🎭 Creating mock payment intent for demo purposes');
        
        const mockPaymentIntent = {
          id: `pi_mock_${Date.now()}`,
          amount: parseInt(amount),
          currency: normalizedCurrency,
          status: 'requires_capture',
          client_secret: `pi_mock_${Date.now()}_secret_mock`,
          created: Math.floor(Date.now() / 1000),
          metadata: {
            customerId,
            created_via: 'mock_demo',
            mode: 'test'
          }
        };
        
        return res.status(200).json({
          success: true,
          paymentIntent: mockPaymentIntent,
          mode: 'test',
          note: 'This is a mock payment intent for demonstration purposes. No real charge was created.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Stripe configuration error',
        message: `Stripe ${mode} key not configured`
      });
    }

    // Initialize Stripe with the appropriate key
    const stripe = new Stripe(stripeKey);
    console.log(`✅ Stripe initialized in ${mode} mode`);

    // Convert amount to cents (Stripe expects amounts in smallest currency unit)
    const amountInCents = parseInt(amount);
    
    // Create payment intent
    const paymentIntentParams = {
      amount: amountInCents,
      currency: normalizedCurrency,
      payment_method: paymentMethodId,
      customer: customerId,
      capture_method: 'manual', // Hold the payment for later capture
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${req.headers.origin || 'https://stripe-deposit.vercel.app'}/deposit-status`,
      metadata: {
        customerId,
        created_via: 'api',
        mode
      }
    };

    console.log('🚀 Creating payment intent with params:', JSON.stringify(paymentIntentParams, null, 2));

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
    
    console.log('✅ Payment intent created successfully:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });

    return res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        metadata: paymentIntent.metadata
      },
      mode
    });

  } catch (error) {
    console.error('❌ Payment intent creation failed:', error);
    
    return res.status(500).json({ 
      error: 'Payment intent creation failed',
      message: error.message,
      type: error.type || 'api_error'
    });
  }
}
