/**
 * Admin Deposits API Endpoint
 * Handles deposit listing and management operations
 */

const { requireAdminAuth, logAdminAction } = require('../../../lib/admin-auth');
const { createDepositRepository } = require('../../../src/repositories/repositoryFactory');
const { loadEnv } = require('../../../src/config');

async function handler(req, res) {
  try {
    // Initialize repository
    const env = loadEnv();
    const repository = createDepositRepository({ type: 'auto' });

    if (req.method === 'GET') {
      return await handleGetDeposits(req, res, repository);
    } else {
      return res.status(405).json({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }
  } catch (error) {
    console.error('Admin deposits API error:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleGetDeposits(req, res, repository) {
  try {
    // Log admin action
    logAdminAction(req.admin.user, 'VIEW_DEPOSITS', {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      query: req.query
    });

    // Get query parameters for filtering and pagination
    const {
      page = 1,
      limit = 50,
      status,
      dateFrom,
      dateTo,
      customerId,
      amountMin,
      amountMax,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Get all deposits
    const allDeposits = await repository.getAllDeposits();
    
    // Apply filters
    let filteredDeposits = [...allDeposits];

    // Status filter
    if (status && status !== 'all') {
      filteredDeposits = filteredDeposits.filter(d => d.status === status);
    }

    // Date range filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredDeposits = filteredDeposits.filter(d => 
        new Date(d.created_at) >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filteredDeposits = filteredDeposits.filter(d => 
        new Date(d.created_at) <= toDate
      );
    }

    // Customer filter
    if (customerId) {
      const searchTerm = customerId.toLowerCase();
      filteredDeposits = filteredDeposits.filter(d => 
        d.customer_id?.toLowerCase().includes(searchTerm) ||
        d.customer?.name?.toLowerCase().includes(searchTerm) ||
        d.customer?.email?.toLowerCase().includes(searchTerm)
      );
    }

    // Amount range filters
    if (amountMin) {
      const minAmount = parseFloat(amountMin) * 100; // Convert to cents
      filteredDeposits = filteredDeposits.filter(d => d.amount >= minAmount);
    }

    if (amountMax) {
      const maxAmount = parseFloat(amountMax) * 100; // Convert to cents
      filteredDeposits = filteredDeposits.filter(d => d.amount <= maxAmount);
    }

    // General search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredDeposits = filteredDeposits.filter(d => 
        d.id.toLowerCase().includes(searchTerm) ||
        d.payment_intent_id?.toLowerCase().includes(searchTerm) ||
        d.customer_id?.toLowerCase().includes(searchTerm) ||
        d.customer?.name?.toLowerCase().includes(searchTerm) ||
        d.customer?.email?.toLowerCase().includes(searchTerm)
      );
    }

    // Sort deposits
    filteredDeposits.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle date sorting
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      // Handle numeric sorting
      if (sortBy === 'amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Calculate pagination
    const totalDeposits = filteredDeposits.length;
    const totalPages = Math.ceil(totalDeposits / limit);
    const offset = (page - 1) * limit;
    const paginatedDeposits = filteredDeposits.slice(offset, offset + parseInt(limit));

    // Enhance deposits with additional information
    const enhancedDeposits = paginatedDeposits.map(deposit => ({
      ...deposit,
      // Add computed fields
      formattedAmount: (deposit.amount / 100).toFixed(2),
      ageInDays: Math.floor((Date.now() - new Date(deposit.created_at)) / (1000 * 60 * 60 * 24)),
      // Add customer info if available
      customer: deposit.customer || {
        name: deposit.customer_id ? `Customer ${deposit.customer_id.substring(0, 8)}` : 'Unknown',
        email: null,
        phone: null
      }
    }));

    // Calculate summary statistics
    const summary = {
      total: totalDeposits,
      totalAmount: filteredDeposits.reduce((sum, d) => sum + d.amount, 0),
      statusBreakdown: {
        pending: filteredDeposits.filter(d => d.status === 'pending').length,
        captured: filteredDeposits.filter(d => d.status === 'captured').length,
        released: filteredDeposits.filter(d => d.status === 'released').length,
        failed: filteredDeposits.filter(d => d.status === 'failed').length,
        canceled: filteredDeposits.filter(d => d.status === 'canceled').length,
        refunded: filteredDeposits.filter(d => d.status === 'refunded').length
      },
      averageAmount: totalDeposits > 0 ? 
        Math.round(filteredDeposits.reduce((sum, d) => sum + d.amount, 0) / totalDeposits) : 0
    };

    res.status(200).json({
      success: true,
      deposits: enhancedDeposits,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalDeposits,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      summary,
      filters: {
        status,
        dateFrom,
        dateTo,
        customerId,
        amountMin,
        amountMax,
        search,
        sortBy,
        sortOrder
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching deposits:', error);
    
    res.status(500).json({ 
      error: 'Failed to fetch deposits',
      code: 'FETCH_DEPOSITS_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = requireAdminAuth(handler);
