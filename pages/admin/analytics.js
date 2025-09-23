import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Chart from '../../components/admin/Chart';
import MetricsGrid from '../../components/admin/MetricsGrid';
import DateRangePicker from '../../components/admin/DateRangePicker';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No admin token found');
      }

      const response = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalytics(data);
      toast.success('Analytics data updated successfully');
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error.message);
      toast.error(`Failed to fetch analytics: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    try {
      setExporting(true);

      const response = await fetch(`/api/admin/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          reportType: 'analytics',
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          format
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Report exported successfully as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Failed to export report: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Analytics">
        <div className="flex items-center justify-center min-h-96">
          <LoadingSpinner size="lg" overlay={false} />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Analytics">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="text-error-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error loading analytics</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button
              onClick={fetchAnalytics}
              variant="primary"
              loading={loading}
            >
              Retry
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Analytics & Reports">
      <div className="analytics-page">
        <div className="page-header">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => handleExport('csv')}
                loading={exporting}
                icon="📊"
              >
                Export CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleExport('xlsx')}
                loading={exporting}
                icon="📈"
              >
                Export Excel
              </Button>
              <Button
                variant="primary"
                onClick={fetchAnalytics}
                loading={loading}
                icon="🔄"
              >
                Refresh
              </Button>
            </div>
          </div>
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={setDateRange}
          />
        </div>

        <MetricsGrid metrics={analytics?.summary} />

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Deposits Over Time</h3>
            <Chart
              type="line"
              data={analytics?.depositsOverTime}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>

          <div className="chart-container">
            <h3>Revenue Over Time</h3>
            <Chart
              type="bar"
              data={analytics?.revenueOverTime}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return '$' + value.toLocaleString();
                      }
                    }
                  }
                }
              }}
            />
          </div>

          <div className="chart-container">
            <h3>Status Distribution</h3>
            <Chart
              type="doughnut"
              data={analytics?.statusDistribution}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          </div>

          <div className="chart-container">
            <h3>Average Deposit Amount</h3>
            <Chart
              type="line"
              data={analytics?.averageAmountOverTime}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return '$' + value.toLocaleString();
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="detailed-reports">
          <div className="top-customers">
            <h3>Top Customers</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Deposits</th>
                    <th>Total Amount</th>
                    <th>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.topCustomers?.map(customer => (
                    <tr key={customer.id}>
                      <td>
                        <div className="customer-info">
                          <div className="customer-name">{customer.name}</div>
                          <div className="customer-email">{customer.email}</div>
                        </div>
                      </td>
                      <td>{customer.depositCount}</td>
                      <td>${(customer.totalAmount / 100).toLocaleString()}</td>
                      <td>
                        <span className={`success-rate ${customer.successRate >= 80 ? 'high' : customer.successRate >= 60 ? 'medium' : 'low'}`}>
                          {customer.successRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="performance-metrics">
            <h3>Performance Metrics</h3>
            <div className="metrics-list">
              <div className="metric-item">
                <span>Average Processing Time</span>
                <span>{analytics?.performance?.avgProcessingTime}ms</span>
              </div>
              <div className="metric-item">
                <span>Success Rate</span>
                <span>{analytics?.performance?.successRate}%</span>
              </div>
              <div className="metric-item">
                <span>Error Rate</span>
                <span>{analytics?.performance?.errorRate}%</span>
              </div>
              <div className="metric-item">
                <span>Peak Hour</span>
                <span>{analytics?.performance?.peakHour}:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .analytics-page {
          padding: 24px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .page-header h1 {
          font-size: 32px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .loading-container, .error-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
          flex-direction: column;
          gap: 16px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          text-align: center;
          padding: 32px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #991b1b;
        }

        .retry-button {
          margin-top: 16px;
          padding: 8px 16px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .chart-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-container h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .detailed-reports {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .top-customers, .performance-metrics {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .top-customers h3, .performance-metrics h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        th {
          font-weight: 600;
          color: #374151;
          background: #f9fafb;
        }

        .customer-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .customer-name {
          font-weight: 500;
          color: #111827;
        }

        .customer-email {
          font-size: 12px;
          color: #6b7280;
        }

        .success-rate {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .success-rate.high {
          background: #d1fae5;
          color: #065f46;
        }

        .success-rate.medium {
          background: #fef3c7;
          color: #92400e;
        }

        .success-rate.low {
          background: #fee2e2;
          color: #991b1b;
        }

        .metrics-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .metric-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .metric-item:last-child {
          border-bottom: none;
        }

        .metric-item span:first-child {
          color: #6b7280;
          font-size: 14px;
        }

        .metric-item span:last-child {
          font-weight: 600;
          color: #111827;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .charts-grid {
            grid-template-columns: 1fr;
          }

          .detailed-reports {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
