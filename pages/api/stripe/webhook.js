/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook - Handle Stripe webhook events
 */

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.log('⚠️ Webhook secret not configured, processing without verification');
      return res.status(200).json({ received: true });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log('📨 Webhook event received:', event.type);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('✅ Payment succeeded:', event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
        console.log('❌ Payment failed:', event.data.object.id);
        break;
      case 'payment_intent.requires_action':
        console.log('🔄 Payment requires action:', event.data.object.id);
        break;
      default:
        console.log('📝 Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return res.status(500).json({ 
      error: 'Webhook handler error',
      message: error.message 
    });
  }
}

// Disable body parsing for webhooks
export const config = {
  api: {
    bodyParser: false,
  },
}
