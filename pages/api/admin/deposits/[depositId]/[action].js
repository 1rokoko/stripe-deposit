/**
 * Admin Deposit Actions API
 * POST /api/admin/deposits/[depositId]/[action] - Perform actions on deposits
 * Actions: capture, release, refund
 */

import { verifyAdminAuth } from '../../../../../lib/admin-api-auth';
import Stripe from 'stripe';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = verifyAdminAuth(req);
  if (!authResult.success) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Admin authentication required' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { depositId, action } = req.query;
    const { amount } = req.body;

    if (!depositId || !action) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'depositId and action are required'
      });
    }

    if (!['capture', 'release', 'refund'].includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid action',
        message: 'Action must be capture, release, or refund'
      });
    }

    console.log(`🔄 Admin ${action} action for deposit ${depositId}`);

    // Determine mode and get appropriate Stripe key
    const mode = req.headers['x-stripe-mode'] || 'test';
    const testKey = process.env.STRIPE_SECRET_KEY;
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
    const stripeKey = mode === 'live' ? liveKey : testKey;

    if (!stripeKey) {
      // Return mock success for demo purposes when no Stripe key
      console.log(`🎭 Mock ${action} action for demo purposes`);
      
      return res.status(200).json({
        success: true,
        action,
        depositId,
        amount: amount || 'full',
        mode,
        message: `Mock ${action} completed successfully`,
        note: 'This is a demo action. No real Stripe operation was performed.'
      });
    }

    const stripe = new Stripe(stripeKey);

    let result;
    switch (action) {
      case 'capture':
        const captureParams = amount ? { amount_to_capture: parseInt(amount) } : {};
        result = await stripe.paymentIntents.capture(depositId, captureParams);
        break;

      case 'release':
        result = await stripe.paymentIntents.cancel(depositId);
        break;

      case 'refund':
        // For refunds, we need to create a refund for the payment intent
        const refundParams = {
          payment_intent: depositId
        };
        if (amount) {
          refundParams.amount = parseInt(amount);
        }
        result = await stripe.refunds.create(refundParams);
        break;

      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          message: 'Unsupported action'
        });
    }

    console.log(`✅ ${action} completed successfully:`, {
      id: result.id,
      status: result.status,
      amount: result.amount
    });

    return res.status(200).json({
      success: true,
      action,
      depositId,
      result: {
        id: result.id,
        status: result.status,
        amount: result.amount,
        currency: result.currency
      },
      mode,
      message: `${action} completed successfully`
    });

  } catch (error) {
    console.error(`❌ Admin ${req.query.action} action failed:`, error);
    
    return res.status(500).json({ 
      error: `${req.query.action} action failed`,
      message: error.message,
      type: error.type || 'api_error'
    });
  }
}
