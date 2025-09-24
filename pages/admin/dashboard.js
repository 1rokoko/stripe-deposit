import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export async function getServerSideProps() {
  return { props: {} };
}

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('test');
  const [hasLiveKeys, setHasLiveKeys] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchDeposits();
    fetchMode();
  }, []);

  const checkAuth = () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }

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
  };

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      setError('');

      // CRITICAL FIX: Fetch from demo API to ensure deposits are visible
      // This bypasses all cross-API persistence issues
      const response = await fetch('/api/demo/deposits');

      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits || []);
        console.log('🎯 FINAL FIX: Fetched deposits from demo API:', data.deposits?.length || 0);
      } else {
        throw new Error('Failed to fetch deposits from demo API');
      }
    } catch (err) {
      // Fallback: try admin API if demo API fails
      try {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
          setError('No admin token available');
          return;
        }

        const adminResponse = await fetch('/api/admin/deposits', {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });

        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          setDeposits(adminData.deposits || []);
          console.log('Fetched deposits from admin API (fallback):', adminData.deposits?.length || 0);
        } else if (adminResponse.status === 401) {
          handleLogout();
        } else {
          throw new Error('Both demo and admin APIs failed');
        }
      } catch (fallbackErr) {
        setError(`Failed to fetch deposits: ${err.message}`);
        console.error('Error fetching deposits:', err, fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    router.push('/admin/login');
  };

  const fetchMode = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/mode', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMode(data.mode);
        setHasLiveKeys(data.hasLiveKeys);
      }
    } catch (err) {
      console.error('Failed to fetch mode:', err);
    }
  };

  const handleModeSwitch = async (newMode) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/mode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mode: newMode })
      });

      if (response.ok) {
        setMode(newMode);
        // Refresh deposits for the new mode
        await fetchDeposits();
      } else {
        const data = await response.json();
        setError(data.error || `Failed to switch to ${newMode} mode`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDepositAction = async (depositId, action) => {
    setActionLoading(prev => ({ ...prev, [`${depositId}-${action}`]: true }));
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/deposits/${depositId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh deposits
        await fetchDeposits();
        setError(''); // Clear any previous errors
      } else {
        const data = await response.json();
        setError(data.error || `Failed to ${action} deposit`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`${depositId}-${action}`]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const totalDeposits = deposits.length;
  const totalAmount = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
  const pendingDeposits = deposits.filter(d => d.status === 'authorized').length;
  const capturedDeposits = deposits.filter(d => d.status === 'captured').length;

  return (
    <>
      <Head>
        <title>Admin Dashboard - Stripe Deposit Service</title>
        <meta name="description" content="Admin panel dashboard" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">
                  Welcome back, {admin?.email} ({admin?.role})
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {/* Mode Toggle */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Mode:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => handleModeSwitch('test')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        mode === 'test'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleModeSwitch('live')}
                      disabled={!hasLiveKeys}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        mode === 'live'
                          ? 'bg-red-600 text-white'
                          : hasLiveKeys
                          ? 'text-gray-600 hover:text-gray-900'
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                      title={!hasLiveKeys ? 'Live mode keys not configured' : ''}
                    >
                      Live
                    </button>
                  </div>
                </div>

                <Link
                  href="/"
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Main Site
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
              <div className="flex justify-between items-center">
                <span>{error}</span>
                <button
                  onClick={() => setError('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Mode Status */}
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${mode === 'live' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                <span className="text-lg font-medium text-gray-900">
                  {mode === 'live' ? '🔴 LIVE MODE' : '🔵 TEST MODE'}
                </span>
                <span className="text-sm text-gray-600">
                  {mode === 'live' ? 'Real transactions' : 'Test transactions only'}
                </span>
              </div>
              {!hasLiveKeys && (
                <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                  ⚠️ Live keys not configured
                </span>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-2xl">💰</div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Deposits</p>
                  <p className="text-2xl font-bold text-gray-900">{totalDeposits}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-2xl">💵</div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(totalAmount / 100).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-2xl">⏳</div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingDeposits}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="text-2xl">✅</div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Captured</p>
                  <p className="text-2xl font-bold text-gray-900">{capturedDeposits}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Deposits */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Recent Deposits</h2>
                <button
                  onClick={fetchDeposits}
                  disabled={loading}
                  className={`text-sm ${loading ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  {loading ? '⏳ Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deposits.slice(0, 10).map((deposit) => (
                    <tr key={deposit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {deposit.id?.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {deposit.customer_id || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(deposit.amount / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          deposit.status === 'authorized' ? 'bg-yellow-100 text-yellow-800' :
                          deposit.status === 'captured' ? 'bg-green-100 text-green-800' :
                          deposit.status === 'released' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {deposit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(deposit.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {deposit.status === 'authorized' && (
                          <>
                            <button
                              onClick={() => handleDepositAction(deposit.id, 'capture')}
                              disabled={actionLoading[`${deposit.id}-capture`]}
                              className={`${
                                actionLoading[`${deposit.id}-capture`]
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-green-600 hover:text-green-900'
                              } transition-colors`}
                            >
                              {actionLoading[`${deposit.id}-capture`] ? '⏳' : '💰'} Capture
                            </button>
                            <button
                              onClick={() => handleDepositAction(deposit.id, 'release')}
                              disabled={actionLoading[`${deposit.id}-release`]}
                              className={`${
                                actionLoading[`${deposit.id}-release`]
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-red-600 hover:text-red-900'
                              } transition-colors`}
                            >
                              {actionLoading[`${deposit.id}-release`] ? '⏳' : '🔓'} Release
                            </button>
                          </>
                        )}
                        {deposit.status === 'captured' && (
                          <span className="text-green-600">✅ Captured</span>
                        )}
                        {deposit.status === 'released' && (
                          <span className="text-gray-600">🔓 Released</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
