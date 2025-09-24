import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import DepositStatus from '../components/DepositStatus';

export async function getServerSideProps() {
  return { props: {} };
}

export default function DepositsPage() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/demo/deposits');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch deposits');
      }
      
      setDeposits(data.deposits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositAction = async (depositId, action) => {
    try {
      const response = await fetch(`/api/demo/deposits/${depositId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} deposit`);
      }

      // Refresh the deposits list
      await fetchDeposits();
      
    } catch (error) {
      setError(error.message || `Failed to ${action} deposit`);
    }
  };

  return (
    <>
      <Head>
        <title>Deposits - Stripe Deposit Service</title>
        <meta name="description" content="View and manage your deposits" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                💳 Deposit Management
              </h1>
              <p className="text-gray-600">
                View and manage all deposits
              </p>
            </div>
            <Link 
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Home
            </Link>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
              <div className="flex justify-between items-center">
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading deposits...</p>
            </div>
          )}

          {/* Deposits List */}
          {!loading && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  All Deposits ({deposits.length})
                </h2>
                <button
                  onClick={fetchDeposits}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
              
              <DepositStatus 
                deposits={deposits}
                onAction={handleDepositAction}
                showAll={true}
              />
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center text-gray-500">
            <p>
              🔒 All transactions are processed securely through Stripe
            </p>
            <p className="mt-2">
              Demo mode - No real charges are made
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
