/**
 * Admin Bulk Deposit Actions API Endpoint
 * Handles bulk operations on multiple deposits
 */

import { requireAdminAuth, logAdminAction } from '../../../../lib/admin-auth';
import { createDepositRepository } from '../../../../src/repositories/repositoryFactory';
import { createStripeClient } from '../../../../src/stripe/stripeClient';
import { loadEnv } from '../../../../src/config';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { action, depositIds, options = {} } = req.body;

    // Validate input
    if (!action || !depositIds || !Array.isArray(depositIds)) {
      return res.status(400).json({
        error: 'Missing required fields: action, depositIds',
        code: 'INVALID_INPUT'
      });
    }

    // Validate action
    const validActions = ['capture', 'release', 'cancel'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid bulk action',
        code: 'INVALID_ACTION',
        validActions
      });
    }

    // Limit bulk operations
    if (depositIds.length > 100) {
      return res.status(400).json({
        error: 'Too many deposits selected. Maximum 100 allowed.',
        code: 'TOO_MANY_DEPOSITS'
      });
    }

    // Initialize services
    const env = loadEnv();
    const repository = createDepositRepository({ type: 'auto' });
    const stripeClient = createStripeClient();

    // Log admin action
    logAdminAction(req.admin.user, `BULK_${action.toUpperCase()}`, {
      depositCount: depositIds.length,
      depositIds: depositIds.slice(0, 10), // Log first 10 IDs
      options,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Get all deposits
    const deposits = await Promise.all(
      depositIds.map(id => repository.getDepositById(id))
    );

    // Filter out non-existent deposits
    const validDeposits = deposits.filter(d => d !== null);
    const notFoundIds = depositIds.filter((id, index) => deposits[index] === null);

    if (validDeposits.length === 0) {
      return res.status(404).json({
        error: 'No valid deposits found',
        code: 'NO_VALID_DEPOSITS',
        notFoundIds
      });
    }

    // Validate deposits can be processed
    const eligibleDeposits = validDeposits.filter(deposit => {
      switch (action) {
        case 'capture':
        case 'release':
          return deposit.status === 'pending';
        case 'cancel':
          return ['pending', 'failed'].includes(deposit.status);
        default:
          return false;
      }
    });

    const ineligibleDeposits = validDeposits.filter(deposit => 
      !eligibleDeposits.includes(deposit)
    );

    // Process eligible deposits
    const results = {
      successful: [],
      failed: [],
      skipped: ineligibleDeposits.map(d => ({
        id: d.id,
        reason: `Invalid status: ${d.status}`
      })),
      notFound: notFoundIds.map(id => ({ id, reason: 'Deposit not found' }))
    };

    // Process deposits in batches to avoid overwhelming Stripe API
    const batchSize = 10;
    for (let i = 0; i < eligibleDeposits.length; i += batchSize) {
      const batch = eligibleDeposits.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (deposit) => {
        try {
          const result = await processSingleDeposit(
            deposit, 
            action, 
            stripeClient, 
            repository, 
            options
          );
          
          results.successful.push({
            id: deposit.id,
            oldStatus: deposit.status,
            newStatus: result.newStatus,
            message: result.message
          });
        } catch (error) {
          console.error(`Bulk ${action} failed for deposit ${deposit.id}:`, error);
          
          results.failed.push({
            id: deposit.id,
            error: error.message,
            status: deposit.status
          });
        }
      });

      // Wait for batch to complete before processing next batch
      await Promise.all(batchPromises);
      
      // Add small delay between batches to be respectful to Stripe API
      if (i + batchSize < eligibleDeposits.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate summary
    const summary = {
      total: depositIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      notFound: results.notFound.length,
      successRate: depositIds.length > 0 ? 
        Math.round((results.successful.length / depositIds.length) * 100) : 0
    };

    res.status(200).json({
      success: true,
      action,
      summary,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk deposit action error:', error);
    
    res.status(500).json({ 
      error: 'Bulk operation failed',
      code: 'BULK_OPERATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function processSingleDeposit(deposit, action, stripeClient, repository, options) {
  switch (action) {
    case 'capture':
      return await handleBulkCapture(deposit, stripeClient, repository, options);
    case 'release':
      return await handleBulkRelease(deposit, stripeClient, repository, options);
    case 'cancel':
      return await handleBulkCancel(deposit, stripeClient, repository, options);
    default:
      throw new Error(`Unsupported bulk action: ${action}`);
  }
}

async function handleBulkCapture(deposit, stripeClient, repository, options) {
  const captureAmount = options.amount || deposit.amount;
  
  const stripeResponse = await stripeClient.capturePaymentIntent(
    deposit.payment_intent_id,
    { amount_to_capture: captureAmount }
  );

  await repository.updateDepositStatus(deposit.id, 'captured', {
    captured_at: new Date().toISOString(),
    captured_amount: captureAmount,
    stripe_capture_id: stripeResponse.id,
    bulk_operation: true
  });

  return {
    message: `Captured $${(captureAmount / 100).toFixed(2)}`,
    newStatus: 'captured'
  };
}

async function handleBulkRelease(deposit, stripeClient, repository, options) {
  const stripeResponse = await stripeClient.cancelPaymentIntent(
    deposit.payment_intent_id,
    { cancellation_reason: options.reason || 'requested_by_customer' }
  );

  await repository.updateDepositStatus(deposit.id, 'released', {
    released_at: new Date().toISOString(),
    release_reason: options.reason || 'bulk_admin_action',
    stripe_cancellation_id: stripeResponse.id,
    bulk_operation: true
  });

  return {
    message: 'Released successfully',
    newStatus: 'released'
  };
}

async function handleBulkCancel(deposit, stripeClient, repository, options) {
  let stripeResponse = null;

  // Only cancel in Stripe if still pending
  if (deposit.status === 'pending') {
    stripeResponse = await stripeClient.cancelPaymentIntent(
      deposit.payment_intent_id,
      { cancellation_reason: options.reason || 'abandoned' }
    );
  }

  await repository.updateDepositStatus(deposit.id, 'canceled', {
    canceled_at: new Date().toISOString(),
    cancel_reason: options.reason || 'bulk_admin_action',
    stripe_cancellation_id: stripeResponse?.id,
    bulk_operation: true
  });

  return {
    message: 'Canceled successfully',
    newStatus: 'canceled'
  };
}

export default requireAdminAuth(handler);
