/**
 * Deposit Filters Component
 * Advanced filtering interface for deposit management
 */

import { useState } from 'react';

export default function DepositFilters({ filters, onFiltersChange, onReset }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (field, value) => {
    onFiltersChange({
      ...filters,
      [field]: value
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.customerId) count++;
    if (filters.amountMin) count++;
    if (filters.amountMax) count++;
    if (filters.search) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="deposit-filters">
      <div className="filters-header">
        <div className="filters-title">
          <h3>Filters</h3>
          {activeFiltersCount > 0 && (
            <span className="active-count">{activeFiltersCount} active</span>
          )}
        </div>
        <div className="filters-actions">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="expand-button"
          >
            {isExpanded ? '▲ Less' : '▼ More'}
          </button>
          {activeFiltersCount > 0 && (
            <button onClick={onReset} className="reset-button">
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      <div className="filters-content">
        {/* Always visible filters */}
        <div className="filters-row primary">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="ID, customer, payment intent..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="pending">⏳ Pending</option>
              <option value="captured">✅ Captured</option>
              <option value="released">🔄 Released</option>
              <option value="failed">❌ Failed</option>
              <option value="canceled">🚫 Canceled</option>
              <option value="refunded">↩️ Refunded</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="filter-input"
            />
          </div>
        </div>

        {/* Expandable filters */}
        {isExpanded && (
          <div className="filters-row secondary">
            <div className="filter-group">
              <label>Customer ID/Email</label>
              <input
                type="text"
                placeholder="Customer identifier..."
                value={filters.customerId}
                onChange={(e) => handleFilterChange('customerId', e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label>Min Amount ($)</label>
              <input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={filters.amountMin}
                onChange={(e) => handleFilterChange('amountMin', e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label>Max Amount ($)</label>
              <input
                type="number"
                placeholder="1000.00"
                min="0"
                step="0.01"
                value={filters.amountMax}
                onChange={(e) => handleFilterChange('amountMax', e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label>Quick Filters</label>
              <div className="quick-filters">
                <button
                  onClick={() => handleFilterChange('dateFrom', new Date().toISOString().split('T')[0])}
                  className="quick-filter-btn"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    handleFilterChange('dateFrom', weekAgo.toISOString().split('T')[0]);
                  }}
                  className="quick-filter-btn"
                >
                  Last 7 days
                </button>
                <button
                  onClick={() => {
                    const monthAgo = new Date();
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    handleFilterChange('dateFrom', monthAgo.toISOString().split('T')[0]);
                  }}
                  className="quick-filter-btn"
                >
                  Last 30 days
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .deposit-filters {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
          overflow: hidden;
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8f9fa;
        }

        .filters-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filters-title h3 {
          margin: 0;
          color: #374151;
          font-size: 16px;
        }

        .active-count {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .filters-actions {
          display: flex;
          gap: 8px;
        }

        .expand-button, .reset-button {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .expand-button:hover, .reset-button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .reset-button {
          color: #dc2626;
          border-color: #fca5a5;
        }

        .reset-button:hover {
          background: #fee2e2;
          border-color: #dc2626;
        }

        .filters-content {
          padding: 20px;
        }

        .filters-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .filters-row.secondary {
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          margin-bottom: 0;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-group label {
          font-size: 12px;
          font-weight: 500;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-input, .filter-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s ease;
        }

        .filter-input:focus, .filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .filter-select {
          background: white;
          cursor: pointer;
        }

        .quick-filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .quick-filter-btn {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .quick-filter-btn:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .filters-header {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
          }

          .filters-actions {
            justify-content: space-between;
          }

          .filters-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .quick-filters {
            justify-content: stretch;
          }

          .quick-filter-btn {
            flex: 1;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .filters-content {
            padding: 15px;
          }

          .filters-header {
            padding: 12px 15px;
          }

          .filter-input, .filter-select {
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
}
