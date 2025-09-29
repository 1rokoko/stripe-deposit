/**
 * Create Main Deposit API
 * POST /api/deposits/create-main-deposit - Create main deposit after verification
 */

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Create main deposit request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

    const { 
      amount, 
      currency, 
      customerId, 
      paymentMethodId, 
      verificationPaymentIntentId 
    } = req.body;

    // Validate required fields
    if (!amount || !currency || !customerId || !paymentMethodId || !verificationPaymentIntentId) {
      console.error('❌ Missing required fields:', { 
        amount, currency, customerId, paymentMethodId, verificationPaymentIntentId 
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'currency', 'customerId', 'paymentMethodId', 'verificationPaymentIntentId'],
        received: { amount, currency, customerId, paymentMethodId, verificationPaymentIntentId }
      });
    }

    // Normalize currency to lowercase
    const normalizedCurrency = currency.toLowerCase();
    const amountInCents = Math.round(amount * 100);
    console.log(`💰 Processing main deposit: ${amount} ${normalizedCurrency.toUpperCase()}`);

    // Determine mode and get appropriate Stripe key
    const mode = req.headers['x-stripe-mode'] || 'test';
    const testKey = process.env.STRIPE_SECRET_KEY;
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
    const stripeKey = mode === 'live' ? liveKey : testKey;

    if (!stripeKey) {
      console.error('❌ Stripe key not found for mode:', mode);
      return res.status(500).json({ 
        error: 'Stripe configuration error',
        message: `No Stripe key found for ${mode} mode`
      });
    }

    const stripe = new Stripe(stripeKey);

    // First, verify that the verification payment intent succeeded
    console.log('🔍 Verifying verification payment intent:', verificationPaymentIntentId);
    let verificationIntent;
    try {
      verificationIntent = await stripe.paymentIntents.retrieve(verificationPaymentIntentId);
      console.log('✅ Verification intent retrieved:', {
        id: verificationIntent.id,
        status: verificationIntent.status,
        amount: verificationIntent.amount
      });

      if (verificationIntent.status !== 'succeeded') {
        console.error('❌ Verification payment not succeeded:', verificationIntent.status);
        return res.status(400).json({
          error: 'Verification payment not completed',
          message: `Verification payment status: ${verificationIntent.status}`,
          verification_status: verificationIntent.status
        });
      }
    } catch (verificationError) {
      console.error('❌ Verification payment intent retrieval failed:', verificationError);
      return res.status(400).json({
        error: 'Invalid verification payment intent',
        message: verificationError.message
      });
    }

    // Create refund for verification payment
    console.log('💰 Creating refund for verification payment...');
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: verificationPaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          purpose: 'verification_refund',
          main_deposit_amount: amountInCents,
          mode
        }
      });

      console.log('✅ Verification refund created:', {
        id: refund.id,
        amount: refund.amount,
        status: refund.status
      });
    } catch (refundError) {
      console.error('❌ Verification refund failed:', refundError.message);
      // Continue anyway - the main deposit can still work
    }

    // Get or create Stripe customer
    console.log('👤 Processing customer:', customerId);
    let stripeCustomer;
    try {
      // Try to find existing customer
      const customers = await stripe.customers.list({
        email: customerId,
        limit: 1
      });

      if (customers.data.length > 0) {
        stripeCustomer = customers.data[0];
        console.log('✅ Found existing customer:', stripeCustomer.id);
      } else {
        // Create new customer
        stripeCustomer = await stripe.customers.create({
          email: customerId,
          metadata: {
            original_customer_id: customerId,
            created_via: 'api',
            mode
          }
        });
        console.log('✅ Created new customer:', stripeCustomer.id);
      }
    } catch (customerError) {
      console.error('❌ Customer creation/retrieval failed:', customerError);
      return res.status(500).json({
        error: 'Customer processing failed',
        message: customerError.message
      });
    }

    // Create main deposit payment intent (manual capture for hold)
    console.log('💳 Creating main deposit payment intent with manual capture...');
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
        verification_payment_intent: verificationPaymentIntentId,
        verification_refund: refund ? refund.id : 'failed',
        mode
      }
    };

    console.log('🔧 Main deposit payment parameters:', {
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
      console.error('❌ Main deposit payment intent creation failed:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        decline_code: stripeError.decline_code
      });

      return res.status(500).json({
        error: 'Main deposit payment intent creation failed',
        message: stripeError.message,
        details: {
          type: stripeError.type,
          code: stripeError.code,
          decline_code: stripeError.decline_code
        },
        verification_refunded: refund ? true : false
      });
    }

    console.log('✅ Main deposit payment intent created successfully:', {
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
      verification: {
        payment_intent_id: verificationPaymentIntentId,
        refund_id: refund ? refund.id : null,
        status: 'completed_and_refunded'
      },
      mode: mode,
      note: 'Card verified and verification charge refunded. Main deposit amount will be held (not charged) until captured.'
    });

  } catch (error) {
    console.error('❌ Unexpected error in create main deposit:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
