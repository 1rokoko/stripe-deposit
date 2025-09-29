/**
 * Debug Stripe API Test
 * GET /api/debug/stripe-test - Test Stripe API connection and key validity
 */

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Testing Stripe API connection');
    
    const mode = req.query.mode || 'test';
    const testKey = process.env.STRIPE_SECRET_KEY;
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
    
    const stripeKey = mode === 'live' ? liveKey : testKey;
    
    console.log('🔑 Using Stripe key:', {
      mode,
      keyExists: !!stripeKey,
      keyPrefix: stripeKey ? stripeKey.substring(0, 8) + '...' : 'none'
    });

    if (!stripeKey) {
      return res.status(500).json({
        error: 'Stripe key not found',
        mode,
        testKeyExists: !!testKey,
        liveKeyExists: !!liveKey
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey);
    
    // Test 1: Try to list customers (simple API call)
    console.log('🧪 Test 1: Listing customers...');
    let customersResult;
    try {
      const customers = await stripe.customers.list({ limit: 1 });
      customersResult = {
        success: true,
        count: customers.data.length,
        hasMore: customers.has_more
      };
      console.log('✅ Customers list successful:', customersResult);
    } catch (error) {
      customersResult = {
        success: false,
        error: error.message,
        type: error.type,
        code: error.code
      };
      console.error('❌ Customers list failed:', customersResult);
    }

    // Test 2: Try to create a simple payment intent
    console.log('🧪 Test 2: Creating test payment intent...');
    let paymentIntentResult;
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 100, // $1.00
        currency: 'usd',
        metadata: {
          test: 'stripe-api-debug',
          timestamp: new Date().toISOString()
        }
      });

      paymentIntentResult = {
        success: true,
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      };
      console.log('✅ Payment intent creation successful:', paymentIntentResult);
    } catch (error) {
      paymentIntentResult = {
        success: false,
        error: error.message,
        type: error.type,
        code: error.code,
        decline_code: error.decline_code
      };
      console.error('❌ Payment intent creation failed:', paymentIntentResult);
    }

    // Test 3: If payment method ID provided, test with it
    let paymentMethodTest;
    const testPaymentMethodId = req.query.test_payment_method;
    if (testPaymentMethodId) {
      console.log('🧪 Test 3: Testing with payment method:', testPaymentMethodId);
      try {
        // First retrieve the payment method
        const paymentMethod = await stripe.paymentMethods.retrieve(testPaymentMethodId);
        console.log('✅ Payment method retrieved:', {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4
          } : null
        });

        // Create customer
        const customer = await stripe.customers.create({
          metadata: { test: 'debug-endpoint' }
        });

        // Create payment intent with payment method
        const paymentIntentWithPM = await stripe.paymentIntents.create({
          amount: 500, // $5.00
          currency: 'usd',
          payment_method: testPaymentMethodId,
          customer: customer.id,
          capture_method: 'automatic',
          confirmation_method: 'automatic',
          metadata: {
            test: 'stripe-api-debug-with-pm',
            timestamp: new Date().toISOString()
          }
        });

        paymentMethodTest = {
          success: true,
          paymentMethod: {
            id: paymentMethod.id,
            type: paymentMethod.type,
            card: paymentMethod.card
          },
          customer: customer.id,
          paymentIntent: {
            id: paymentIntentWithPM.id,
            status: paymentIntentWithPM.status,
            amount: paymentIntentWithPM.amount,
            currency: paymentIntentWithPM.currency
          }
        };
        console.log('✅ Payment intent with payment method successful:', paymentMethodTest);
      } catch (error) {
        paymentMethodTest = {
          success: false,
          error: error.message,
          type: error.type,
          code: error.code,
          decline_code: error.decline_code,
          param: error.param
        };
        console.error('❌ Payment intent with payment method failed:', paymentMethodTest);
      }
    }

    const result = {
      timestamp: new Date().toISOString(),
      mode,
      stripeKey: {
        exists: !!stripeKey,
        prefix: stripeKey ? stripeKey.substring(0, 8) + '...' : 'none'
      },
      tests: {
        customers: customersResult,
        paymentIntent: paymentIntentResult,
        paymentMethodTest: paymentMethodTest || null
      }
    };

    console.log('🔍 Stripe API test complete:', JSON.stringify(result, null, 2));

    return res.status(200).json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ Stripe API test failed:', error);
    
    return res.status(500).json({ 
      error: 'Stripe API test failed',
      message: error.message,
      type: error.type || 'unknown'
    });
  }
}
