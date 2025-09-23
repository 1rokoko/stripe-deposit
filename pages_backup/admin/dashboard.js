/**
 * Admin Dashboard Page
 * Main admin panel with metrics and overview
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/AdminLayout';
import MetricsCard from '../../components/admin/MetricsCard';
import RecentDeposits from '../../components/admin/RecentDeposits';
import { requireAdminAuthSSR } from '../../lib/admin-auth';
import {
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveCard,
  ResponsiveHeading,
  useBreakpoint
} from '../../components/layout/ResponsiveLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';

export default function AdminDashboard({ admin }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setError('');
      } else if (response.status === 401) {
        router.push('/admin/login');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  if (loading && !metrics) {
    return (
      <AdminLayout title="Dashboard">
        <div className="loading-container">
          <div className="loading-spinner">🔄</div>
          <p>Loading dashboard data...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error && !metrics) {
    return (
      <AdminLayout title="Dashboard">
        <div className="error-container">
          <div className="error-message">
            ❌ {error}
          </div>
          <button onClick={handleRefresh} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="admin-dashboard">
        {/* Header Actions */}
        <div className="dashboard-header">
          <div className="welcome-message">
            <h2>Welcome back, {admin.email}! 👋</h2>
            <p>Here's what's happening with your deposits today.</p>
          </div>
          <div className="header-actions">
            <button 
              onClick={handleRefresh} 
              className="refresh-button"
              disabled={loading}
            >
              {loading ? '🔄' : '↻'} Refresh
            </button>
            <button 
              onClick={() => router.push('/admin/reports')}
              className="reports-button"
            >
              📊 Generate Report
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="metrics-grid">
          <MetricsCard
            title="Total Deposits"
            value={metrics?.totalDeposits || 0}
            change={metrics?.depositsChange}
            icon="💰"
            color="blue"
          />
          <MetricsCard
            title="Total Amount"
            value={`$${((metrics?.totalAmount || 0) / 100).toLocaleString()}`}
            change={metrics?.amountChange}
            icon="💵"
            color="green"
          />
          <MetricsCard
            title="Pending Deposits"
            value={metrics?.pendingDeposits || 0}
            change={metrics?.pendingChange}
            icon="⏳"
            color="orange"
          />
          <MetricsCard
            title="Success Rate"
            value={`${metrics?.successRate || 0}%`}
            change={metrics?.successRateChange}
            icon="✅"
            color="purple"
          />
        </div>

        {/* Dashboard Content */}
        <div className="dashboard-content">
          <div className="content-section">
            <div className="section-header">
              <h3>Recent Activity</h3>
              <button 
                onClick={() => router.push('/admin/deposits')}
                className="view-all-button"
              >
                View All →
              </button>
            </div>
            <RecentDeposits deposits={metrics?.recentDeposits || []} />
          </div>
          
          <div className="content-section">
            <div className="section-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions">
              <button 
                onClick={() => router.push('/admin/deposits')}
                className="action-card"
              >
                <span className="action-icon">💰</span>
                <span className="action-title">Manage Deposits</span>
                <span className="action-desc">View and manage all deposits</span>
              </button>
              
              <button 
                onClick={() => router.push('/admin/customers')}
                className="action-card"
              >
                <span className="action-icon">👥</span>
                <span className="action-title">Customer Management</span>
                <span className="action-desc">View customer information</span>
              </button>
              
              <button 
                onClick={() => router.push('/admin/reports')}
                className="action-card"
              >
                <span className="action-icon">📈</span>
                <span className="action-title">Analytics & Reports</span>
                <span className="action-desc">Generate detailed reports</span>
              </button>
              
              <button 
                onClick={() => router.push('/admin/settings')}
                className="action-card"
              >
                <span className="action-icon">⚙️</span>
                <span className="action-title">System Settings</span>
                <span className="action-desc">Configure system parameters</span>
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .admin-dashboard {
            max-width: 1200px;
            margin: 0 auto;
          }

          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e1e5e9;
          }

          .welcome-message h2 {
            margin: 0 0 5px 0;
            color: #2c3e50;
            font-size: 28px;
          }

          .welcome-message p {
            margin: 0;
            color: #7f8c8d;
            font-size: 16px;
          }

          .header-actions {
            display: flex;
            gap: 10px;
          }

          .refresh-button, .reports-button {
            padding: 10px 16px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
          }

          .refresh-button:hover, .reports-button:hover {
            background: #f8f9fa;
            border-color: #3498db;
          }

          .refresh-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .reports-button {
            background: #3498db;
            color: white;
            border-color: #3498db;
          }

          .reports-button:hover {
            background: #2980b9;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .dashboard-content {
            display: grid;
            gap: 30px;
          }

          .content-section {
            background: white;
            border-radius: 8px;
            padding: 25px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .section-header h3 {
            margin: 0;
            color: #2c3e50;
            font-size: 20px;
          }

          .view-all-button {
            background: none;
            border: none;
            color: #3498db;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
          }

          .view-all-button:hover {
            text-decoration: underline;
          }

          .quick-actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }

          .action-card {
            background: white;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .action-card:hover {
            border-color: #3498db;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }

          .action-icon {
            font-size: 24px;
          }

          .action-title {
            font-weight: 600;
            color: #2c3e50;
            font-size: 16px;
          }

          .action-desc {
            color: #7f8c8d;
            font-size: 14px;
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
            .dashboard-header {
              flex-direction: column;
              gap: 15px;
              align-items: stretch;
            }

            .header-actions {
              justify-content: stretch;
            }

            .refresh-button, .reports-button {
              flex: 1;
            }

            .metrics-grid {
              grid-template-columns: 1fr;
            }

            .quick-actions {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps = requireAdminAuthSSR;
