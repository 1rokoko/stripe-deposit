/**
 * Admin Deposits Management Page
 * Comprehensive deposit management interface
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/AdminLayout';
import DepositTable from '../../components/admin/DepositTable';
import DepositFilters from '../../components/admin/DepositFilters';
import DepositModal from '../../components/admin/DepositModal';
import { requireAdminAuthSSR } from '../../lib/admin-auth';

export default function AdminDeposits({ admin }) {
  const [deposits, setDeposits] = useState([]);
  const [filteredDeposits, setFilteredDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [bulkSelection, setBulkSelection] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    customerId: '',
    amountMin: '',
    amountMax: '',
    search: ''
  });

  const router = useRouter();

  useEffect(() => {
    fetchDeposits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [deposits, filters]);

  const fetchDeposits = async () => {
    try {
      setError('');
      const response = await fetch('/api/admin/deposits', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits || []);
      } else if (response.status === 401) {
        router.push('/admin/login');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch deposits');
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...deposits];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    // Date range filters
    if (filters.dateFrom) {
      filtered = filtered.filter(d => 
        new Date(d.created_at) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(d => 
        new Date(d.created_at) <= endDate
      );
    }

    // Customer ID filter
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
      filtered = filtered.filter(d => d.amount >= filters.amountMin * 100);
    }

    if (filters.amountMax) {
      filtered = filtered.filter(d => d.amount <= filters.amountMax * 100);
    }

    // General search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(d => 
        d.id.toLowerCase().includes(searchTerm) ||
        d.payment_intent_id?.toLowerCase().includes(searchTerm) ||
        d.customer_id?.toLowerCase().includes(searchTerm) ||
        d.customer?.name?.toLowerCase().includes(searchTerm) ||
        d.customer?.email?.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredDeposits(filtered);
  };

  const handleDepositAction = async (depositId, action, data = {}) => {
    try {
      const response = await fetch(`/api/admin/deposits/${depositId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        await fetchDeposits(); // Refresh data
        setSelectedDeposit(null);
        
        // Show success message
        const result = await response.json();
        alert(`✅ ${action.charAt(0).toUpperCase() + action.slice(1)} successful: ${result.message || ''}`);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.message || 'Action failed'}`);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      alert('❌ Network error occurred');
    }
  };

  const handleBulkAction = async (action) => {
    if (bulkSelection.length === 0) {
      alert('Please select deposits first');
      return;
    }

    const confirmMessage = `Are you sure you want to ${action} ${bulkSelection.length} deposits?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/deposits/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          action,
          depositIds: bulkSelection
        })
      });

      if (response.ok) {
        const result = await response.json();
        await fetchDeposits(); // Refresh data
        setBulkSelection([]);
        setShowBulkActions(false);
        alert(`✅ Bulk ${action} completed: ${result.successful} successful, ${result.failed} failed`);
      } else {
        const error = await response.json();
        alert(`❌ Bulk action error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('❌ Network error occurred');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/deposits/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          filters,
          deposits: filteredDeposits.map(d => d.id)
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deposits-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`❌ Export error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error exporting deposits:', error);
      alert('❌ Export failed');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Deposits">
        <div className="loading-container">
          <div className="loading-spinner">🔄</div>
          <p>Loading deposits...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error && deposits.length === 0) {
    return (
      <AdminLayout title="Deposits">
        <div className="error-container">
          <div className="error-message">❌ {error}</div>
          <button onClick={fetchDeposits} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Deposit Management">
      <div className="admin-deposits">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-left">
            <h1>Deposit Management</h1>
            <p>Manage and monitor all deposit transactions</p>
          </div>
          <div className="header-actions">
            <button onClick={fetchDeposits} className="refresh-button" disabled={loading}>
              {loading ? '🔄' : '↻'} Refresh
            </button>
            <button onClick={handleExport} className="export-button">
              📊 Export CSV
            </button>
            <button 
              onClick={() => setShowBulkActions(!showBulkActions)}
              className={`bulk-toggle ${showBulkActions ? 'active' : ''}`}
            >
              ☑️ Bulk Actions
            </button>
          </div>
        </div>

        {/* Filters */}
        <DepositFilters 
          filters={filters}
          onFiltersChange={setFilters}
          onReset={() => setFilters({
            status: 'all',
            dateFrom: '',
            dateTo: '',
            customerId: '',
            amountMin: '',
            amountMax: '',
            search: ''
          })}
        />

        {/* Summary */}
        <div className="deposits-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Total Results</span>
              <span className="summary-value">{filteredDeposits.length}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Amount</span>
              <span className="summary-value">
                ${(filteredDeposits.reduce((sum, d) => sum + d.amount, 0) / 100).toLocaleString()}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Selected</span>
              <span className="summary-value">{bulkSelection.length}</span>
            </div>
          </div>

          {showBulkActions && bulkSelection.length > 0 && (
            <div className="bulk-actions">
              <button 
                onClick={() => handleBulkAction('capture')}
                className="bulk-action capture"
              >
                ✅ Capture Selected ({bulkSelection.length})
              </button>
              <button 
                onClick={() => handleBulkAction('release')}
                className="bulk-action release"
              >
                🔄 Release Selected ({bulkSelection.length})
              </button>
              <button 
                onClick={() => handleBulkAction('cancel')}
                className="bulk-action cancel"
              >
                🚫 Cancel Selected ({bulkSelection.length})
              </button>
            </div>
          )}
        </div>

        {/* Deposits Table */}
        {filteredDeposits.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No deposits found</h3>
            <p>Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <DepositTable
            deposits={filteredDeposits}
            onDepositSelect={setSelectedDeposit}
            onDepositAction={handleDepositAction}
            bulkSelection={bulkSelection}
            onBulkSelectionChange={setBulkSelection}
            showBulkActions={showBulkActions}
          />
        )}

        {/* Deposit Modal */}
        {selectedDeposit && (
          <DepositModal
            deposit={selectedDeposit}
            onClose={() => setSelectedDeposit(null)}
            onAction={handleDepositAction}
          />
        )}

        <style jsx>{`
          .admin-deposits {
            max-width: 1400px;
            margin: 0 auto;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e1e5e9;
          }

          .header-left h1 {
            margin: 0 0 5px 0;
            color: #2c3e50;
            font-size: 28px;
          }

          .header-left p {
            margin: 0;
            color: #7f8c8d;
            font-size: 16px;
          }

          .header-actions {
            display: flex;
            gap: 10px;
          }

          .refresh-button, .export-button, .bulk-toggle {
            padding: 10px 16px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
          }

          .refresh-button:hover, .export-button:hover, .bulk-toggle:hover {
            background: #f8f9fa;
            border-color: #3498db;
          }

          .export-button {
            background: #27ae60;
            color: white;
            border-color: #27ae60;
          }

          .export-button:hover {
            background: #229954;
          }

          .bulk-toggle.active {
            background: #3498db;
            color: white;
            border-color: #3498db;
          }

          .deposits-summary {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .summary-cards {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
          }

          .summary-card {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .summary-label {
            font-size: 12px;
            color: #7f8c8d;
            text-transform: uppercase;
            font-weight: 500;
          }

          .summary-value {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
          }

          .bulk-actions {
            display: flex;
            gap: 10px;
            padding-top: 15px;
            border-top: 1px solid #e1e5e9;
          }

          .bulk-action {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .bulk-action.capture {
            background: #27ae60;
            color: white;
          }

          .bulk-action.release {
            background: #3498db;
            color: white;
          }

          .bulk-action.cancel {
            background: #e74c3c;
            color: white;
          }

          .bulk-action:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }

          .empty-state {
            background: white;
            border-radius: 8px;
            padding: 60px 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }

          .empty-state h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 24px;
          }

          .empty-state p {
            margin: 0;
            color: #7f8c8d;
            font-size: 16px;
          }

          .loading-container, .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            text-align: center;
          }

          .loading-spinner {
            font-size: 48px;
            animation: spin 2s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .error-message {
            background: #fee;
            color: #c33;
            padding: 15px 20px;
            border-radius: 6px;
            margin-bottom: 15px;
            border: 1px solid #fcc;
          }

          .retry-button {
            padding: 10px 20px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          }

          @media (max-width: 768px) {
            .page-header {
              flex-direction: column;
              gap: 15px;
              align-items: stretch;
            }

            .header-actions {
              justify-content: stretch;
            }

            .refresh-button, .export-button, .bulk-toggle {
              flex: 1;
            }

            .summary-cards {
              flex-direction: column;
              gap: 10px;
            }

            .bulk-actions {
              flex-direction: column;
            }
          }
        `}</style>
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps = requireAdminAuthSSR;
