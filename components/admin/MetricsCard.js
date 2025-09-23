/**
 * Metrics Card Component
 * Displays key performance indicators with trend information
 */

export default function MetricsCard({ 
  title, 
  value, 
  change, 
  icon, 
  color = 'blue',
  loading = false 
}) {
  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        icon: 'bg-blue-100',
        text: 'text-blue-600',
        border: 'border-blue-200'
      },
      green: {
        bg: 'bg-green-50',
        icon: 'bg-green-100',
        text: 'text-green-600',
        border: 'border-green-200'
      },
      orange: {
        bg: 'bg-orange-50',
        icon: 'bg-orange-100',
        text: 'text-orange-600',
        border: 'border-orange-200'
      },
      purple: {
        bg: 'bg-purple-50',
        icon: 'bg-purple-100',
        text: 'text-purple-600',
        border: 'border-purple-200'
      },
      red: {
        bg: 'bg-red-50',
        icon: 'bg-red-100',
        text: 'text-red-600',
        border: 'border-red-200'
      }
    };
    return colors[color] || colors.blue;
  };

  const getChangeColor = (change) => {
    if (!change) return 'text-gray-500';
    
    const isPositive = change.startsWith('+');
    const isNegative = change.startsWith('-');
    
    if (isPositive) return 'text-green-600';
    if (isNegative) return 'text-red-600';
    return 'text-gray-500';
  };

  const getChangeIcon = (change) => {
    if (!change) return '';
    
    const isPositive = change.startsWith('+');
    const isNegative = change.startsWith('-');
    
    if (isPositive) return '↗️';
    if (isNegative) return '↘️';
    return '➡️';
  };

  const colorClasses = getColorClasses(color);

  if (loading) {
    return (
      <div className="metrics-card loading">
        <div className="card-content">
          <div className="card-header">
            <div className="skeleton skeleton-icon"></div>
            <div className="skeleton skeleton-title"></div>
          </div>
          <div className="card-body">
            <div className="skeleton skeleton-value"></div>
            <div className="skeleton skeleton-change"></div>
          </div>
        </div>
        
        <style jsx>{`
          .metrics-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e5e9;
            transition: all 0.2s ease;
          }

          .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: 4px;
          }

          .skeleton-icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
          }

          .skeleton-title {
            width: 80px;
            height: 16px;
          }

          .skeleton-value {
            width: 120px;
            height: 32px;
            margin: 12px 0 8px 0;
          }

          .skeleton-change {
            width: 60px;
            height: 14px;
          }

          .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }

          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="metrics-card">
      <div className="card-content">
        <div className="card-header">
          <div className={`card-icon ${colorClasses.icon}`}>
            {icon}
          </div>
          <div className="card-title">
            {title}
          </div>
        </div>
        
        <div className="card-body">
          <div className="card-value">
            {value}
          </div>
          
          {change && (
            <div className={`card-change ${getChangeColor(change)}`}>
              <span className="change-icon">{getChangeIcon(change)}</span>
              <span className="change-text">{change}</span>
              <span className="change-period">vs last month</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .metrics-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 1px solid #e1e5e9;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .metrics-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .card-content {
          position: relative;
          z-index: 1;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          background: ${colorClasses.bg};
          border: 1px solid ${colorClasses.border};
        }

        .card-title {
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-body {
          margin-left: 60px;
        }

        .card-value {
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .card-change {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .change-icon {
          font-size: 12px;
        }

        .change-text {
          font-weight: 600;
        }

        .change-period {
          color: #64748b;
          font-weight: 400;
          margin-left: 4px;
        }

        /* Color variants */
        .text-green-600 {
          color: #059669;
        }

        .text-red-600 {
          color: #dc2626;
        }

        .text-gray-500 {
          color: #6b7280;
        }

        .bg-blue-50 {
          background-color: #eff6ff;
        }

        .bg-blue-100 {
          background-color: #dbeafe;
        }

        .border-blue-200 {
          border-color: #bfdbfe;
        }

        .bg-green-50 {
          background-color: #f0fdf4;
        }

        .bg-green-100 {
          background-color: #dcfce7;
        }

        .border-green-200 {
          border-color: #bbf7d0;
        }

        .bg-orange-50 {
          background-color: #fff7ed;
        }

        .bg-orange-100 {
          background-color: #fed7aa;
        }

        .border-orange-200 {
          border-color: #fde68a;
        }

        .bg-purple-50 {
          background-color: #faf5ff;
        }

        .bg-purple-100 {
          background-color: #e9d5ff;
        }

        .border-purple-200 {
          border-color: #c4b5fd;
        }

        .bg-red-50 {
          background-color: #fef2f2;
        }

        .bg-red-100 {
          background-color: #fecaca;
        }

        .border-red-200 {
          border-color: #fca5a5;
        }

        @media (max-width: 768px) {
          .metrics-card {
            padding: 20px;
          }

          .card-value {
            font-size: 28px;
          }

          .card-body {
            margin-left: 0;
            margin-top: 16px;
          }

          .card-header {
            margin-bottom: 0;
          }
        }
      `}</style>
    </div>
  );
}
