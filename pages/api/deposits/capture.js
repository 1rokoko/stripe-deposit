/**
 * Capture Payment Intent API
 * POST /api/deposits/capture - Capture a held payment
 */

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paymentIntentId, amount } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ 
        error: 'Missing required field: paymentIntentId' 
      });
    }

    // Determine mode and get appropriate Stripe key
    const mode = req.headers['x-stripe-mode'] || 'test';
    const testKey = process.env.STRIPE_SECRET_KEY;
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
    const stripeKey = mode === 'live' ? liveKey : testKey;

    if (!stripeKey) {
      return res.status(500).json({ 
        error: 'Stripe configuration error',
        message: `Stripe ${mode} key not configured`
      });
    }

    const stripe = new Stripe(stripeKey);

    // Capture the payment intent
    const captureParams = amount ? { amount_to_capture: parseInt(amount) } : {};
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, captureParams);

    console.log('✅ Payment captured successfully:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    return res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      },
      mode
    });

  } catch (error) {
    console.error('❌ Payment capture failed:', error);
    
    return res.status(500).json({ 
      error: 'Payment capture failed',
      message: error.message
    });
  }
}
