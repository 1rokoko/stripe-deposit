import { useState, useEffect } from 'react';
import Head from 'next/head';
import DepositForm from '../components/DepositForm';
import DepositStatus from '../components/DepositStatus';

export async function getServerSideProps() {
  return { props: {} };
}

export default function Home() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [mode, setMode] = useState('test'); // test or live

  useEffect(() => {
    // Load deposits on page load and when mode changes
    fetchDeposits();
  }, [mode]);

  const fetchDeposits = async () => {
    try {
      console.log(`🔄 Fetching deposits from ${mode} mode...`);
      const response = await fetch('/api/deposits/list', {
        headers: {
          'x-stripe-mode': mode
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits || []);
        console.log(`✅ Successfully fetched ${data.deposits?.length || 0} deposits from ${mode} mode`);
      } else {
        console.error(`Failed to fetch deposits from ${mode} mode`);
        setDeposits([]);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setDeposits([]);
    }
  };

  const handleDepositSubmit = async (formData) => {
    setLoading(true);
    setAlert(null);

    try {
      console.log(`🔄 Creating deposit in ${mode} mode...`);

      // Generate automatic customer ID
      const customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let response, result;

      if (mode === 'test') {
        // Use demo API for test mode
        const amount = Math.round(parseFloat(formData.amount) || 100);
        response = await fetch(`/api/demo/deposits/hold/${amount}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId: customerId,
            metadata: {
              demo: true,
              cardNumber: formData.cardNumber.slice(-4),
              requestedAmount: formData.amount,
            },
          }),
        });
      } else {
        // Use live API for live mode
        response = await fetch('/api/deposits/create-live', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-stripe-mode': mode
          },
          body: JSON.stringify({
            amount: formData.amount,
            customerId: customerId,
            cardNumber: formData.cardNumber,
            expMonth: formData.expMonth,
            expYear: formData.expYear,
            cvc: formData.cvc,
            metadata: {
              created_via: 'main_page',
              cardLast4: formData.cardNumber.slice(-4)
            }
          }),
        });
      }

      result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to create deposit');
      }

      // Add the new deposit to the list
      setDeposits(prev => [result.deposit, ...prev]);

      setAlert({
        type: 'success',
        message: `Deposit created successfully! ID: ${result.deposit.id}`,
      });

      console.log(`✅ Deposit created successfully in ${mode} mode: ${result.deposit.id}`);

    } catch (error) {
      console.error(`❌ Error creating deposit in ${mode} mode:`, error);
      setAlert({
        type: 'error',
        message: error.message || 'Failed to create deposit',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDepositAction = async (depositId, action) => {
    try {
      // Use demo API for deposit actions
      const response = await fetch(`/api/demo/deposits/${depositId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} deposit`);
      }

      setAlert({
        type: 'success',
        message: result.message || `Deposit ${action}d successfully`,
      });

      // Refresh deposits list
      fetchDeposits();

    } catch (error) {
      setAlert({
        type: 'error',
        message: error.message || `Failed to ${action} deposit`,
      });
    }
  };

  return (
    <>
      <Head>
        <title>Stripe Deposit Service</title>
        <meta name="description" content="Secure payment processing and deposit management" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              💳 Stripe Deposit Service
            </h1>
            <p className="text-xl text-gray-600">
              Secure payment processing and deposit management
            </p>

            {/* Mode Switcher */}
            <div className="mt-6 flex justify-center">
              <div className="bg-white rounded-lg p-1 shadow-md border">
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-medium text-gray-700 px-3">Mode:</span>
                  <button
                    onClick={() => setMode('test')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      mode === 'test'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => setMode('live')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      mode === 'live'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>
            </div>

            {/* Mode Indicator */}
            <div className="mt-4">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                mode === 'test'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {mode === 'test' ? '🔵 TEST MODE' : '🔴 LIVE MODE'}
                <span className="ml-2 text-xs">
                  {mode === 'test' ? 'Test transactions only' : 'Real transactions'}
                </span>
              </div>
            </div>
          </div>

          {/* Alert */}
          {alert && (
            <div className={`mb-6 p-4 rounded-lg ${
              alert.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="flex justify-between items-center">
                <span>{alert.message}</span>
                <button
                  onClick={() => setAlert(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Deposit Form */}
            <div>
              <DepositForm
                onSubmit={handleDepositSubmit}
                loading={loading}
                mode={mode}
              />
            </div>

            {/* Deposit Status */}
            <div>
              <DepositStatus 
                deposits={deposits}
                onAction={handleDepositAction}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-gray-500">
            <p>
              🔒 All transactions are processed securely through Stripe
            </p>
            <p className="mt-2">
              {mode === 'test'
                ? 'Test mode - No real charges are made'
                : '⚠️ Live mode - Real charges will be made'
              }
            </p>
            <div className="mt-4">
              <a
                href="/admin"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Admin Panel
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
