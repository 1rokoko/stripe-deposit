/**
 * Admin API for managing deposits
 * GET /api/admin/deposits - List all deposits
 */

import { verifyAdminAuth } from '../../../lib/admin-api-auth';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = verifyAdminAuth(req);
  if (!authResult.success) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Admin authentication required' 
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get Stripe mode from headers
    const mode = req.headers['x-stripe-mode'] || 'test';
    console.log(`📊 Admin deposits request - Mode: ${mode}`);

    // For now, return demo data with multi-currency examples
    const demoDeposits = [
      {
        id: 'pi_demo_thb_154',
        customerId: 'cus_demo_thai_user',
        amount: 15400, // 154 THB in cents
        currency: 'thb',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        metadata: { created_via: 'demo_data', demo: 'true' }
      },
      {
        id: 'pi_demo_usd_100',
        customerId: 'cus_demo_us_user',
        amount: 10000, // $100 in cents
        currency: 'usd',
        status: 'captured',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        metadata: { created_via: 'demo_data', demo: 'true' }
      },
      {
        id: 'pi_demo_eur_75',
        customerId: 'cus_demo_eu_user',
        amount: 7500, // €75 in cents
        currency: 'eur',
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        metadata: { created_via: 'demo_data', demo: 'true' }
      }
    ];

    // Transform deposits for admin display
    const deposits = demoDeposits.map(deposit => ({
      id: deposit.id,
      customerId: deposit.customerId,
      amount: deposit.amount,
      currency: deposit.currency.toUpperCase(),
      status: deposit.status,
      created: deposit.createdAt, // Keep as ISO string for proper date formatting
      metadata: deposit.metadata
    }));

    console.log(`✅ Returning ${deposits.length} demo deposits for admin panel`);

    return res.status(200).json({
      success: true,
      deposits,
      mode,
      total: deposits.length,
      note: 'Demo data for development purposes'
    });

  } catch (error) {
    console.error('❌ Admin deposits error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
