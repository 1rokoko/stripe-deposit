// Demo endpoint without Stripe dependency
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
    const pathname = url;
    
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
      // Demo deposits data
      const demoDeposits = [
        {
          id: 'dep_demo_001',
          customerId: 'cus_demo_customer',
          amount: 10000, // $100.00
          currency: 'usd',
          status: 'authorized',
          paymentIntentId: 'pi_demo_intent_001',
          createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          metadata: { demo: true }
        },
        {
          id: 'dep_demo_002', 
          customerId: 'cus_demo_customer_2',
          amount: 20000, // $200.00
          currency: 'usd',
          status: 'requires_action',
          paymentIntentId: 'pi_demo_intent_002',
          createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
          metadata: { demo: true }
        }
      ];

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
      
      if (![100, 200].includes(amount)) {
        return res.status(400).json({
          error: 'Invalid hold amount. Must be 100 or 200.',
          demo: true
        });
      }

      const demoDeposit = {
        id: `dep_demo_${Date.now()}`,
        customerId: req.body?.customerId || 'cus_demo_customer',
        amount: amount * 100, // Convert to cents
        currency: 'usd',
        status: 'authorized',
        paymentIntentId: `pi_demo_${Date.now()}`,
        createdAt: new Date().toISOString(),
        metadata: { 
          demo: true,
          ...req.body?.metadata 
        }
      };

      return res.status(200).json({
        success: true,
        deposit: demoDeposit,
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
