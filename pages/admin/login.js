/**
 * Admin Login Page
 * Secure authentication for admin panel access
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLogin() {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token in localStorage for API calls
        localStorage.setItem('adminToken', data.token);
        
        // Redirect to admin dashboard
        router.push('/admin/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <Head>
        <title>Admin Login - Stripe Deposit</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="admin-login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>🔐 Admin Panel</h1>
            <p>Stripe Deposit Management</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={credentials.email}
                onChange={handleInputChange}
                required
                disabled={loading}
                placeholder="admin@stripe-deposit.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                placeholder="Enter your password"
              />
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? '🔄 Signing in...' : '🚀 Sign In'}
            </button>
          </form>

          <div className="login-footer">
            <div className="demo-credentials">
              <h3>Demo Credentials:</h3>
              <p><strong>Admin:</strong> admin@stripe-deposit.com / admin123</p>
              <p><strong>Manager:</strong> manager@stripe-deposit.com / manager123</p>
            </div>
          </div>
        </div>

        <style jsx>{`
          .admin-login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }

          .login-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            width: 100%;
            max-width: 400px;
          }

          .login-header {
            text-align: center;
            margin-bottom: 30px;
          }

          .login-header h1 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 28px;
          }

          .login-header p {
            margin: 0;
            color: #666;
            font-size: 16px;
          }

          .login-form {
            margin-bottom: 30px;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
          }

          .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
          }

          .form-group input:focus {
            outline: none;
            border-color: #667eea;
          }

          .form-group input:disabled {
            background-color: #f5f5f5;
            cursor: not-allowed;
          }

          .login-button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
          }

          .login-button:hover:not(:disabled) {
            transform: translateY(-2px);
          }

          .login-button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          .error-message {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #fcc;
          }

          .login-footer {
            border-top: 1px solid #eee;
            padding-top: 20px;
          }

          .demo-credentials {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            font-size: 14px;
          }

          .demo-credentials h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 16px;
          }

          .demo-credentials p {
            margin: 5px 0;
            color: #666;
          }

          .demo-credentials strong {
            color: #333;
          }

          @media (max-width: 480px) {
            .login-card {
              padding: 30px 20px;
            }
          }
        `}</style>
      </div>
    </>
  );
}

// Redirect if already logged in
export async function getServerSideProps(context) {
  const { req } = context;
  const adminToken = req.cookies?.adminToken;
  
  if (adminToken) {
    try {
      // Verify token is still valid
      const { verifyAdminToken } = require('../../lib/admin-auth');
      verifyAdminToken(adminToken);
      
      return {
        redirect: {
          destination: '/admin/dashboard',
          permanent: false,
        },
      };
    } catch (error) {
      // Token invalid, continue to login page
    }
  }
  
  return {
    props: {}
  };
}
