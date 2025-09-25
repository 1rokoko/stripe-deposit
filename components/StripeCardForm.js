import { useState, useEffect } from 'react';

const StripeCardForm = ({ onSubmit, loading, mode }) => {
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Stripe) {
      const stripeInstance = window.Stripe(
        mode === 'live' 
          ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE 
          : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      );
      setStripe(stripeInstance);

      const elementsInstance = stripeInstance.elements();
      setElements(elementsInstance);

      const cardElementInstance = elementsInstance.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': {
              color: '#aab7c4',
            },
          },
          invalid: {
            color: '#9e2146',
          },
        },
      });

      cardElementInstance.mount('#card-element');
      setCardElement(cardElementInstance);

      cardElementInstance.on('change', (event) => {
        setError(event.error ? event.error.message : null);
      });

      return () => {
        cardElementInstance.unmount();
      };
    }
  }, [mode]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !cardElement) {
      return;
    }

    setError(null);

    // Validate amount
    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue < 1 || amountValue > 10000) {
      setError('Amount must be between $1.00 and $10,000.00');
      return;
    }

    // Create payment method
    const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (paymentMethodError) {
      setError(paymentMethodError.message);
      return;
    }

    // Call the parent component's onSubmit with payment method
    onSubmit({
      amount: amountValue,
      paymentMethodId: paymentMethod.id
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Deposit Amount*
        </label>
        <input
          type="number"
          step="0.01"
          min="1"
          max="10000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          Minimum: $1.00, Maximum: $10,000.00
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information*
        </label>
        <div 
          id="card-element" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500"
        />
        {error && (
          <p className="text-sm text-red-600 mt-1">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating Deposit...' : 'Create Deposit'}
      </button>
    </form>
  );
};

export default StripeCardForm;
