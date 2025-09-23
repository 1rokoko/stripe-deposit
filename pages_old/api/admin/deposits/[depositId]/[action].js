/**
 * Admin Deposit Actions API Endpoint
 * Handles individual deposit actions (capture, release, refund, cancel)
 */

const { requireAdminAuth, logAdminAction } = require('../../../../../lib/admin-auth');
const { createDepositRepository } = require('../../../../../src/repositories/repositoryFactory');
const { createStripeClient } = require('../../../../../src/stripe/stripeClient');
const { loadEnv } = require('../../../../../src/config');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { depositId, action } = req.query;
    const actionData = req.body || {};

    // Validate action
    const validActions = ['capture', 'release', 'refund', 'cancel'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        code: 'INVALID_ACTION',
        validActions
      });
    }

    // Initialize services
    const env = loadEnv();
    const repository = createDepositRepository({ type: 'auto' });
    const stripeClient = createStripeClient();

    // Get deposit
    const deposit = await repository.getDepositById(depositId);
    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found',
        code: 'DEPOSIT_NOT_FOUND'
      });
    }

    // Log admin action
    logAdminAction(req.admin.user, `DEPOSIT_${action.toUpperCase()}`, {
      depositId,
      depositStatus: deposit.status,
      depositAmount: deposit.amount,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      actionData
    });

    // Perform action based on type
    let result;
    switch (action) {
      case 'capture':
        result = await handleCapture(deposit, stripeClient, repository, actionData);
        break;
      case 'release':
        result = await handleRelease(deposit, stripeClient, repository, actionData);
        break;
      case 'refund':
        result = await handleRefund(deposit, stripeClient, repository, actionData);
        break;
      case 'cancel':
        result = await handleCancel(deposit, stripeClient, repository, actionData);
        break;
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    res.status(200).json({
      success: true,
      action,
      depositId,
      message: result.message,
      newStatus: result.newStatus,
      stripeResponse: result.stripeResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Admin deposit ${req.query.action} error:`, error);
    
    res.status(500).json({ 
      error: error.message || 'Action failed',
      code: 'ACTION_ERROR',
      action: req.query.action,
      depositId: req.query.depositId,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function handleCapture(deposit, stripeClient, repository, actionData) {
  // Validate deposit status
  if (deposit.status !== 'pending') {
    throw new Error(`Cannot capture deposit with status: ${deposit.status}`);
  }

  try {
    // Capture payment intent in Stripe
    const captureAmount = actionData.amount || deposit.amount;
    const stripeResponse = await stripeClient.capturePaymentIntent(
      deposit.payment_intent_id,
      {
        amount_to_capture: captureAmount
      }
    );

    // Update deposit status
    await repository.updateDepositStatus(deposit.id, 'captured', {
      captured_at: new Date().toISOString(),
      captured_amount: captureAmount,
      stripe_capture_id: stripeResponse.id
    });

    return {
      message: `Deposit captured successfully for $${(captureAmount / 100).toFixed(2)}`,
      newStatus: 'captured',
      stripeResponse: {
        id: stripeResponse.id,
        status: stripeResponse.status,
        amount_received: stripeResponse.amount_received
      }
    };

  } catch (error) {
    // Update deposit status to failed if Stripe operation fails
    await repository.updateDepositStatus(deposit.id, 'failed', {
      failed_at: new Date().toISOString(),
      failure_reason: error.message
    });

    throw new Error(`Capture failed: ${error.message}`);
  }
}

async function handleRelease(deposit, stripeClient, repository, actionData) {
  // Validate deposit status
  if (deposit.status !== 'pending') {
    throw new Error(`Cannot release deposit with status: ${deposit.status}`);
  }

  try {
    // Cancel payment intent in Stripe
    const stripeResponse = await stripeClient.cancelPaymentIntent(
      deposit.payment_intent_id,
      {
        cancellation_reason: actionData.reason || 'requested_by_customer'
      }
    );

    // Update deposit status
    await repository.updateDepositStatus(deposit.id, 'released', {
      released_at: new Date().toISOString(),
      release_reason: actionData.reason || 'admin_action',
      stripe_cancellation_id: stripeResponse.id
    });

    return {
      message: 'Deposit released successfully',
      newStatus: 'released',
      stripeResponse: {
        id: stripeResponse.id,
        status: stripeResponse.status,
        cancellation_reason: stripeResponse.cancellation_reason
      }
    };

  } catch (error) {
    throw new Error(`Release failed: ${error.message}`);
  }
}

async function handleRefund(deposit, stripeClient, repository, actionData) {
  // Validate deposit status
  if (deposit.status !== 'captured') {
    throw new Error(`Cannot refund deposit with status: ${deposit.status}`);
  }

  try {
    // Create refund in Stripe
    const refundAmount = actionData.amount || deposit.amount;
    const stripeResponse = await stripeClient.createRefund(
      deposit.payment_intent_id,
      {
        amount: refundAmount,
        reason: actionData.reason || 'requested_by_customer'
      }
    );

    // Update deposit status
    await repository.updateDepositStatus(deposit.id, 'refunded', {
      refunded_at: new Date().toISOString(),
      refunded_amount: refundAmount,
      refund_reason: actionData.reason || 'admin_action',
      stripe_refund_id: stripeResponse.id
    });

    return {
      message: `Deposit refunded successfully for $${(refundAmount / 100).toFixed(2)}`,
      newStatus: 'refunded',
      stripeResponse: {
        id: stripeResponse.id,
        status: stripeResponse.status,
        amount: stripeResponse.amount
      }
    };

  } catch (error) {
    throw new Error(`Refund failed: ${error.message}`);
  }
}

async function handleCancel(deposit, stripeClient, repository, actionData) {
  // Validate deposit status
  if (!['pending', 'failed'].includes(deposit.status)) {
    throw new Error(`Cannot cancel deposit with status: ${deposit.status}`);
  }

  try {
    let stripeResponse = null;

    // Only cancel in Stripe if still pending
    if (deposit.status === 'pending') {
      stripeResponse = await stripeClient.cancelPaymentIntent(
        deposit.payment_intent_id,
        {
          cancellation_reason: actionData.reason || 'abandoned'
        }
      );
    }

    // Update deposit status
    await repository.updateDepositStatus(deposit.id, 'canceled', {
      canceled_at: new Date().toISOString(),
      cancel_reason: actionData.reason || 'admin_action',
      stripe_cancellation_id: stripeResponse?.id
    });

    return {
      message: 'Deposit canceled successfully',
      newStatus: 'canceled',
      stripeResponse: stripeResponse ? {
        id: stripeResponse.id,
        status: stripeResponse.status,
        cancellation_reason: stripeResponse.cancellation_reason
      } : null
    };

  } catch (error) {
    throw new Error(`Cancel failed: ${error.message}`);
  }
}

module.exports = requireAdminAuth(handler);
