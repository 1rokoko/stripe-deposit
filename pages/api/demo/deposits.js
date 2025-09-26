// Demo deposits API for test mode
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Demo deposits with different currencies
  const demoDeposits = [
    {
      id: 'pi_demo_thb_154',
      customerId: 'cus_demo_thai_user',
      amount: 15400, // 154 THB in cents
      currency: 'thb',
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      metadata: {
        created_via: 'demo_data',
        demo: 'true'
      }
    },
    {
      id: 'pi_demo_usd_100',
      customerId: 'cus_demo_us_user',
      amount: 10000, // $100.00 in cents
      currency: 'usd',
      status: 'captured',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      metadata: {
        created_via: 'demo_data',
        demo: 'true'
      }
    },
    {
      id: 'pi_demo_eur_75',
      customerId: 'cus_demo_eu_user',
      amount: 7500, // €75.00 in cents
      currency: 'eur',
      status: 'captured',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      metadata: {
        created_via: 'demo_data',
        demo: 'true'
      }
    },
    {
      id: 'pi_demo_thb_1030',
      customerId: 'cus_demo_thai_user_2',
      amount: 103000, // 1030 THB in cents
      currency: 'thb',
      status: 'released',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
      metadata: {
        created_via: 'demo_data',
        demo: 'true'
      }
    },
    {
      id: 'pi_demo_usd_500',
      customerId: 'cus_demo_us_user_2',
      amount: 50000, // $500.00 in cents
      currency: 'usd',
      status: 'refunded',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      refundedAmount: 50000,
      metadata: {
        created_via: 'demo_data',
        demo: 'true'
      }
    }
  ];

  console.log('📊 Demo deposits API called, returning', demoDeposits.length, 'deposits');

  return res.status(200).json({
    success: true,
    deposits: demoDeposits,
    total: demoDeposits.length,
    mode: 'demo'
  });
}
