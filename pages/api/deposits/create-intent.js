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
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY; // Fallback to test key for demo

    const stripeKey = mode === 'live' ? liveKey : testKey;

    console.log('🔑 Stripe key configuration:', {
      mode,
      testKeyExists: !!testKey,
      testKeyPrefix: testKey ? testKey.substring(0, 8) + '...' : 'none',
      liveKeyExists: !!liveKey,
      liveKeyPrefix: liveKey ? liveKey.substring(0, 8) + '...' : 'none',
      selectedKeyExists: !!stripeKey,
      selectedKeyPrefix: stripeKey ? stripeKey.substring(0, 8) + '...' : 'none',
      allEnvVars: Object.keys(process.env).filter(key => key.includes('STRIPE')).sort()
    });

    if (!stripeKey) {
      console.error('❌ Stripe key not found:', { mode, testKeyExists: !!testKey, liveKeyExists: !!liveKey });

      // For live mode without proper key, return error immediately
      if (mode === 'live') {
        return res.status(500).json({
          error: 'Stripe configuration error',
          message: 'Live Stripe key not configured. Please contact administrator.'
        });
      }

      // In test mode, create a mock response for demonstration
      if (mode === 'test') {
        console.log('🎭 Creating mock payment intent for demo purposes');

        const mockPaymentIntent = {
          id: `pi_mock_${Date.now()}`,
          amount: Math.round(parseFloat(amount) * 100), // Convert to cents for mock too
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
    // Amount comes in dollars/major currency unit, need to convert to cents
    const amountInCents = Math.round(parseFloat(amount) * 100);
    console.log('💰 Amount conversion:', {
      originalAmount: amount,
      parsedFloat: parseFloat(amount),
      amountInCents,
      currency: normalizedCurrency
    });
    
    // Create or get customer in Stripe
    let stripeCustomer;
    try {
      // Check if customerId looks like a real Stripe customer ID
      if (customerId.startsWith('cus_')) {
        // Try to retrieve existing customer
        stripeCustomer = await stripe.customers.retrieve(customerId);
        console.log('✅ Retrieved existing customer:', stripeCustomer.id);
      } else {
        // Create new customer in Stripe
        stripeCustomer = await stripe.customers.create({
          metadata: {
            original_id: customerId,
            created_via: 'api',
            mode
          }
        });
        console.log('✅ Created new customer:', stripeCustomer.id);
      }
    } catch (customerError) {
      console.log('🔄 Customer not found or invalid, creating new customer:', customerError.message);
      // Create new customer if retrieval fails
      stripeCustomer = await stripe.customers.create({
        metadata: {
          original_id: customerId,
          created_via: 'api',
          mode
        }
      });
      console.log('✅ Created new customer after error:', stripeCustomer.id);
    }

    // First, let's verify the payment method exists and is valid
    console.log('🔍 Verifying payment method:', paymentMethodId);
    let paymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      console.log('✅ Payment method retrieved:', {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year
        } : null
      });
    } catch (pmError) {
      console.error('❌ Payment method retrieval failed:', pmError);
      return res.status(400).json({
        error: 'Invalid payment method',
        message: `Payment method ${paymentMethodId} not found or invalid`,
        details: pmError.message
      });
    }

    // Create main deposit payment intent (manual capture for hold)
    console.log('💳 Creating deposit payment intent with manual capture...');
    const paymentIntentParams = {
      amount: amountInCents,
      currency: normalizedCurrency,
      payment_method: paymentMethodId,
      customer: stripeCustomer.id,
      capture_method: 'manual', // Manual capture for deposits (authorize first, capture later)
      confirmation_method: 'automatic', // Allow client-side confirmation with publishable key
      setup_future_usage: 'off_session', // Allow future off-session payments
      description: `Deposit hold ${amountInCents / 100} ${normalizedCurrency.toUpperCase()}`,
      metadata: {
        customerId: stripeCustomer.id,
        original_customer_id: customerId,
        created_via: 'api',
        purpose: 'deposit_hold',
        mode
      }
    };

    console.log('🔧 Deposit payment parameters:', {
      amount: paymentIntentParams.amount,
      currency: paymentIntentParams.currency,
      customer: paymentIntentParams.customer,
      capture_method: paymentIntentParams.capture_method,
      confirmation_method: paymentIntentParams.confirmation_method
    });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
    } catch (stripeError) {
      console.error('❌ Deposit payment intent creation failed:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        decline_code: stripeError.decline_code
      });

      return res.status(500).json({
        error: 'Deposit payment intent creation failed',
        message: stripeError.message,
        details: {
          type: stripeError.type,
          code: stripeError.code,
          decline_code: stripeError.decline_code
        }
      });
    }

    console.log('✅ Deposit payment intent created successfully:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      capture_method: paymentIntent.capture_method,
      client_secret: paymentIntent.client_secret ? 'present' : 'missing'
    });

    return res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        capture_method: paymentIntent.capture_method
      },
      mode: mode,
      note: 'Deposit amount will be held (not charged) until captured. This is a manual capture payment intent.'
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
