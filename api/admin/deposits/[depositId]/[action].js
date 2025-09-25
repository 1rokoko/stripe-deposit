import { verifyAdminAuth } from '../../../../lib/admin-api-auth';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = verifyAdminAuth(req);
  if (!authResult.success) {
    return res.status(401).json({ error: authResult.error });
  }

  const { method, query } = req;
  const { depositId, action } = query;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  try {
    return await handleDepositAction(req, res, depositId, action);
  } catch (error) {
    console.error('Admin deposit action error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function handleDepositAction(req, res, depositId, action) {
  try {
    // Get admin mode from session or default to test
    const mode = req.headers['x-stripe-mode'] || 'test';
    const { amount } = req.body;

    console.log(`🔄 Admin action: ${action} on ${depositId} in ${mode} mode`);

    if (mode === 'test') {
      // In test mode, use demo API for actions
      try {
        const demoResponse = await fetch(`https://stripe-deposit.vercel.app/api/demo/deposits/${depositId}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ amount: amount ? Math.round(amount * 100) : undefined })
        });

        if (demoResponse.ok) {
          const result = await demoResponse.json();
          console.log(`✅ Demo action successful: ${action} on ${depositId}`);
          return res.status(200).json(result);
        } else {
          const errorData = await demoResponse.json();
          console.error(`❌ Demo action failed: ${action} on ${depositId}:`, errorData);
          return res.status(demoResponse.status).json(errorData);
        }
      } catch (demoError) {
        console.error(`❌ Demo API error for ${action} on ${depositId}:`, demoError);
        return res.status(500).json({
          error: `Failed to ${action} demo deposit`,
          details: demoError.message
        });
      }
    }

    // For live mode, use Stripe API
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);

    switch (action) {
      case 'capture':
        // Convert amount from dollars to cents if needed
        const captureAmountInCents = amount ? Math.round(amount * 100) : undefined;
        const captureResult = await stripe.paymentIntents.capture(depositId, {
          amount_to_capture: captureAmountInCents
        });
        
        return res.status(200).json({
          success: true,
          action: 'capture',
          depositId,
          message: `Payment intent captured successfully`,
          capturedAmount: captureResult.amount_received,
          status: captureResult.status
        });

      case 'cancel':
      case 'release':
        const cancelResult = await stripe.paymentIntents.cancel(depositId);
        
        return res.status(200).json({
          success: true,
          action: 'cancel',
          depositId,
          message: `Payment intent cancelled successfully`,
          status: cancelResult.status
        });

      case 'refund':
        // First get the payment intent to find the charge
        const paymentIntent = await stripe.paymentIntents.retrieve(depositId, {
          expand: ['charges']
        });

        let refundResult;

        // Convert amount from dollars to cents if needed
        const refundAmountInCents = amount ? Math.round(amount * 100) : undefined;

        if (paymentIntent.charges?.data?.[0]) {
          // Method 1: Refund via Charge (preferred for newer payment intents)
          const charge = paymentIntent.charges.data[0];
          refundResult = await stripe.refunds.create({
            charge: charge.id,
            amount: refundAmountInCents
          });
        } else {
          // Method 2: Refund via Payment Intent (for older payment intents without charges)
          refundResult = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
            amount: refundAmountInCents
          });
        }

        return res.status(200).json({
          success: true,
          action: 'refund',
          depositId,
          message: `Refund processed successfully`,
          refundedAmount: refundResult.amount,
          refundId: refundResult.id,
          status: refundResult.status
        });

      default:
        return res.status(400).json({
          error: 'Invalid action',
          availableActions: ['capture', 'cancel', 'release', 'refund']
        });
    }

  } catch (error) {
    console.error(`Error performing ${action} on deposit ${depositId}:`, error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Card error',
        details: error.message
      });
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.message
      });
    }

    return res.status(500).json({
      error: `Failed to ${action} deposit`,
      details: error.message
    });
  }
}
