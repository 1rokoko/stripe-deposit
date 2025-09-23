/**
 * Admin Layout Component
 * Provides consistent layout and navigation for admin pages
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';

export default function AdminLayout({ children, title = 'Admin Panel' }) {
  const [admin, setAdmin] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get admin info from localStorage
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      try {
        const payload = JSON.parse(atob(adminToken.split('.')[1]));
        setAdmin({
          id: payload.id,
          email: payload.email,
          role: payload.role
        });
      } catch (error) {
        console.error('Error parsing admin token:', error);
        handleLogout();
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    localStorage.removeItem('adminToken');
    router.push('/admin/login');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin/dashboard',
      icon: '📊',
      active: router.pathname === '/admin/dashboard'
    },
    {
      name: 'Deposits',
      href: '/admin/deposits',
      icon: '💰',
      active: router.pathname.startsWith('/admin/deposits')
    },
    {
      name: 'Customers',
      href: '/admin/customers',
      icon: '👥',
      active: router.pathname.startsWith('/admin/customers')
    },
    {
      name: 'Transactions',
      href: '/admin/transactions',
      icon: '💳',
      active: router.pathname.startsWith('/admin/transactions')
    },
    {
      name: 'Reports',
      href: '/admin/reports',
      icon: '📈',
      active: router.pathname.startsWith('/admin/reports')
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: '⚙️',
      active: router.pathname.startsWith('/admin/settings')
    }
  ];

  return (
    <>
      <Head>
        <title>{title} - Stripe Deposit Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="admin-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">🏦</span>
              {sidebarOpen && <span className="logo-text">Stripe Deposit</span>}
            </div>
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href}>
                <a className={`nav-item ${item.active ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {sidebarOpen && <span className="nav-text">{item.name}</span>}
                </a>
              </Link>
            ))}
          </nav>

          {sidebarOpen && (
            <div className="sidebar-footer">
              <div className="admin-info">
                <div className="admin-avatar">👤</div>
                <div className="admin-details">
                  <div className="admin-email">{admin?.email}</div>
                  <div className="admin-role">{admin?.role}</div>
                </div>
              </div>
              <button className="logout-button" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <header className="main-header">
            <div className="header-left">
              <h1>{title}</h1>
            </div>
            <div className="header-right">
              <div className="admin-badge">
                <span className="admin-role-badge">{admin?.role}</span>
                <span className="admin-email">{admin?.email}</span>
              </div>
            </div>
          </header>

          <div className="content-area">
            {children}
          </div>
        </main>

        <style jsx>{`
          .admin-layout {
            display: flex;
            min-height: 100vh;
            background-color: #f5f5f5;
          }

          .sidebar {
            background: #2c3e50;
            color: white;
            transition: width 0.3s ease;
            display: flex;
            flex-direction: column;
          }

          .sidebar.open {
            width: 280px;
          }

          .sidebar.closed {
            width: 70px;
          }

          .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #34495e;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .logo-icon {
            font-size: 24px;
          }

          .logo-text {
            font-size: 18px;
            font-weight: 600;
          }

          .sidebar-toggle {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 5px;
            border-radius: 4px;
          }

          .sidebar-toggle:hover {
            background: #34495e;
          }

          .sidebar-nav {
            flex: 1;
            padding: 20px 0;
          }

          .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            color: #bdc3c7;
            text-decoration: none;
            transition: all 0.2s ease;
          }

          .nav-item:hover {
            background: #34495e;
            color: white;
          }

          .nav-item.active {
            background: #3498db;
            color: white;
          }

          .nav-icon {
            font-size: 18px;
            width: 20px;
            text-align: center;
          }

          .nav-text {
            font-weight: 500;
          }

          .sidebar-footer {
            padding: 20px;
            border-top: 1px solid #34495e;
          }

          .admin-info {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
          }

          .admin-avatar {
            width: 40px;
            height: 40px;
            background: #3498db;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          }

          .admin-details {
            flex: 1;
          }

          .admin-email {
            font-size: 14px;
            color: #ecf0f1;
          }

          .admin-role {
            font-size: 12px;
            color: #bdc3c7;
            text-transform: uppercase;
          }

          .logout-button {
            width: 100%;
            padding: 10px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s ease;
          }

          .logout-button:hover {
            background: #c0392b;
          }

          .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
          }

          .main-header {
            background: white;
            padding: 20px 30px;
            border-bottom: 1px solid #e1e5e9;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .header-left h1 {
            margin: 0;
            color: #2c3e50;
            font-size: 24px;
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 20px;
          }

          .admin-badge {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .admin-role-badge {
            background: #3498db;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 600;
          }

          .content-area {
            flex: 1;
            padding: 30px;
            overflow-y: auto;
          }

          @media (max-width: 768px) {
            .sidebar.open {
              width: 100%;
              position: fixed;
              z-index: 1000;
              height: 100vh;
            }

            .main-content {
              width: 100%;
            }

            .main-header {
              padding: 15px 20px;
            }

            .content-area {
              padding: 20px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
