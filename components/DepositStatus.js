import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { LoadingSpinner } from './ui/LoadingSpinner';

export default function DepositStatus({ deposits, onAction, onRefresh }) {
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all');

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { variant: 'warning', label: 'Pending' },
      captured: { variant: 'success', label: 'Captured' },
      released: { variant: 'info', label: 'Released' },
      failed: { variant: 'danger', label: 'Failed' },
      canceled: { variant: 'secondary', label: 'Canceled' }
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatAmount = (amount) => {
    return `$${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAction = async (depositId, action) => {
    setActionLoading(`${depositId}-${action}`);
    try {
      await onAction(depositId, action);
      setSelectedDeposit(null);
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredDeposits = deposits.filter(deposit => {
    if (filter === 'all') return true;
    return deposit.status === filter;
  });

  const statusCounts = deposits.reduce((acc, deposit) => {
    acc[deposit.status] = (acc[deposit.status] || 0) + 1;
    return acc;
  }, {});

  const totalAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);

  if (deposits.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-gray-400 text-6xl mb-4">💳</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No deposits yet</h3>
        <p className="text-gray-600 mb-4">
          Create your first deposit to get started with secure payment processing.
        </p>
        <Button onClick={onRefresh} variant="secondary">
          Refresh
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{deposits.length}</div>
          <div className="text-sm text-gray-600">Total Deposits</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{formatAmount(totalAmount)}</div>
          <div className="text-sm text-gray-600">Total Amount</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending || 0}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{statusCounts.captured || 0}</div>
          <div className="text-sm text-gray-600">Captured</div>
        </Card>
      </div>

      {/* Filter and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'captured', 'released', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && statusCounts[status] && (
                <span className="ml-1">({statusCounts[status]})</span>
              )}
            </button>
          ))}
        </div>
        <Button onClick={onRefresh} variant="secondary" size="small">
          🔄 Refresh
        </Button>
      </div>

      {/* Deposits List */}
      <div className="space-y-4">
        {filteredDeposits.map((deposit) => (
          <Card key={deposit.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium text-gray-900">
                    {deposit.id.substring(0, 12)}...
                  </h3>
                  {getStatusBadge(deposit.status)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Amount:</span> {formatAmount(deposit.amount)}
                  </div>
                  <div>
                    <span className="font-medium">Customer:</span> {deposit.customer_id}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {formatDate(deposit.created_at)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {deposit.status === 'pending' && (
                  <>
                    <Button
                      size="small"
                      variant="success"
                      loading={actionLoading === `${deposit.id}-capture`}
                      onClick={() => handleAction(deposit.id, 'capture')}
                    >
                      Capture
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      loading={actionLoading === `${deposit.id}-release`}
                      onClick={() => handleAction(deposit.id, 'release')}
                    >
                      Release
                    </Button>
                  </>
                )}
                {deposit.status === 'captured' && (
                  <Button
                    size="small"
                    variant="danger"
                    loading={actionLoading === `${deposit.id}-refund`}
                    onClick={() => handleAction(deposit.id, 'refund')}
                  >
                    Refund
                  </Button>
                )}
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setSelectedDeposit(deposit)}
                >
                  Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredDeposits.length === 0 && filter !== 'all' && (
        <Card className="p-8 text-center">
          <div className="text-gray-400 text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {filter} deposits found
          </h3>
          <p className="text-gray-600">
            Try selecting a different filter or create a new deposit.
          </p>
        </Card>
      )}

      {/* Deposit Details Modal */}
      {selectedDeposit && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDeposit(null)}
          title="Deposit Details"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">ID:</span>
                <div className="font-mono text-gray-900">{selectedDeposit.id}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <div className="mt-1">{getStatusBadge(selectedDeposit.status)}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Amount:</span>
                <div className="text-lg font-semibold text-gray-900">
                  {formatAmount(selectedDeposit.amount)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Customer ID:</span>
                <div className="font-mono text-gray-900">{selectedDeposit.customer_id}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <div className="text-gray-900">{formatDate(selectedDeposit.created_at)}</div>
              </div>
              {selectedDeposit.updated_at && (
                <div>
                  <span className="font-medium text-gray-700">Updated:</span>
                  <div className="text-gray-900">{formatDate(selectedDeposit.updated_at)}</div>
                </div>
              )}
            </div>

            {selectedDeposit.payment_intent_id && (
              <div>
                <span className="font-medium text-gray-700">Payment Intent ID:</span>
                <div className="font-mono text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {selectedDeposit.payment_intent_id}
                </div>
              </div>
            )}

            {selectedDeposit.error_message && (
              <div>
                <span className="font-medium text-red-700">Error:</span>
                <div className="text-red-600 bg-red-50 p-2 rounded">
                  {selectedDeposit.error_message}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setSelectedDeposit(null)}
              >
                Close
              </Button>
              {selectedDeposit.status === 'pending' && (
                <>
                  <Button
                    variant="success"
                    loading={actionLoading === `${selectedDeposit.id}-capture`}
                    onClick={() => handleAction(selectedDeposit.id, 'capture')}
                  >
                    Capture
                  </Button>
                  <Button
                    variant="secondary"
                    loading={actionLoading === `${selectedDeposit.id}-release`}
                    onClick={() => handleAction(selectedDeposit.id, 'release')}
                  >
                    Release
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
