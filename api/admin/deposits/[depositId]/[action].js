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
    
    // Import Stripe with appropriate key
    const stripe = require('stripe')(
      mode === 'live' 
        ? process.env.STRIPE_SECRET_KEY_LIVE 
        : process.env.STRIPE_SECRET_KEY
    );

    const { amount } = req.body;

    switch (action) {
      case 'capture':
        const captureResult = await stripe.paymentIntents.capture(depositId, {
          amount_to_capture: amount
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

        if (!paymentIntent.charges?.data?.[0]) {
          return res.status(400).json({
            error: 'No charge found for this payment intent'
          });
        }

        const charge = paymentIntent.charges.data[0];
        
        const refundResult = await stripe.refunds.create({
          charge: charge.id,
          amount: amount
        });

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
