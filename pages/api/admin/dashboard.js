/**
 * Admin Dashboard API Endpoint
 * Provides metrics and overview data for admin dashboard
 */

import { requireAdminAuth, logAdminAction } from '../../../lib/admin-auth';
import { createDepositRepository } from '../../../src/repositories/repositoryFactory';
import { loadEnv } from '../../../src/config';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Initialize repository
    const env = loadEnv();
    const repository = createDepositRepository({ type: 'auto' });

    // Log admin action
    logAdminAction(req.admin.user, 'VIEW_DASHBOARD', {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Calculate date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    // Get all deposits for calculations
    const allDeposits = await repository.getAllDeposits();
    
    // Filter deposits by date ranges
    const currentPeriodDeposits = allDeposits.filter(d => 
      new Date(d.created_at) >= thirtyDaysAgo
    );
    const previousPeriodDeposits = allDeposits.filter(d => 
      new Date(d.created_at) >= sixtyDaysAgo && new Date(d.created_at) < thirtyDaysAgo
    );

    // Calculate metrics
    const totalDeposits = allDeposits.length;
    const totalAmount = allDeposits.reduce((sum, d) => sum + d.amount, 0);
    const pendingDeposits = allDeposits.filter(d => d.status === 'pending').length;
    const capturedDeposits = allDeposits.filter(d => d.status === 'captured').length;
    const failedDeposits = allDeposits.filter(d => d.status === 'failed').length;

    // Calculate success rate
    const completedDeposits = capturedDeposits + failedDeposits;
    const successRate = completedDeposits > 0 ? 
      Math.round((capturedDeposits / completedDeposits) * 100) : 0;

    // Calculate period comparisons
    const currentPeriodCount = currentPeriodDeposits.length;
    const previousPeriodCount = previousPeriodDeposits.length;
    const depositsChange = calculatePercentageChange(currentPeriodCount, previousPeriodCount);

    const currentPeriodAmount = currentPeriodDeposits.reduce((sum, d) => sum + d.amount, 0);
    const previousPeriodAmount = previousPeriodDeposits.reduce((sum, d) => sum + d.amount, 0);
    const amountChange = calculatePercentageChange(currentPeriodAmount, previousPeriodAmount);

    const currentPendingCount = currentPeriodDeposits.filter(d => d.status === 'pending').length;
    const previousPendingCount = previousPeriodDeposits.filter(d => d.status === 'pending').length;
    const pendingChange = calculatePercentageChange(currentPendingCount, previousPendingCount);

    // Calculate success rate for periods
    const currentCaptured = currentPeriodDeposits.filter(d => d.status === 'captured').length;
    const currentCompleted = currentPeriodDeposits.filter(d => 
      d.status === 'captured' || d.status === 'failed'
    ).length;
    const currentSuccessRate = currentCompleted > 0 ? 
      Math.round((currentCaptured / currentCompleted) * 100) : 0;

    const previousCaptured = previousPeriodDeposits.filter(d => d.status === 'captured').length;
    const previousCompleted = previousPeriodDeposits.filter(d => 
      d.status === 'captured' || d.status === 'failed'
    ).length;
    const previousSuccessRate = previousCompleted > 0 ? 
      Math.round((previousCaptured / previousCompleted) * 100) : 0;
    
    const successRateChange = calculatePercentageChange(currentSuccessRate, previousSuccessRate);

    // Get recent deposits (last 10)
    const recentDeposits = allDeposits
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(deposit => ({
        id: deposit.id,
        amount: deposit.amount,
        status: deposit.status,
        customer_id: deposit.customer_id,
        payment_intent_id: deposit.payment_intent_id,
        created_at: deposit.created_at,
        updated_at: deposit.updated_at,
        metadata: deposit.metadata || {}
      }));

    // Additional metrics
    const averageDepositAmount = totalDeposits > 0 ? Math.round(totalAmount / totalDeposits) : 0;
    const todayDeposits = allDeposits.filter(d => {
      const depositDate = new Date(d.created_at);
      const today = new Date();
      return depositDate.toDateString() === today.toDateString();
    }).length;

    // Status distribution
    const statusDistribution = {
      pending: allDeposits.filter(d => d.status === 'pending').length,
      captured: allDeposits.filter(d => d.status === 'captured').length,
      released: allDeposits.filter(d => d.status === 'released').length,
      failed: allDeposits.filter(d => d.status === 'failed').length,
      canceled: allDeposits.filter(d => d.status === 'canceled').length,
      refunded: allDeposits.filter(d => d.status === 'refunded').length
    };

    const metrics = {
      // Main metrics
      totalDeposits,
      totalAmount,
      pendingDeposits,
      successRate,
      
      // Changes compared to previous period
      depositsChange,
      amountChange,
      pendingChange,
      successRateChange,
      
      // Recent activity
      recentDeposits,
      
      // Additional insights
      averageDepositAmount,
      todayDeposits,
      statusDistribution,
      
      // Period information
      periodDays: 30,
      lastUpdated: new Date().toISOString()
    };

    res.status(200).json(metrics);

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      code: 'DASHBOARD_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }
  
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

export default requireAdminAuth(handler);
