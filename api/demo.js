// Demo endpoint with shared repository
const { createDepositRepository } = require('../src/repositories/repositoryFactory');

// Repository factory function for serverless environment
function createRepositoryForRequest() {
  try {
    console.log('Demo API: Creating repository with DATABASE_URL:', process.env.DATABASE_URL ? 'present' : 'missing');
    const repository = createDepositRepository({
      type: 'auto' // Auto-detect: PostgreSQL -> SQLite -> Memory
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
        },
        note: 'This is a demo version. Real Stripe integration requires proper API keys.'
      });
    }

    if (pathname === '/demo/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'stripe-deposit-demo',
        version: '1.0.0',
        environment: 'vercel-serverless'
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
        status: 'authorized',
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
      await repository.create(deposit);

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

    // Demo deposit actions
    const actionMatch = pathname.match(/^\/demo\/deposits\/([^\/]+)\/(.+)$/);
    if (actionMatch && method === 'POST') {
      const depositId = actionMatch[1];
      const action = actionMatch[2];

      const demoResponse = {
        depositId,
        action,
        success: true,
        timestamp: new Date().toISOString(),
        note: 'This is a demo. No real action was performed.'
      };

      switch (action) {
        case 'capture':
          return res.status(200).json({
            ...demoResponse,
            message: 'Demo deposit captured successfully',
            capturedAmount: req.body?.amount || 10000
          });

        case 'release':
          return res.status(200).json({
            ...demoResponse,
            message: 'Demo deposit released successfully'
          });

        case 'reauthorize':
          return res.status(200).json({
            ...demoResponse,
            message: 'Demo deposit reauthorized successfully'
          });

        default:
          return res.status(404).json({
            error: 'Action not found',
            availableActions: ['capture', 'release', 'reauthorize']
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
