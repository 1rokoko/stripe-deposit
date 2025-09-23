import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/layout/ResponsiveLayout';
import DepositForm from '../components/DepositForm';
import DepositStatus from '../components/DepositStatus';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export default function HomePage() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('create');

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    try {
      const response = await fetch('/api/deposits');
      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits || []);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
    }
  };

  const handleDepositCreate = async (formData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount) * 100, // Convert to cents
          customer_id: formData.customerId,
          payment_method: {
            type: 'card',
            card: {
              number: formData.cardNumber,
              exp_month: parseInt(formData.expMonth),
              exp_year: parseInt(formData.expYear),
              cvc: formData.cvc
            }
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setAlert({
          type: 'success',
          title: 'Success!',
          message: `Deposit created successfully! ID: ${data.deposit.id}`
        });
        await fetchDeposits();
        setActiveTab('status');
      } else {
        throw new Error(data.error || 'Failed to create deposit');
      }
    } catch (error) {
      setAlert({
        type: 'error',
        title: 'Error',
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDepositAction = async (depositId, action) => {
    try {
      const response = await fetch(`/api/deposits/${depositId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setAlert({
          type: 'success',
          title: 'Success!',
          message: `Deposit ${action} completed successfully!`
        });
        await fetchDeposits();
      } else {
        throw new Error(data.error || `Failed to ${action} deposit`);
      }
    } catch (error) {
      setAlert({
        type: 'error',
        title: 'Error',
        message: error.message
      });
    }
  };

  return (
    <>
      <Head>
        <title>Stripe Deposit - Secure Payment Processing</title>
        <meta name="description" content="Secure deposit processing with Stripe integration" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-900">
                    💳 Stripe Deposit
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <a 
                    href="/admin/login" 
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Admin Panel
                  </a>
                  <Button variant="secondary" size="small">
                    Help
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Alert */}
            {alert && (
              <div className="mb-6">
                <Alert
                  type={alert.type}
                  title={alert.title}
                  message={alert.message}
                  onClose={() => setAlert(null)}
                />
              </div>
            )}

            {/* Hero Section */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Secure Deposit Processing
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Create and manage secure deposits with our Stripe-powered platform. 
                Fast, reliable, and fully compliant payment processing.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
              <div className="bg-white rounded-lg p-1 shadow-sm border">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'create'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Create Deposit
                </button>
                <button
                  onClick={() => setActiveTab('status')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'status'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  View Deposits ({deposits.length})
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-4xl mx-auto">
              {activeTab === 'create' && (
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <DepositForm onSubmit={handleDepositCreate} loading={loading} />
                  </div>
                  <div>
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">How it works</h3>
                      <div className="space-y-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold">1</span>
                          </div>
                          <div>
                            <h4 className="font-medium">Enter Details</h4>
                            <p className="text-gray-600 text-sm">Fill in the deposit amount and payment information</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold">2</span>
                          </div>
                          <div>
                            <h4 className="font-medium">Secure Processing</h4>
                            <p className="text-gray-600 text-sm">Your payment is processed securely through Stripe</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold">3</span>
                          </div>
                          <div>
                            <h4 className="font-medium">Deposit Created</h4>
                            <p className="text-gray-600 text-sm">Your deposit is held securely until capture or release</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'status' && (
                <DepositStatus 
                  deposits={deposits} 
                  onAction={handleDepositAction}
                  onRefresh={fetchDeposits}
                />
              )}
            </div>

            {/* Features Section */}
            <div className="mt-16 grid md:grid-cols-3 gap-8">
              <Card className="p-6 text-center">
                <div className="text-3xl mb-4">🔒</div>
                <h3 className="text-lg font-semibold mb-2">Secure</h3>
                <p className="text-gray-600">
                  Bank-level security with Stripe's industry-leading payment processing
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl mb-4">⚡</div>
                <h3 className="text-lg font-semibold mb-2">Fast</h3>
                <p className="text-gray-600">
                  Instant deposit creation and real-time status updates
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl mb-4">📊</div>
                <h3 className="text-lg font-semibold mb-2">Transparent</h3>
                <p className="text-gray-600">
                  Full visibility into deposit status and transaction history
                </p>
              </Card>
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center text-gray-600">
                <p>&copy; 2025 Stripe Deposit. Powered by Stripe.</p>
                <div className="mt-2 space-x-4">
                  <a href="/privacy" className="hover:text-gray-900">Privacy</a>
                  <a href="/terms" className="hover:text-gray-900">Terms</a>
                  <a href="/support" className="hover:text-gray-900">Support</a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </Layout>
    </>
  );
}
