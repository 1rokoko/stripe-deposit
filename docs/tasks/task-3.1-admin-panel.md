# Задача 3.1: Создание админ панели

## 📋 Описание
Разработать административную панель для управления депозитами: просмотр всех депозитов, фильтрация по статусу, клиентам, датам. Добавить возможность ручного capture/release депозитов.

## 🎯 Цели
- Создать удобный интерфейс для администраторов
- Обеспечить полный контроль над депозитами
- Добавить аналитику и отчетность

## 🔧 Технические требования

### 1. Структура админ панели
```
/admin
├── /dashboard          # Главная страница с метриками
├── /deposits          # Управление депозитами
├── /customers         # Управление клиентами
├── /transactions      # История транзакций
├── /settings          # Настройки системы
└── /reports           # Отчеты и аналитика
```

### 2. Компонент главной страницы админки
Файл: `pages/admin/dashboard.js`

```javascript
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/AdminLayout';
import MetricsCard from '../../components/admin/MetricsCard';
import RecentDeposits from '../../components/admin/RecentDeposits';
import { requireAdminAuth } from '../../lib/admin-auth';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDashboardData();
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
      } else {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <AdminLayout><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <h1>Admin Dashboard</h1>
        
        <div className="metrics-grid">
          <MetricsCard
            title="Total Deposits"
            value={metrics?.totalDeposits || 0}
            change={metrics?.depositsChange}
            icon="💰"
          />
          <MetricsCard
            title="Total Amount"
            value={`$${(metrics?.totalAmount / 100).toLocaleString()}`}
            change={metrics?.amountChange}
            icon="💵"
          />
          <MetricsCard
            title="Pending Deposits"
            value={metrics?.pendingDeposits || 0}
            change={metrics?.pendingChange}
            icon="⏳"
          />
          <MetricsCard
            title="Success Rate"
            value={`${metrics?.successRate}%`}
            change={metrics?.successRateChange}
            icon="✅"
          />
        </div>

        <div className="dashboard-content">
          <div className="recent-activity">
            <h2>Recent Deposits</h2>
            <RecentDeposits deposits={metrics?.recentDeposits || []} />
          </div>
          
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <button onClick={() => router.push('/admin/deposits')}>
              View All Deposits
            </button>
            <button onClick={() => router.push('/admin/reports')}>
              Generate Report
            </button>
            <button onClick={() => router.push('/admin/settings')}>
              System Settings
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps = requireAdminAuth;
```

### 3. Страница управления депозитами
Файл: `pages/admin/deposits.js`

```javascript
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DepositTable from '../../components/admin/DepositTable';
import DepositFilters from '../../components/admin/DepositFilters';
import DepositModal from '../../components/admin/DepositModal';
import { requireAdminAuth } from '../../lib/admin-auth';

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([]);
  const [filteredDeposits, setFilteredDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    customerId: '',
    amountMin: '',
    amountMax: ''
  });

  useEffect(() => {
    fetchDeposits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [deposits, filters]);

  const fetchDeposits = async () => {
    try {
      const response = await fetch('/api/admin/deposits', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...deposits];

    if (filters.status !== 'all') {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(d => 
        new Date(d.created_at) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(d => 
        new Date(d.created_at) <= new Date(filters.dateTo)
      );
    }

    if (filters.customerId) {
      filtered = filtered.filter(d => 
        d.customer_id.includes(filters.customerId)
      );
    }

    if (filters.amountMin) {
      filtered = filtered.filter(d => d.amount >= filters.amountMin * 100);
    }

    if (filters.amountMax) {
      filtered = filtered.filter(d => d.amount <= filters.amountMax * 100);
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
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      alert('An error occurred');
    }
  };

  return (
    <AdminLayout>
      <div className="admin-deposits">
        <div className="page-header">
          <h1>Deposit Management</h1>
          <div className="header-actions">
            <button onClick={() => fetchDeposits()}>
              Refresh
            </button>
            <button onClick={() => window.open('/admin/reports/deposits')}>
              Export Report
            </button>
          </div>
        </div>

        <DepositFilters 
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="deposits-summary">
          <div className="summary-item">
            <span>Total: {filteredDeposits.length}</span>
          </div>
          <div className="summary-item">
            <span>
              Amount: ${filteredDeposits.reduce((sum, d) => sum + d.amount, 0) / 100}
            </span>
          </div>
        </div>

        {loading ? (
          <div>Loading deposits...</div>
        ) : (
          <DepositTable
            deposits={filteredDeposits}
            onDepositSelect={setSelectedDeposit}
            onDepositAction={handleDepositAction}
          />
        )}

        {selectedDeposit && (
          <DepositModal
            deposit={selectedDeposit}
            onClose={() => setSelectedDeposit(null)}
            onAction={handleDepositAction}
          />
        )}
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps = requireAdminAuth;
```

### 4. Компонент таблицы депозитов
Файл: `components/admin/DepositTable.js`

```javascript
import { useState } from 'react';

export default function DepositTable({ deposits, onDepositSelect, onDepositAction }) {
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedDeposits = [...deposits].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const getStatusBadge = (status) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      captured: 'bg-green-100 text-green-800',
      released: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${statusColors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatAmount = (amount) => {
    return `$${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="deposit-table-container">
      <table className="deposit-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('id')}>
              ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('amount')}>
              Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('status')}>
              Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('customer_id')}>
              Customer {sortField === 'customer_id' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('created_at')}>
              Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedDeposits.map((deposit) => (
            <tr key={deposit.id} onClick={() => onDepositSelect(deposit)}>
              <td>{deposit.id.substring(0, 8)}...</td>
              <td>{formatAmount(deposit.amount)}</td>
              <td>{getStatusBadge(deposit.status)}</td>
              <td>{deposit.customer?.name || deposit.customer_id}</td>
              <td>{formatDate(deposit.created_at)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className="action-buttons">
                  {deposit.status === 'pending' && (
                    <>
                      <button
                        className="btn-capture"
                        onClick={() => onDepositAction(deposit.id, 'capture')}
                      >
                        Capture
                      </button>
                      <button
                        className="btn-release"
                        onClick={() => onDepositAction(deposit.id, 'release')}
                      >
                        Release
                      </button>
                    </>
                  )}
                  {deposit.status === 'captured' && (
                    <button
                      className="btn-refund"
                      onClick={() => onDepositAction(deposit.id, 'refund')}
                    >
                      Refund
                    </button>
                  )}
                  <button
                    className="btn-view"
                    onClick={() => onDepositSelect(deposit)}
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 5. API endpoints для админки
Файл: `pages/api/admin/dashboard.js`

```javascript
import { requireAdminAuth } from '../../../lib/admin-auth';
import { Database } from '../../../lib/database';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Получение метрик за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalDeposits,
      totalAmount,
      pendingDeposits,
      recentDeposits,
      successRate
    ] = await Promise.all([
      Database.getDepositCount(),
      Database.getTotalAmount(),
      Database.getPendingDepositsCount(),
      Database.getRecentDeposits(10),
      Database.getSuccessRate(thirtyDaysAgo)
    ]);

    const metrics = {
      totalDeposits,
      totalAmount,
      pendingDeposits,
      recentDeposits,
      successRate,
      // Можно добавить сравнение с предыдущим периодом
      depositsChange: '+5.2%',
      amountChange: '+12.1%',
      pendingChange: '-2.3%',
      successRateChange: '+1.1%'
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default requireAdminAuth(handler);
```

### 6. Админ авторизация
Файл: `lib/admin-auth.js`

```javascript
import jwt from 'jsonwebtoken';

const ADMIN_USERS = [
  { id: 'admin1', email: 'admin@stripe-deposit.com', role: 'admin' }
];

export function requireAdminAuth(handler) {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No admin token provided' });
      }
      
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Проверка, что пользователь является админом
      const adminUser = ADMIN_USERS.find(u => u.id === decoded.id && u.role === 'admin');
      if (!adminUser) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      req.admin = adminUser;
      return await handler(req, res);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
  };
}

// Для getServerSideProps
export const requireAdminAuth = async (context) => {
  const { req } = context;
  
  // Проверка admin cookie или redirect на login
  const adminToken = req.cookies.adminToken;
  
  if (!adminToken) {
    return {
      redirect: {
        destination: '/admin/login',
        permanent: false,
      },
    };
  }
  
  try {
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
    const adminUser = ADMIN_USERS.find(u => u.id === decoded.id && u.role === 'admin');
    
    if (!adminUser) {
      return {
        redirect: {
          destination: '/admin/login',
          permanent: false,
        },
      };
    }
    
    return {
      props: {
        admin: adminUser
      }
    };
  } catch (error) {
    return {
      redirect: {
        destination: '/admin/login',
        permanent: false,
      },
    };
  }
};
```

## 📝 Шаги выполнения

### Шаг 1: Создание структуры админки
1. Создать папку `/admin` в pages
2. Создать компоненты в `/components/admin`
3. Настроить роутинг

### Шаг 2: Реализация авторизации
1. Создать admin auth middleware
2. Реализовать login страницу
3. Настроить защищенные роуты

### Шаг 3: Создание основных страниц
1. Dashboard с метриками
2. Управление депозитами
3. Просмотр клиентов

### Шаг 4: Добавление функционала
1. Фильтрация и сортировка
2. Bulk операции
3. Export функции

### Шаг 5: Стилизация и UX
1. Responsive дизайн
2. Loading states
3. Error handling

## ✅ Критерии готовности
- [ ] Админ панель доступна по /admin
- [ ] Авторизация работает
- [ ] Dashboard показывает метрики
- [ ] Управление депозитами функционирует
- [ ] Фильтрация и поиск работают
- [ ] Bulk операции доступны

## 🚨 Важные замечания
- Обеспечить безопасность админ панели
- Логировать все админ действия
- Добавить подтверждения для критических операций
- Ограничить доступ по IP если необходимо
- Регулярно аудитировать админ активность

## 📚 Полезные ссылки
- [Next.js Authentication](https://nextjs.org/docs/authentication)
- [React Admin](https://marmelab.com/react-admin/)
- [Admin Dashboard Design](https://dribbble.com/tags/admin_dashboard)

## 🔍 Проверка результата
После выполнения:
1. Админы могут управлять всеми депозитами
2. Метрики отображаются корректно
3. Фильтрация работает быстро
4. Bulk операции выполняются безопасно
