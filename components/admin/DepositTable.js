/**
 * Deposit Table Component
 * Displays deposits in a sortable, actionable table format with bulk selection
 */

import { useState } from 'react';
import { TableAnnouncer, LoadingAnnouncer } from '../accessibility/ScreenReaderUtils';
import { useKeyboardNavigation } from '../accessibility/KeyboardNavigation';
import Badge from '../ui/Badge';
import { formatCurrency, fromStripeAmount } from '../../utils/currency';

export default function DepositTable({ 
  deposits, 
  onDepositSelect, 
  onDepositAction,
  bulkSelection = [],
  onBulkSelectionChange,
  showBulkActions = false
}) {
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedDeposits = [...deposits].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleBulkSelect = (depositId, checked) => {
    if (checked) {
      onBulkSelectionChange([...bulkSelection, depositId]);
    } else {
      onBulkSelectionChange(bulkSelection.filter(id => id !== depositId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      onBulkSelectionChange(sortedDeposits.map(d => d.id));
    } else {
      onBulkSelectionChange([]);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'orange', icon: '⏳', label: 'Pending' },
      captured: { color: 'green', icon: '✅', label: 'Captured' },
      released: { color: 'blue', icon: '🔄', label: 'Released' },
      failed: { color: 'red', icon: '❌', label: 'Failed' },
      canceled: { color: 'gray', icon: '🚫', label: 'Canceled' },
      refunded: { color: 'purple', icon: '↩️', label: 'Refunded' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`status-badge status-${config.color}`}>
        <span className="status-icon">{config.icon}</span>
        <span className="status-text">{config.label}</span>
      </span>
    );
  };

  const formatAmount = (amount, currency = 'usd') => {
    try {
      // Debug logging
      console.log('DepositTable formatAmount called with:', { amount, currency, type: typeof amount, currencyType: typeof currency });

      // Convert from Stripe amount (cents) to display amount
      const displayAmount = fromStripeAmount(amount, currency);
      console.log('DepositTable converted amount:', { amount, displayAmount, currency });

      // Format with correct currency using imported utility
      const result = formatCurrency(displayAmount, currency);
      console.log('DepositTable formatCurrency result:', result);
      return result;
    } catch (error) {
      // Fallback to USD if currency is not supported
      console.warn('DepositTable Currency not supported, falling back to USD:', { currency, error: error.message });
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount / 100);
    }
  };

  const formatDate = (dateString) => {
    try {
      console.log('DepositTable formatDate called with:', { dateString, type: typeof dateString });

      // Handle different date formats
      let date;
      if (typeof dateString === 'string') {
        // If it's an ISO string, parse it directly
        date = new Date(dateString);
      } else if (typeof dateString === 'number') {
        // If it's a timestamp, convert to milliseconds if needed
        date = new Date(dateString > 1000000000000 ? dateString : dateString * 1000);
      } else {
        throw new Error('Invalid date format');
      }

      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }

      const result = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      console.log('DepositTable formatDate result:', result);
      return result;
    } catch (error) {
      console.warn('DepositTable Date formatting failed:', { dateString, error: error.message });
      return 'Invalid Date';
    }
  };

  const formatCustomer = (deposit) => {
    if (deposit.customer?.name) {
      return deposit.customer.name;
    }
    if (deposit.customer?.email) {
      return deposit.customer.email;
    }
    if (deposit.customer_id) {
      return deposit.customer_id.length > 20 ? 
        `${deposit.customer_id.substring(0, 20)}...` : 
        deposit.customer_id;
    }
    return 'Unknown';
  };

  const isAllSelected = sortedDeposits.length > 0 && 
    sortedDeposits.every(d => bulkSelection.includes(d.id));
  const isPartiallySelected = bulkSelection.length > 0 && !isAllSelected;

  return (
    <div className="deposit-table-container">
      <div className="table-wrapper">
        <table className="deposit-table">
          <thead>
            <tr>
              {showBulkActions && (
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={input => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="bulk-checkbox"
                  />
                </th>
              )}
              <th onClick={() => handleSort('id')} className="sortable">
                ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amount')} className="sortable">
                Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('status')} className="sortable">
                Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('customer_id')} className="sortable">
                Customer {sortField === 'customer_id' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('created_at')} className="sortable">
                Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDeposits.map((deposit) => (
              <tr 
                key={deposit.id} 
                className={`deposit-row ${bulkSelection.includes(deposit.id) ? 'selected' : ''}`}
                onClick={() => onDepositSelect(deposit)}
              >
                {showBulkActions && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={bulkSelection.includes(deposit.id)}
                      onChange={(e) => handleBulkSelect(deposit.id, e.target.checked)}
                      className="bulk-checkbox"
                    />
                  </td>
                )}
                <td className="deposit-id">
                  <span className="id-text">{deposit.id.substring(0, 8)}...</span>
                  <span className="id-full">{deposit.id}</span>
                </td>
                <td className="deposit-amount">{formatAmount(deposit.amount, deposit.currency)}</td>
                <td className="deposit-status">{getStatusBadge(deposit.status)}</td>
                <td className="deposit-customer">{formatCustomer(deposit)}</td>
                <td className="deposit-date">{formatDate(deposit.created)}</td>
                <td className="deposit-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="action-buttons">
                    {deposit.status === 'pending' && (
                      <>
                        <button
                          className="action-btn capture"
                          onClick={() => onDepositAction(deposit.id, 'capture')}
                          title="Capture deposit"
                        >
                          ✅
                        </button>
                        <button
                          className="action-btn release"
                          onClick={() => onDepositAction(deposit.id, 'release')}
                          title="Release deposit"
                        >
                          🔄
                        </button>
                      </>
                    )}
                    {deposit.status === 'captured' && (
                      <button
                        className="action-btn refund"
                        onClick={() => onDepositAction(deposit.id, 'refund')}
                        title="Refund deposit"
                      >
                        ↩️
                      </button>
                    )}
                    <button
                      className="action-btn view"
                      onClick={() => onDepositSelect(deposit)}
                      title="View details"
                    >
                      👁️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .deposit-table-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .deposit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .deposit-table th {
          background: #f8f9fa;
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          white-space: nowrap;
        }

        .deposit-table th.sortable {
          cursor: pointer;
          user-select: none;
          transition: background-color 0.2s ease;
        }

        .deposit-table th.sortable:hover {
          background: #e5e7eb;
        }

        .checkbox-column {
          width: 40px;
          text-align: center;
        }

        .actions-column {
          width: 120px;
          text-align: center;
        }

        .deposit-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: middle;
        }

        .deposit-row {
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .deposit-row:hover {
          background: #f8f9fa;
        }

        .deposit-row.selected {
          background: #eff6ff;
        }

        .deposit-id {
          font-family: 'Monaco', 'Menlo', monospace;
          color: #6b7280;
          position: relative;
        }

        .id-full {
          display: none;
          position: absolute;
          top: -5px;
          left: 0;
          background: #1f2937;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 10;
          white-space: nowrap;
        }

        .deposit-id:hover .id-full {
          display: block;
        }

        .deposit-amount {
          font-weight: 600;
          color: #111827;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .status-orange {
          background: #fef3c7;
          color: #d97706;
        }

        .status-green {
          background: #d1fae5;
          color: #059669;
        }

        .status-blue {
          background: #dbeafe;
          color: #2563eb;
        }

        .status-red {
          background: #fee2e2;
          color: #dc2626;
        }

        .status-gray {
          background: #f3f4f6;
          color: #6b7280;
        }

        .status-purple {
          background: #e9d5ff;
          color: #7c3aed;
        }

        .deposit-customer {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .deposit-date {
          color: #6b7280;
          white-space: nowrap;
        }

        .action-buttons {
          display: flex;
          gap: 4px;
          justify-content: center;
        }

        .action-btn {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
          min-width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .action-btn.capture {
          border-color: #10b981;
          color: #10b981;
        }

        .action-btn.capture:hover {
          background: #10b981;
          color: white;
        }

        .action-btn.release {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .action-btn.release:hover {
          background: #3b82f6;
          color: white;
        }

        .action-btn.refund {
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .action-btn.refund:hover {
          background: #f59e0b;
          color: white;
        }

        .action-btn.view {
          border-color: #6b7280;
          color: #6b7280;
        }

        .action-btn.view:hover {
          background: #6b7280;
          color: white;
        }

        .bulk-checkbox {
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .deposit-table {
            font-size: 12px;
          }

          .deposit-table th,
          .deposit-table td {
            padding: 8px 12px;
          }

          .deposit-customer {
            max-width: 100px;
          }

          .action-buttons {
            flex-direction: column;
            gap: 2px;
          }

          .action-btn {
            min-width: 24px;
            height: 24px;
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}
