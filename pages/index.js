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

  useEffect(() => {
    // Load demo deposits on page load
    fetchDemoDeposits();
  }, []);

  const fetchDemoDeposits = async () => {
    try {
      const response = await fetch('/api/demo/deposits');
      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits || []);
      }
    } catch (error) {
      console.error('Error fetching demo deposits:', error);
    }
  };

  const handleDepositSubmit = async (formData) => {
    setLoading(true);
    setAlert(null);

    try {
      // Use the amount from the form, default to 100 if not specified
      const amount = Math.round(parseFloat(formData.amount) || 100);
      const validAmounts = [100, 200];
      const holdAmount = validAmounts.includes(amount) ? amount : 100;

      const response = await fetch(`/api/demo/deposits/hold/${holdAmount}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          metadata: {
            cardNumber: formData.cardNumber.slice(-4), // Only store last 4 digits
            requestedAmount: formData.amount,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create deposit');
      }

      // Add the new deposit to the list
      setDeposits(prev => [result.deposit, ...prev]);

      setAlert({
        type: 'success',
        message: `Deposit created successfully! ID: ${result.deposit.id}`,
      });

    } catch (error) {
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

      setAlert({
        type: 'success',
        message: result.message || `Deposit ${action}d successfully`,
      });

      // Refresh deposits list
      // In a real app, you'd update the specific deposit in the state
      
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
              Demo mode - No real charges are made
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
