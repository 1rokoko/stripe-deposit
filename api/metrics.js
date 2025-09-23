// Metrics endpoint for Vercel
const { loadEnv } = require('../src/config');

function isAuthorized(req, apiToken) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token === apiToken;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const env = loadEnv();

    if (!isAuthorized(req, env.API_AUTH_TOKEN)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Mock metrics for serverless environment
    const metrics = {
      timestamp: new Date().toISOString(),
      service: 'stripe-deposit',
      version: '1.0.0',
      environment: 'vercel-serverless',
      jobs: {
        reauthorization: {
          lastRun: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          success: true,
          details: { processed: 0, errors: 0 }
        }
      },
      webhookRetry: {
        pending: 0,
        deadLetter: 0
      },
      requests: {
        total: 'N/A (serverless)',
        byStatus: 'N/A (serverless)'
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal
      }
    };

    return res.status(200).json(metrics);

  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
