import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function DepositStatus() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { payment_intent, payment_intent_client_secret, redirect_status } = router.query;

    if (payment_intent && payment_intent_client_secret) {
      // Check payment status
      if (redirect_status === 'succeeded') {
        setStatus('success');
        setPaymentIntent({ id: payment_intent });
      } else if (redirect_status === 'failed') {
        setStatus('failed');
        setError('Payment authentication failed');
      } else {
        setStatus('processing');
      }
    } else if (router.isReady) {
      // No payment intent in URL, redirect to home
      router.push('/');
    }
  }, [router.query, router.isReady]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing payment...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your deposit has been authorized successfully. The funds are held securely and can be captured when needed.
          </p>
          {paymentIntent && (
            <p className="text-sm text-gray-500 mb-6">
              Payment Intent: {paymentIntent.id}
            </p>
          )}
          <div className="space-y-3">
            <Link href="/" className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
              Create Another Deposit
            </Link>
            <Link href="/admin" className="block w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors">
              View Admin Panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-600 mb-6">
            {error || 'There was an issue processing your payment. Please try again.'}
          </p>
          <div className="space-y-3">
            <Link href="/" className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
              Try Again
            </Link>
            <Link href="/admin" className="block w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors">
              View Admin Panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h1>
        <p className="text-gray-600 mb-6">
          Your payment is being processed. Please wait...
        </p>
        <Link href="/" className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
