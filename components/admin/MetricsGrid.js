export default function MetricsGrid({ metrics }) {
  if (!metrics) {
    return (
      <div className="metrics-grid">
        <div className="loading">Loading metrics...</div>
      </div>
    );
  }

  const metricCards = [
    {
      title: 'Total Deposits',
      value: metrics.totalDeposits || 0,
      format: 'number',
      icon: '💰',
      color: 'blue'
    },
    {
      title: 'Total Amount',
      value: (metrics.totalAmount || 0) / 100,
      format: 'currency',
      icon: '💵',
      color: 'green'
    },
    {
      title: 'Average Amount',
      value: (metrics.averageAmount || 0) / 100,
      format: 'currency',
      icon: '📊',
      color: 'purple'
    },
    {
      title: 'Success Rate',
      value: metrics.successRate || 0,
      format: 'percentage',
      icon: '✅',
      color: 'emerald'
    },
    {
      title: 'Pending Deposits',
      value: metrics.pendingDeposits || 0,
      format: 'number',
      icon: '⏳',
      color: 'orange'
    },
    {
      title: 'Failed Deposits',
      value: metrics.failedDeposits || 0,
      format: 'number',
      icon: '❌',
      color: 'red'
    }
  ];

  const formatValue = (value, format) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${value}%`;
      case 'number':
        return value.toLocaleString();
      default:
        return value;
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      purple: 'bg-purple-50 border-purple-200 text-purple-800',
      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      orange: 'bg-orange-50 border-orange-200 text-orange-800',
      red: 'bg-red-50 border-red-200 text-red-800'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="metrics-grid">
      {metricCards.map((metric, index) => (
        <div key={index} className={`metric-card ${getColorClasses(metric.color)}`}>
          <div className="metric-header">
            <span className="metric-icon">{metric.icon}</span>
            <span className="metric-title">{metric.title}</span>
          </div>
          <div className="metric-value">
            {formatValue(metric.value, metric.format)}
          </div>
        </div>
      ))}

      <style jsx>{`
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .metric-card {
          padding: 20px;
          border-radius: 12px;
          border: 1px solid;
          background: white;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .metric-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric-icon {
          font-size: 20px;
        }

        .metric-title {
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
        }

        .loading {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: #6b7280;
          font-size: 16px;
        }

        /* Color classes */
        .bg-blue-50 { background-color: #eff6ff; }
        .border-blue-200 { border-color: #bfdbfe; }
        .text-blue-800 { color: #1e40af; }

        .bg-green-50 { background-color: #f0fdf4; }
        .border-green-200 { border-color: #bbf7d0; }
        .text-green-800 { color: #166534; }

        .bg-purple-50 { background-color: #faf5ff; }
        .border-purple-200 { border-color: #e9d5ff; }
        .text-purple-800 { color: #6b21a8; }

        .bg-emerald-50 { background-color: #ecfdf5; }
        .border-emerald-200 { border-color: #a7f3d0; }
        .text-emerald-800 { color: #065f46; }

        .bg-orange-50 { background-color: #fff7ed; }
        .border-orange-200 { border-color: #fed7aa; }
        .text-orange-800 { color: #9a3412; }

        .bg-red-50 { background-color: #fef2f2; }
        .border-red-200 { border-color: #fecaca; }
        .text-red-800 { color: #991b1b; }
      `}</style>
    </div>
  );
}
