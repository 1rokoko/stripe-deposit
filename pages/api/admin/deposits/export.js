/**
 * Admin Deposits Export API Endpoint
 * Exports deposit data in CSV format
 */

const { requireAdminAuth, logAdminAction } = require('../../../../lib/admin-auth');
const { createDepositRepository } = require('../../../../src/repositories/repositoryFactory');
const { loadEnv } = require('../../../../src/config');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { filters = {}, deposits: depositIds, format = 'csv' } = req.body;

    // Initialize repository
    const env = loadEnv();
    const repository = createDepositRepository({ type: 'auto' });

    // Log admin action
    logAdminAction(req.admin.user, 'EXPORT_DEPOSITS', {
      format,
      filters,
      depositCount: depositIds?.length || 'all',
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    let depositsToExport;

    if (depositIds && Array.isArray(depositIds)) {
      // Export specific deposits
      depositsToExport = await Promise.all(
        depositIds.map(id => repository.getDepositById(id))
      );
      depositsToExport = depositsToExport.filter(d => d !== null);
    } else {
      // Export all deposits with filters
      const allDeposits = await repository.getAllDeposits();
      depositsToExport = applyFilters(allDeposits, filters);
    }

    if (depositsToExport.length === 0) {
      return res.status(404).json({
        error: 'No deposits found for export',
        code: 'NO_DEPOSITS_FOUND'
      });
    }

    // Limit export size
    if (depositsToExport.length > 10000) {
      return res.status(400).json({
        error: 'Too many deposits to export. Maximum 10,000 allowed.',
        code: 'EXPORT_TOO_LARGE',
        count: depositsToExport.length
      });
    }

    // Generate export based on format
    if (format === 'csv') {
      const csvData = generateCSV(depositsToExport);
      const filename = `deposits-export-${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } else if (format === 'json') {
      const filename = `deposits-export-${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).json({
        exportDate: new Date().toISOString(),
        totalDeposits: depositsToExport.length,
        filters,
        deposits: depositsToExport
      });
    } else {
      return res.status(400).json({
        error: 'Unsupported export format',
        code: 'UNSUPPORTED_FORMAT',
        supportedFormats: ['csv', 'json']
      });
    }

  } catch (error) {
    console.error('Export deposits error:', error);
    
    res.status(500).json({ 
      error: 'Export failed',
      code: 'EXPORT_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function applyFilters(deposits, filters) {
  let filtered = [...deposits];

  // Status filter
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(d => d.status === filters.status);
  }

  // Date range filters
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter(d => new Date(d.created_at) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter(d => new Date(d.created_at) <= toDate);
  }

  // Customer filter
  if (filters.customerId) {
    const searchTerm = filters.customerId.toLowerCase();
    filtered = filtered.filter(d => 
      d.customer_id?.toLowerCase().includes(searchTerm) ||
      d.customer?.name?.toLowerCase().includes(searchTerm) ||
      d.customer?.email?.toLowerCase().includes(searchTerm)
    );
  }

  // Amount range filters
  if (filters.amountMin) {
    const minAmount = parseFloat(filters.amountMin) * 100;
    filtered = filtered.filter(d => d.amount >= minAmount);
  }

  if (filters.amountMax) {
    const maxAmount = parseFloat(filters.amountMax) * 100;
    filtered = filtered.filter(d => d.amount <= maxAmount);
  }

  // General search filter
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filtered = filtered.filter(d => 
      d.id.toLowerCase().includes(searchTerm) ||
      d.payment_intent_id?.toLowerCase().includes(searchTerm) ||
      d.customer_id?.toLowerCase().includes(searchTerm)
    );
  }

  return filtered;
}

function generateCSV(deposits) {
  // Define CSV headers
  const headers = [
    'ID',
    'Payment Intent ID',
    'Amount (USD)',
    'Status',
    'Customer ID',
    'Customer Name',
    'Customer Email',
    'Created At',
    'Updated At',
    'Captured At',
    'Released At',
    'Refunded At',
    'Canceled At',
    'Failure Reason',
    'Metadata'
  ];

  // Generate CSV rows
  const rows = deposits.map(deposit => [
    deposit.id,
    deposit.payment_intent_id || '',
    (deposit.amount / 100).toFixed(2),
    deposit.status,
    deposit.customer_id || '',
    deposit.customer?.name || '',
    deposit.customer?.email || '',
    formatDateForCSV(deposit.created_at),
    formatDateForCSV(deposit.updated_at),
    formatDateForCSV(deposit.captured_at),
    formatDateForCSV(deposit.released_at),
    formatDateForCSV(deposit.refunded_at),
    formatDateForCSV(deposit.canceled_at),
    deposit.failure_reason || '',
    deposit.metadata ? JSON.stringify(deposit.metadata) : ''
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

function formatDateForCSV(dateString) {
  if (!dateString) return '';
  
  try {
    return new Date(dateString).toISOString();
  } catch (error) {
    return dateString;
  }
}

module.exports = requireAdminAuth(handler);
