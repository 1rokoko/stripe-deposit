/**
 * List Deposits API
 * GET /api/deposits/list - Get list of deposits
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return demo data
    const demoDeposits = [
      {
        id: 'pi_demo_thb_154',
        customerId: 'cus_demo_thai_user',
        amount: 15400,
        currency: 'thb',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: 'pi_demo_usd_100',
        customerId: 'cus_demo_us_user',
        amount: 10000,
        currency: 'usd',
        status: 'captured',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      }
    ];

    return res.status(200).json({
      success: true,
      deposits: demoDeposits
    });

  } catch (error) {
    console.error('❌ List deposits error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
