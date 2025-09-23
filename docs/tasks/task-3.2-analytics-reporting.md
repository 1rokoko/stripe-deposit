# Задача 3.2: Аналитика и отчетность

## 📋 Описание
Добавить систему аналитики: статистика по депозитам (общая сумма, количество, средняя сумма), графики по времени, отчеты по клиентам. Интеграция с Google Analytics или подобными сервисами.

## 🎯 Цели
- Создать comprehensive аналитику
- Обеспечить data-driven принятие решений
- Автоматизировать отчетность

## 🔧 Технические требования

### 1. Analytics Dashboard
Файл: `pages/admin/analytics.js`

```javascript
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Chart from '../../components/admin/Chart';
import MetricsGrid from '../../components/admin/MetricsGrid';
import DateRangePicker from '../../components/admin/DateRangePicker';
import { requireAdminAuth } from '../../lib/admin-auth';

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <AdminLayout><div>Loading analytics...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="analytics-page">
        <div className="page-header">
          <h1>Analytics & Reports</h1>
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
                    <td>{customer.name || customer.email}</td>
                    <td>{customer.depositCount}</td>
                    <td>${(customer.totalAmount / 100).toLocaleString()}</td>
                    <td>{customer.successRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </AdminLayout>
  );
}

export const getServerSideProps = requireAdminAuth;
```

### 2. Analytics API
Файл: `pages/api/admin/analytics.js`

```javascript
import { requireAdminAuth } from '../../../lib/admin-auth';
import { Database } from '../../../lib/database';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { startDate, endDate } = req.body;
    
    const analytics = await generateAnalytics(startDate, endDate);
    
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function generateAnalytics(startDate, endDate) {
  const [
    summary,
    depositsOverTime,
    revenueOverTime,
    statusDistribution,
    averageAmountOverTime,
    topCustomers,
    performance
  ] = await Promise.all([
    generateSummary(startDate, endDate),
    generateDepositsOverTime(startDate, endDate),
    generateRevenueOverTime(startDate, endDate),
    generateStatusDistribution(startDate, endDate),
    generateAverageAmountOverTime(startDate, endDate),
    generateTopCustomers(startDate, endDate),
    generatePerformanceMetrics(startDate, endDate)
  ]);

  return {
    summary,
    depositsOverTime,
    revenueOverTime,
    statusDistribution,
    averageAmountOverTime,
    topCustomers,
    performance
  };
}

async function generateSummary(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  
  const totalDeposits = deposits.length;
  const totalAmount = deposits.reduce((sum, d) => sum + d.amount, 0);
  const averageAmount = totalAmount / totalDeposits || 0;
  const successfulDeposits = deposits.filter(d => d.status === 'captured').length;
  const successRate = (successfulDeposits / totalDeposits * 100) || 0;

  return {
    totalDeposits,
    totalAmount,
    averageAmount,
    successRate,
    pendingDeposits: deposits.filter(d => d.status === 'pending').length,
    failedDeposits: deposits.filter(d => d.status === 'failed').length
  };
}

async function generateDepositsOverTime(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  
  // Группировка по дням
  const dailyData = {};
  deposits.forEach(deposit => {
    const date = new Date(deposit.created_at).toISOString().split('T')[0];
    dailyData[date] = (dailyData[date] || 0) + 1;
  });

  const labels = Object.keys(dailyData).sort();
  const data = labels.map(date => dailyData[date]);

  return {
    labels,
    datasets: [{
      label: 'Deposits',
      data,
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1
    }]
  };
}

async function generateRevenueOverTime(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  
  // Группировка по дням с суммированием
  const dailyRevenue = {};
  deposits.forEach(deposit => {
    if (deposit.status === 'captured') {
      const date = new Date(deposit.created_at).toISOString().split('T')[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + deposit.amount;
    }
  });

  const labels = Object.keys(dailyRevenue).sort();
  const data = labels.map(date => dailyRevenue[date] / 100); // Convert to dollars

  return {
    labels,
    datasets: [{
      label: 'Revenue ($)',
      data,
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };
}

async function generateStatusDistribution(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  
  const statusCounts = {};
  deposits.forEach(deposit => {
    statusCounts[deposit.status] = (statusCounts[deposit.status] || 0) + 1;
  });

  return {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF'
      ]
    }]
  };
}

async function generateTopCustomers(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  
  const customerStats = {};
  deposits.forEach(deposit => {
    const customerId = deposit.customer_id;
    if (!customerStats[customerId]) {
      customerStats[customerId] = {
        id: customerId,
        name: deposit.customer?.name,
        email: deposit.customer?.email,
        depositCount: 0,
        totalAmount: 0,
        successfulDeposits: 0
      };
    }
    
    customerStats[customerId].depositCount++;
    customerStats[customerId].totalAmount += deposit.amount;
    if (deposit.status === 'captured') {
      customerStats[customerId].successfulDeposits++;
    }
  });

  // Добавление success rate и сортировка
  const topCustomers = Object.values(customerStats)
    .map(customer => ({
      ...customer,
      successRate: Math.round(customer.successfulDeposits / customer.depositCount * 100)
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  return topCustomers;
}

async function generatePerformanceMetrics(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  const transactions = await Database.getTransactionsByDateRange(startDate, endDate);
  
  // Расчет среднего времени обработки
  const processingTimes = transactions
    .filter(t => t.type === 'capture')
    .map(t => {
      const deposit = deposits.find(d => d.id === t.deposit_id);
      if (deposit) {
        return new Date(t.created_at) - new Date(deposit.created_at);
      }
      return null;
    })
    .filter(time => time !== null);

  const avgProcessingTime = processingTimes.length > 0 
    ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
    : 0;

  // Success rate
  const successfulDeposits = deposits.filter(d => d.status === 'captured').length;
  const successRate = Math.round(successfulDeposits / deposits.length * 100) || 0;

  // Error rate
  const failedDeposits = deposits.filter(d => d.status === 'failed').length;
  const errorRate = Math.round(failedDeposits / deposits.length * 100) || 0;

  // Peak hour analysis
  const hourCounts = {};
  deposits.forEach(deposit => {
    const hour = new Date(deposit.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  const peakHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 0;

  return {
    avgProcessingTime,
    successRate,
    errorRate,
    peakHour: parseInt(peakHour)
  };
}

export default requireAdminAuth(handler);
```

### 3. Chart Component
Файл: `components/admin/Chart.js`

```javascript
import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function ChartComponent({ type, data, options = {} }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [type, data, options]);

  return (
    <div className="chart-wrapper">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

### 4. Report Generation
Файл: `pages/api/admin/reports/generate.js`

```javascript
import { requireAdminAuth } from '../../../../lib/admin-auth';
import { Database } from '../../../../lib/database';
import ExcelJS from 'exceljs';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportType, startDate, endDate, format = 'excel' } = req.body;

    let reportData;
    switch (reportType) {
      case 'deposits':
        reportData = await generateDepositsReport(startDate, endDate);
        break;
      case 'customers':
        reportData = await generateCustomersReport(startDate, endDate);
        break;
      case 'transactions':
        reportData = await generateTransactionsReport(startDate, endDate);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    if (format === 'excel') {
      const buffer = await generateExcelReport(reportData, reportType);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.xlsx"`);
      res.send(buffer);
    } else {
      res.status(200).json(reportData);
    }

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function generateDepositsReport(startDate, endDate) {
  const deposits = await Database.getDepositsByDateRange(startDate, endDate);
  
  return deposits.map(deposit => ({
    id: deposit.id,
    amount: deposit.amount / 100,
    status: deposit.status,
    customer_name: deposit.customer?.name || 'N/A',
    customer_email: deposit.customer?.email || 'N/A',
    created_at: deposit.created_at,
    captured_at: deposit.captured_at,
    released_at: deposit.released_at
  }));
}

async function generateExcelReport(data, reportType) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportType.charAt(0).toUpperCase() + reportType.slice(1));

  if (data.length > 0) {
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data
    data.forEach(row => {
      worksheet.addRow(Object.values(row));
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  return await workbook.xlsx.writeBuffer();
}

export default requireAdminAuth(handler);
```

### 5. Google Analytics Integration
Файл: `lib/analytics.js`

```javascript
// Google Analytics 4 integration
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

// Track page views
export const pageview = (url) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Track custom events
export const event = ({ action, category, label, value }) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track deposit events
export const trackDeposit = (action, depositId, amount) => {
  event({
    action: `deposit_${action}`,
    category: 'Deposits',
    label: depositId,
    value: amount
  });
};

// Track user events
export const trackUser = (action, userId) => {
  event({
    action: `user_${action}`,
    category: 'Users',
    label: userId
  });
};
```

## 📝 Шаги выполнения

### Шаг 1: Установка зависимостей
```bash
npm install chart.js exceljs
```

### Шаг 2: Создание analytics API
1. Создать endpoints для аналитики
2. Реализовать data aggregation
3. Добавить caching для производительности

### Шаг 3: Создание dashboard
1. Создать charts компоненты
2. Реализовать interactive filters
3. Добавить export функции

### Шаг 4: Интеграция с Google Analytics
1. Настроить GA4
2. Добавить event tracking
3. Создать custom dimensions

### Шаг 5: Report generation
1. Реализовать Excel export
2. Добавить PDF generation
3. Создать scheduled reports

## ✅ Критерии готовности
- [ ] Analytics dashboard работает
- [ ] Charts отображаются корректно
- [ ] Report generation функционирует
- [ ] Google Analytics интегрирован
- [ ] Export в Excel/PDF работает
- [ ] Performance metrics собираются

## 🧪 Тестирование

### Тестирование analytics API
```bash
curl -X POST https://stripe-deposit.vercel.app/api/admin/analytics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-token" \
  -d '{"startDate": "2024-01-01", "endDate": "2024-01-31"}'
```

## 🚨 Важные замечания
- Кешировать тяжелые analytics запросы
- Оптимизировать database queries
- Не перегружать dashboard данными
- Регулярно архивировать старые данные
- Мониторить производительность analytics

## 📚 Полезные ссылки
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [Google Analytics 4](https://developers.google.com/analytics/devguides/collection/ga4)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)

## 🔍 Проверка результата
После выполнения:
1. Comprehensive analytics доступна
2. Charts загружаются быстро
3. Reports генерируются корректно
4. Google Analytics отслеживает события
