// Demo endpoint with shared repository - FINAL TESTING VERSION
const { createDepositRepository } = require('../src/repositories/repositoryFactory');

// Shared storage for cross-API persistence
global.CROSS_API_DEPOSITS = global.CROSS_API_DEPOSITS || new Map();

// Repository factory function for serverless environment
function createRepositoryForRequest() {
  try {
    console.log('Demo API: Creating repository...');
    console.log('Demo API: Environment - VERCEL:', !!process.env.VERCEL, 'NODE_ENV:', process.env.NODE_ENV);
    console.log('Demo API: DATABASE_URL:', process.env.DATABASE_URL ? 'present' : 'missing');

    const repository = createDepositRepository({
      type: 'file', // Use simple file-based persistence for Vercel
      filePath: '/tmp/stripe-deposits.json' // Shared JSON file
    });
    console.log('Demo API: ✅ Created repository instance:', repository.constructor.name);
    return repository;
  } catch (error) {
    console.error('Demo API: ❌ Failed to create repository:', error.message);
    console.error('Demo API: Falling back to MemoryDepositRepository');
    // Fallback to inline memory repository
    const { MemoryDepositRepository } = require('../src/repositories/memoryDepositRepository');
    return new MemoryDepositRepository();
  }
}

export default async function handler(req, res) {
  const { method, url } = req;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Handle both /api/demo and /demo paths
    let pathname = url;
    if (pathname.startsWith('/api/demo')) {
      pathname = pathname.replace('/api/demo', '/demo');
    }
    if (pathname === '' || pathname === '/') {
      pathname = '/demo';
    }

    // Demo API endpoints
    if (pathname === '/demo' || pathname === '/') {
      return res.status(200).json({
        message: 'Stripe Deposit API Demo',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          'GET /demo': 'This demo page',
          'GET /demo/health': 'Health check',
          'GET /demo/deposits': 'List demo deposits',
          'POST /demo/deposits/hold/100': 'Create $100 deposit hold (demo)',
          'POST /demo/deposits/hold/200': 'Create $200 deposit hold (demo)',
          'GET /demo/deposits/{id}': 'Get deposit details',
          'POST /demo/deposits/{id}/capture': 'Capture deposit',
          'POST /demo/deposits/{id}/release': 'Release deposit',
          'POST /demo/deposits/{id}/refund': 'Refund captured deposit',
        },
        note: 'This is a demo version. Real Stripe integration requires proper API keys.'
      });
    }

    if (pathname === '/demo/health') {
      // Test repository creation for diagnostics
      const repository = createRepositoryForRequest();
      const repositoryType = repository.constructor.name;

      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'stripe-deposit-demo',
        version: '1.0.0',
        environment: 'vercel-serverless',
        repository: {
          type: repositoryType,
          databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing'
        }
      });
    }

    if (pathname === '/demo/deposits') {
      // Get deposits from shared repository
      const repository = createRepositoryForRequest();
      const deposits = await repository.list();

      // Convert to demo format for compatibility
      const demoDeposits = deposits.map(deposit => ({
        id: deposit.id,
        customerId: deposit.customerId,
        amount: deposit.holdAmount, // Already in cents
        currency: deposit.currency,
        status: deposit.status,
        paymentIntentId: deposit.verificationPaymentIntentId || deposit.activePaymentIntentId,
        createdAt: deposit.createdAt,
        metadata: { demo: true, ...deposit.metadata }
      }));

      return res.status(200).json({
        deposits: demoDeposits,
        total: demoDeposits.length,
        timestamp: new Date().toISOString()
      });
    }

    // Create demo deposit hold
    const holdMatch = pathname.match(/^\/demo\/deposits\/hold\/(\d+)$/);
    if (holdMatch && method === 'POST') {
      const amount = parseInt(holdMatch[1]);

      // Allow any amount for demo, not just 100/200
      if (amount <= 0 || amount > 10000) {
        return res.status(400).json({
          error: 'Invalid hold amount. Must be between $1 and $10,000.',
          demo: true
        });
      }

      const repository = createRepositoryForRequest();
      const now = new Date();
      const depositId = `dep_demo_${Date.now()}`;

      // Create deposit object in repository format
      const deposit = {
        id: depositId,
        customerId: req.body?.customerId || 'cus_demo_customer',
        paymentMethodId: `pm_demo_${Date.now()}`,
        currency: 'usd',
        holdAmount: amount * 100, // Convert to cents
        status: 'pending', // Changed to pending so capture/release buttons appear
        verificationPaymentIntentId: `pi_verify_demo_${Date.now()}`,
        activePaymentIntentId: `pi_demo_${Date.now()}`,
        createdAt: now.toISOString(),
        initialAuthorizationAt: now.toISOString(),
        lastAuthorizationAt: now.toISOString(),
        captureHistory: [],
        authorizationHistory: [],
        metadata: {
          demo: true,
          ...req.body?.metadata
        }
      };

      // Save to repository
      await repository.save(deposit);

      // Also save to shared global storage for cross-API access
      global.CROSS_API_DEPOSITS.set(deposit.id, deposit);
      console.log('💾 Saved deposit to shared storage:', deposit.id);

      return res.status(200).json({
        success: true,
        deposit: {
          id: deposit.id,
          customerId: deposit.customerId,
          amount: deposit.holdAmount, // Return in cents for compatibility
          currency: deposit.currency,
          status: deposit.status,
          paymentIntentId: deposit.activePaymentIntentId,
          createdAt: deposit.createdAt,
          metadata: deposit.metadata
        },
        message: `Demo $${amount} deposit hold created successfully`,
        note: 'This is a demo. No real payment was processed.'
      });
    }

    // Get demo deposit by ID
    const depositMatch = pathname.match(/^\/demo\/deposits\/([^\/]+)$/);
    if (depositMatch && method === 'GET') {
      const depositId = depositMatch[1];
      
      const demoDeposit = {
        id: depositId,
        customerId: 'cus_demo_customer',
        amount: 10000,
        currency: 'usd',
        status: 'authorized',
        paymentIntentId: `pi_demo_${depositId}`,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        metadata: { demo: true }
      };

      return res.status(200).json({
        deposit: demoDeposit,
        note: 'This is demo data'
      });
    }

    // Demo deposit actions - now with real repository updates
    const actionMatch = pathname.match(/^\/demo\/deposits\/([^\/]+)\/(.+)$/);
    if (actionMatch && method === 'POST') {
      const depositId = actionMatch[1];
      const action = actionMatch[2];
      const repository = createRepositoryForRequest();

      try {
        // Find the deposit in repository
        console.log(`🔍 Looking for deposit ${depositId} in repository...`);
        const deposit = await repository.findById(depositId);
        console.log(`📋 Found deposit:`, deposit ? 'YES' : 'NO');

        if (!deposit) {
          // Try to find in shared storage as fallback
          const sharedDeposit = global.CROSS_API_DEPOSITS?.get(depositId);
          console.log(`📋 Found in shared storage:`, sharedDeposit ? 'YES' : 'NO');

          if (sharedDeposit) {
            // Save to repository for future access
            await repository.save(sharedDeposit);
            console.log(`💾 Saved shared deposit to repository`);
            return await handleDepositAction(sharedDeposit, action, req, res, repository, depositId);
          }

          return res.status(404).json({
            error: 'Deposit not found',
            depositId,
            debug: {
              repositoryType: repository.constructor.name,
              sharedStorageSize: global.CROSS_API_DEPOSITS?.size || 0
            }
          });
        }

        return await handleDepositAction(deposit, action, req, res, repository, depositId);
      } catch (error) {
        console.error(`❌ Error in deposit action ${action}:`, error);
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          action,
          depositId
        });
      }
    }

    // Helper function to handle deposit actions
    async function handleDepositAction(deposit, action, req, res, repository, depositId) {
      try {

        const now = new Date();
        let updatedDeposit;

        switch (action) {
          case 'capture':
            if (deposit.status !== 'pending') {
              return res.status(400).json({
                error: 'Deposit must be in pending status to capture',
                currentStatus: deposit.status
              });
            }

            // Ensure capturedAmount is properly set (amount comes in cents from admin API)
            const captureAmount = req.body?.amount || deposit.holdAmount;
            console.log(`🔍 Demo capture: requested=${req.body?.amount}, holdAmount=${deposit.holdAmount}, using=${captureAmount}`);

            updatedDeposit = await repository.update(depositId, (current) => ({
              ...current,
              status: 'captured',
              capturedAmount: captureAmount,
              capturedAt: now.toISOString()
            }));

            return res.status(200).json({
              success: true,
              action: 'capture',
              depositId,
              message: 'Demo deposit captured successfully',
              capturedAmount: updatedDeposit.capturedAmount,
              timestamp: now.toISOString(),
              note: 'This is a demo. No real payment was processed.'
            });

          case 'release':
            if (deposit.status !== 'pending') {
              return res.status(400).json({
                error: 'Deposit must be in pending status to release',
                currentStatus: deposit.status
              });
            }

            updatedDeposit = await repository.update(depositId, (current) => ({
              ...current,
              status: 'released',
              releasedAt: now.toISOString()
            }));

            return res.status(200).json({
              success: true,
              action: 'release',
              depositId,
              message: 'Demo deposit released successfully',
              timestamp: now.toISOString(),
              note: 'This is a demo. No real payment was processed.'
            });

          case 'refund':
            if (deposit.status !== 'captured' && deposit.status !== 'partially_refunded') {
              return res.status(400).json({
                error: 'Deposit must be captured or partially refunded to refund',
                currentStatus: deposit.status
              });
            }

            // Amount comes in cents from admin API (already converted)
            const refundAmount = req.body?.amount || 0;
            const maxRefundAmount = deposit.capturedAmount || deposit.holdAmount;
            const alreadyRefunded = deposit.refundedAmount || 0;
            const availableForRefund = maxRefundAmount - alreadyRefunded;

            console.log(`🔍 Demo refund: requestedCents=${refundAmount}, maxRefund=${maxRefundAmount}, alreadyRefunded=${alreadyRefunded}, available=${availableForRefund}`);
            console.log(`🔍 Demo refund validation: ${refundAmount} > ${availableForRefund} = ${refundAmount > availableForRefund}`);

            if (!refundAmount || refundAmount <= 0) {
              return res.status(400).json({
                error: 'Refund amount must be specified and greater than 0',
                availableForRefund: availableForRefund / 100
              });
            }

            if (refundAmount > availableForRefund) {
              return res.status(400).json({
                error: 'Refund amount cannot exceed available amount',
                maxRefundAmount: maxRefundAmount / 100,
                alreadyRefunded: alreadyRefunded / 100,
                availableForRefund: availableForRefund / 100,
                requestedAmount: refundAmount / 100
              });
            }

            updatedDeposit = await repository.update(depositId, (current) => ({
              ...current,
              status: refundAmount >= maxRefundAmount ? 'refunded' : 'partially_refunded',
              refundedAmount: (current.refundedAmount || 0) + refundAmount,
              refundedAt: now.toISOString(),
              refundHistory: [
                ...(current.refundHistory || []),
                {
                  amount: refundAmount,
                  refundedAt: now.toISOString(),
                  refundId: `re_demo_${Date.now()}`
                }
              ]
            }));

            return res.status(200).json({
              success: true,
              action: 'refund',
              depositId,
              message: `Demo deposit ${refundAmount >= maxRefundAmount ? 'fully' : 'partially'} refunded successfully`,
              refundedAmount: refundAmount,
              totalRefunded: updatedDeposit.refundedAmount,
              remainingAmount: maxRefundAmount - updatedDeposit.refundedAmount,
              timestamp: now.toISOString(),
              note: 'This is a demo. No real refund was processed.'
            });

          case 'reauthorize':
            updatedDeposit = await repository.update(depositId, (current) => ({
              ...current,
              lastAuthorizationAt: now.toISOString()
            }));

            return res.status(200).json({
              success: true,
              action: 'reauthorize',
              depositId,
              message: 'Demo deposit reauthorized successfully',
              timestamp: now.toISOString(),
              note: 'This is a demo. No real payment was processed.'
            });

          default:
            return res.status(404).json({
              error: 'Action not found',
              availableActions: ['capture', 'release', 'refund', 'reauthorize']
            });
        }
      } catch (error) {
        console.error('Demo API action error:', error);
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          action,
          depositId
        });
      }
    }

    return res.status(404).json({
      error: 'Endpoint not found',
      availableEndpoints: [
        '/demo',
        '/demo/health', 
        '/demo/deposits',
        '/demo/deposits/hold/100',
        '/demo/deposits/hold/200'
      ]
    });

  } catch (error) {
    console.error('Demo API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      demo: true
    });
  }
}
