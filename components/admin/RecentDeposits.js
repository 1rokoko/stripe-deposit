/**
 * Recent Deposits Component
 * Displays a list of recent deposit activities
 */

import { useState } from 'react';
import Link from 'next/link';

export default function RecentDeposits({ deposits = [] }) {
  const [expandedDeposit, setExpandedDeposit] = useState(null);

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

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const toggleExpanded = (depositId) => {
    setExpandedDeposit(expandedDeposit === depositId ? null : depositId);
  };

  if (!deposits || deposits.length === 0) {
    return (
      <div className="recent-deposits empty">
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No recent deposits</h3>
          <p>New deposits will appear here when they are created.</p>
        </div>

        <style jsx>{`
          .recent-deposits.empty {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            padding: 40px 20px;
            text-align: center;
          }

          .empty-state {
            max-width: 300px;
            margin: 0 auto;
          }

          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }

          .empty-state h3 {
            margin: 0 0 8px 0;
            color: #495057;
            font-size: 18px;
          }

          .empty-state p {
            margin: 0;
            color: #6c757d;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="recent-deposits">
      <div className="deposits-list">
        {deposits.map((deposit) => (
          <div 
            key={deposit.id} 
            className={`deposit-item ${expandedDeposit === deposit.id ? 'expanded' : ''}`}
          >
            <div className="deposit-main" onClick={() => toggleExpanded(deposit.id)}>
              <div className="deposit-info">
                <div className="deposit-header">
                  <div className="deposit-id">
                    #{deposit.id.substring(0, 8)}...
                  </div>
                  <div className="deposit-time">
                    {formatDate(deposit.created_at)}
                  </div>
                </div>
                
                <div className="deposit-details">
                  <div className="deposit-amount">
                    {formatAmount(deposit.amount)}
                  </div>
                  <div className="deposit-customer">
                    {deposit.customer?.name || deposit.customer_id || 'Unknown Customer'}
                  </div>
                </div>
              </div>

              <div className="deposit-status">
                {getStatusBadge(deposit.status)}
              </div>

              <div className="expand-icon">
                {expandedDeposit === deposit.id ? '▼' : '▶'}
              </div>
            </div>

            {expandedDeposit === deposit.id && (
              <div className="deposit-expanded">
                <div className="expanded-content">
                  <div className="expanded-row">
                    <span className="label">Payment Intent:</span>
                    <span className="value">{deposit.payment_intent_id}</span>
                  </div>
                  
                  {deposit.payment_method_id && (
                    <div className="expanded-row">
                      <span className="label">Payment Method:</span>
                      <span className="value">{deposit.payment_method_id}</span>
                    </div>
                  )}
                  
                  <div className="expanded-row">
                    <span className="label">Created:</span>
                    <span className="value">
                      {new Date(deposit.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  {deposit.updated_at && deposit.updated_at !== deposit.created_at && (
                    <div className="expanded-row">
                      <span className="label">Last Updated:</span>
                      <span className="value">
                        {new Date(deposit.updated_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {deposit.metadata && Object.keys(deposit.metadata).length > 0 && (
                    <div className="expanded-row">
                      <span className="label">Metadata:</span>
                      <div className="metadata">
                        {Object.entries(deposit.metadata).map(([key, value]) => (
                          <div key={key} className="metadata-item">
                            <span className="metadata-key">{key}:</span>
                            <span className="metadata-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="expanded-actions">
                  <Link href={`/admin/deposits/${deposit.id}`}>
                    <a className="action-button primary">
                      👁️ View Details
                    </a>
                  </Link>
                  
                  {deposit.status === 'pending' && (
                    <>
                      <button className="action-button success">
                        ✅ Capture
                      </button>
                      <button className="action-button info">
                        🔄 Release
                      </button>
                    </>
                  )}
                  
                  {deposit.status === 'captured' && (
                    <button className="action-button warning">
                      ↩️ Refund
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {deposits.length >= 10 && (
        <div className="view-all-footer">
          <Link href="/admin/deposits">
            <a className="view-all-link">
              View all deposits →
            </a>
          </Link>
        </div>
      )}

      <style jsx>{`
        .recent-deposits {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .deposits-list {
          divide-y: 1px solid #e5e7eb;
        }

        .deposit-item {
          transition: all 0.2s ease;
        }

        .deposit-item:hover {
          background: #f8f9fa;
        }

        .deposit-main {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          cursor: pointer;
          gap: 16px;
        }

        .deposit-info {
          flex: 1;
        }

        .deposit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .deposit-id {
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }

        .deposit-time {
          font-size: 12px;
          color: #9ca3af;
        }

        .deposit-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .deposit-amount {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .deposit-customer {
          font-size: 14px;
          color: #6b7280;
        }

        .deposit-status {
          flex-shrink: 0;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
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

        .expand-icon {
          color: #9ca3af;
          font-size: 12px;
          transition: transform 0.2s ease;
        }

        .deposit-item.expanded .expand-icon {
          transform: rotate(90deg);
        }

        .deposit-expanded {
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          padding: 20px;
        }

        .expanded-content {
          margin-bottom: 16px;
        }

        .expanded-row {
          display: flex;
          margin-bottom: 8px;
          gap: 12px;
        }

        .expanded-row .label {
          font-weight: 500;
          color: #374151;
          min-width: 120px;
        }

        .expanded-row .value {
          color: #6b7280;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 13px;
        }

        .metadata {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metadata-item {
          display: flex;
          gap: 8px;
        }

        .metadata-key {
          font-weight: 500;
          color: #374151;
        }

        .metadata-value {
          color: #6b7280;
        }

        .expanded-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button.primary {
          background: #3b82f6;
          color: white;
        }

        .action-button.success {
          background: #10b981;
          color: white;
        }

        .action-button.info {
          background: #06b6d4;
          color: white;
        }

        .action-button.warning {
          background: #f59e0b;
          color: white;
        }

        .action-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .view-all-footer {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          text-align: center;
        }

        .view-all-link {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
        }

        .view-all-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .deposit-main {
            padding: 12px 16px;
          }

          .deposit-details {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .expanded-actions {
            flex-direction: column;
          }

          .action-button {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
