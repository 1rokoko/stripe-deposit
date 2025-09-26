/**
 * Deposit Modal Component
 * Detailed view and actions for individual deposits
 */

import { useState } from 'react';
import { formatCurrency } from '../../utils/currency';

export default function DepositModal({ deposit, onClose, onAction }) {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState('');

  const handleAction = async (action, data = {}) => {
    setLoading(true);
    setActionType(action);
    
    try {
      await onAction(deposit.id, action, data);
    } catch (error) {
      console.error('Action error:', error);
    } finally {
      setLoading(false);
      setActionType('');
    }
  };

  const formatAmount = (amount, currency = 'usd') => {
    try {
      // Format with correct currency using imported utility
      return formatCurrency(amount, currency);
    } catch (error) {
      // Fallback to USD if currency is not supported
      console.warn('Currency not supported, falling back to USD:', currency);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount / 100);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusInfo = (status) => {
    const statusConfig = {
      pending: { color: '#f59e0b', icon: '⏳', label: 'Pending', description: 'Awaiting capture or release' },
      captured: { color: '#10b981', icon: '✅', label: 'Captured', description: 'Funds have been captured' },
      released: { color: '#3b82f6', icon: '🔄', label: 'Released', description: 'Authorization has been released' },
      failed: { color: '#ef4444', icon: '❌', label: 'Failed', description: 'Payment failed to process' },
      canceled: { color: '#6b7280', icon: '🚫', label: 'Canceled', description: 'Payment was canceled' },
      refunded: { color: '#8b5cf6', icon: '↩️', label: 'Refunded', description: 'Funds have been refunded' }
    };
    return statusConfig[status] || statusConfig.pending;
  };

  const statusInfo = getStatusInfo(deposit.status);

  const canCapture = deposit.status === 'pending';
  const canRelease = deposit.status === 'pending';
  const canRefund = deposit.status === 'captured';
  const canCancel = deposit.status === 'pending';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <h2>Deposit Details</h2>
            <div className="deposit-id">#{deposit.id}</div>
          </div>
          <button onClick={onClose} className="close-button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Status and Amount */}
          <div className="info-section">
            <div className="status-card">
              <div className="status-header">
                <span className="status-icon" style={{ color: statusInfo.color }}>
                  {statusInfo.icon}
                </span>
                <div className="status-info">
                  <div className="status-label">{statusInfo.label}</div>
                  <div className="status-description">{statusInfo.description}</div>
                </div>
              </div>
              <div className="amount-display">
                {formatAmount(deposit.amount, deposit.currency)}
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="info-section">
            <h3>Basic Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Payment Intent ID</label>
                <div className="info-value monospace">{deposit.payment_intent_id}</div>
              </div>
              
              {deposit.payment_method_id && (
                <div className="info-item">
                  <label>Payment Method ID</label>
                  <div className="info-value monospace">{deposit.payment_method_id}</div>
                </div>
              )}
              
              <div className="info-item">
                <label>Customer ID</label>
                <div className="info-value">{deposit.customer_id || 'N/A'}</div>
              </div>
              
              <div className="info-item">
                <label>Created</label>
                <div className="info-value">{formatDate(deposit.created_at)}</div>
              </div>
              
              {deposit.updated_at && deposit.updated_at !== deposit.created_at && (
                <div className="info-item">
                  <label>Last Updated</label>
                  <div className="info-value">{formatDate(deposit.updated_at)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          {deposit.customer && (
            <div className="info-section">
              <h3>Customer Information</h3>
              <div className="info-grid">
                {deposit.customer.name && (
                  <div className="info-item">
                    <label>Name</label>
                    <div className="info-value">{deposit.customer.name}</div>
                  </div>
                )}
                
                {deposit.customer.email && (
                  <div className="info-item">
                    <label>Email</label>
                    <div className="info-value">{deposit.customer.email}</div>
                  </div>
                )}
                
                {deposit.customer.phone && (
                  <div className="info-item">
                    <label>Phone</label>
                    <div className="info-value">{deposit.customer.phone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          {deposit.metadata && Object.keys(deposit.metadata).length > 0 && (
            <div className="info-section">
              <h3>Metadata</h3>
              <div className="metadata-list">
                {Object.entries(deposit.metadata).map(([key, value]) => (
                  <div key={key} className="metadata-item">
                    <span className="metadata-key">{key}:</span>
                    <span className="metadata-value">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction History */}
          {deposit.history && deposit.history.length > 0 && (
            <div className="info-section">
              <h3>Transaction History</h3>
              <div className="history-list">
                {deposit.history.map((event, index) => (
                  <div key={index} className="history-item">
                    <div className="history-timestamp">
                      {formatDate(event.timestamp)}
                    </div>
                    <div className="history-event">
                      <span className="event-type">{event.type}</span>
                      {event.description && (
                        <span className="event-description">{event.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="action-buttons">
            {canCapture && (
              <button
                onClick={() => handleAction('capture')}
                disabled={loading}
                className="action-btn capture"
              >
                {loading && actionType === 'capture' ? '⏳' : '✅'} Capture
              </button>
            )}
            
            {canRelease && (
              <button
                onClick={() => handleAction('release')}
                disabled={loading}
                className="action-btn release"
              >
                {loading && actionType === 'release' ? '⏳' : '🔄'} Release
              </button>
            )}
            
            {canRefund && (
              <button
                onClick={() => handleAction('refund')}
                disabled={loading}
                className="action-btn refund"
              >
                {loading && actionType === 'refund' ? '⏳' : '↩️'} Refund
              </button>
            )}
            
            {canCancel && (
              <button
                onClick={() => handleAction('cancel')}
                disabled={loading}
                className="action-btn cancel"
              >
                {loading && actionType === 'cancel' ? '⏳' : '🚫'} Cancel
              </button>
            )}
          </div>
          
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal-content {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8f9fa;
          }

          .header-left h2 {
            margin: 0 0 4px 0;
            color: #111827;
            font-size: 20px;
          }

          .deposit-id {
            font-family: 'Monaco', 'Menlo', monospace;
            color: #6b7280;
            font-size: 14px;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #6b7280;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s ease;
          }

          .close-button:hover {
            background: #e5e7eb;
            color: #374151;
          }

          .modal-body {
            padding: 24px;
            max-height: calc(90vh - 140px);
            overflow-y: auto;
          }

          .info-section {
            margin-bottom: 24px;
          }

          .info-section:last-child {
            margin-bottom: 0;
          }

          .info-section h3 {
            margin: 0 0 12px 0;
            color: #374151;
            font-size: 16px;
            font-weight: 600;
          }

          .status-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .status-header {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .status-icon {
            font-size: 24px;
          }

          .status-label {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }

          .status-description {
            font-size: 14px;
            color: #6b7280;
          }

          .amount-display {
            font-size: 28px;
            font-weight: 700;
            color: #111827;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 16px;
          }

          .info-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .info-item label {
            font-size: 12px;
            font-weight: 500;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .info-value {
            color: #111827;
            font-size: 14px;
          }

          .info-value.monospace {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
          }

          .metadata-list {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 12px;
          }

          .metadata-item {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 14px;
          }

          .metadata-item:last-child {
            margin-bottom: 0;
          }

          .metadata-key {
            font-weight: 500;
            color: #374151;
            min-width: 120px;
          }

          .metadata-value {
            color: #6b7280;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
          }

          .history-list {
            border-left: 2px solid #e5e7eb;
            padding-left: 16px;
          }

          .history-item {
            margin-bottom: 16px;
            position: relative;
          }

          .history-item::before {
            content: '';
            position: absolute;
            left: -20px;
            top: 6px;
            width: 8px;
            height: 8px;
            background: #3b82f6;
            border-radius: 50%;
          }

          .history-timestamp {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .event-type {
            font-weight: 600;
            color: #374151;
          }

          .event-description {
            color: #6b7280;
            margin-left: 8px;
          }

          .modal-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
            background: #f8f9fa;
          }

          .action-buttons {
            display: flex;
            gap: 8px;
          }

          .action-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .action-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .action-btn.capture {
            background: #10b981;
            color: white;
          }

          .action-btn.capture:hover:not(:disabled) {
            background: #059669;
          }

          .action-btn.release {
            background: #3b82f6;
            color: white;
          }

          .action-btn.release:hover:not(:disabled) {
            background: #2563eb;
          }

          .action-btn.refund {
            background: #f59e0b;
            color: white;
          }

          .action-btn.refund:hover:not(:disabled) {
            background: #d97706;
          }

          .action-btn.cancel {
            background: #ef4444;
            color: white;
          }

          .action-btn.cancel:hover:not(:disabled) {
            background: #dc2626;
          }

          .close-btn {
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
          }

          .close-btn:hover {
            background: #f3f4f6;
            border-color: #9ca3af;
          }

          @media (max-width: 768px) {
            .modal-content {
              margin: 10px;
              max-height: calc(100vh - 20px);
            }

            .info-grid {
              grid-template-columns: 1fr;
            }

            .status-card {
              flex-direction: column;
              gap: 12px;
              text-align: center;
            }

            .modal-footer {
              flex-direction: column;
              gap: 12px;
            }

            .action-buttons {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
