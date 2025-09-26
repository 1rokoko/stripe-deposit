import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paymentMethodId, currency = 'usd', mode = 'test' } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    console.log(`🔄 Verifying card with $3 charge in ${mode} mode`);

    // Create a $3 verification charge
    const verificationAmount = currency === 'jpy' ? 300 : 300; // $3 or ¥300
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: verificationAmount,
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirmation_method: 'automatic',
      confirm: true,
      description: 'Card verification charge - will be refunded',
      metadata: {
        type: 'verification',
        mode: mode,
        created_at: new Date().toISOString()
      }
    });

    console.log(`✅ Verification charge created: ${paymentIntent.id}`);

    // Immediately refund the verification charge
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      reason: 'requested_by_customer',
      metadata: {
        type: 'verification_refund',
        original_payment_intent: paymentIntent.id
      }
    });

    console.log(`✅ Verification charge refunded: ${refund.id}`);

    res.status(200).json({
      success: true,
      verification: {
        payment_intent_id: paymentIntent.id,
        refund_id: refund.id,
        amount: verificationAmount,
        currency: currency,
        status: paymentIntent.status
      },
      message: 'Card verified successfully. $3 charge has been refunded.'
    });

  } catch (error) {
    console.error('❌ Error verifying card:', {
      error: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      decline_code: error.decline_code,
      mode: req.body.mode || 'test'
    });

    res.status(400).json({
      error: error.message,
      type: error.type,
      code: error.code,
      decline_code: error.decline_code
    });
  }
}
