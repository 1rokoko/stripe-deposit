import { useState, useEffect } from 'react';
import CurrencySelector from './CurrencySelector';
import CardNumberInput from './CardNumberInput';
import { getCurrencyConfig, validateAmount, formatCurrency, toStripeAmount } from '../utils/currency';

const StripeCardForm = ({ onSubmit, loading, mode }) => {
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [detectedCardNumber, setDetectedCardNumber] = useState('');
  const [realCardNumber, setRealCardNumber] = useState('');
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [authenticationStep, setAuthenticationStep] = useState('');
  const [cardBrand, setCardBrand] = useState('');

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
        hidePostalCode: false, // Always show postal code field
        style: {
          base: {
            fontSize: '16px',
            color: '#000000', // Black text
            fontFamily: 'system-ui, -apple-system, sans-serif',
            '::placeholder': {
              color: '#6b7280', // Gray placeholder
            },
          },
          invalid: {
            color: '#dc2626', // Red for errors
          },
          complete: {
            color: '#000000', // Black text when complete
          },
        },
      });

      cardElementInstance.mount('#card-element');
      setCardElement(cardElementInstance);

      cardElementInstance.on('change', (event) => {
        setError(event.error ? event.error.message : null);

        // Update card brand
        if (event.brand) {
          setCardBrand(event.brand);
        }

        // Note: Stripe Elements doesn't expose the full card number for security reasons
        // Currency detection will be handled by the separate CardNumberInput component
        // which captures the real card number for BIN detection
        if (event.complete && event.brand) {
          console.log('Card event:', event);
        }
      });

      return () => {
        cardElementInstance.unmount();
      };
    }
  }, [mode]);

  const handleCurrencyDetected = (detectedCurrency) => {
    console.log('🎯 Currency detected from real card number:', detectedCurrency);
    setCurrency(detectedCurrency);
  };

  const handleCardNumberChange = (cardNumber) => {
    setRealCardNumber(cardNumber);
    // Also update the detected card number for the CurrencySelector
    setDetectedCardNumber(cardNumber);
  };

  // Expose setAmount function globally for testing
  useEffect(() => {
    window.setAmountForTesting = setAmount;
    return () => {
      delete window.setAmountForTesting;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !cardElement) {
      return;
    }

    setError(null);
    setProcessing(true);
    setAuthenticationStep('Validating amount...');

    // Debug logging for amount
    console.log('🔍 Amount validation debug:', {
      amount,
      amountType: typeof amount,
      amountLength: amount ? amount.length : 'null/undefined',
      currency,
      currencyType: typeof currency,
      realCardNumber,
      detectedCardNumber
    });

    // Validate amount for selected currency
    const amountValue = parseFloat(amount);
    console.log('🔍 Parsed amount:', {
      amountValue,
      amountValueType: typeof amountValue,
      isNaN: isNaN(amountValue)
    });

    // Additional validation - ensure amount is not empty or zero
    if (!amount || amount.trim() === '' || amountValue <= 0 || isNaN(amountValue)) {
      setError('Please enter a valid deposit amount');
      setProcessing(false);
      setAuthenticationStep('');
      return;
    }

    const validation = validateAmount(amountValue, currency);
    console.log('🔍 Amount validation result:', validation);

    if (!validation.valid) {
      setError(validation.error);
      setProcessing(false);
      setAuthenticationStep('');
      return;
    }

    try {
      setAuthenticationStep('Creating payment method...');
      console.log('🔄 Creating payment method with mode:', mode);

      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          address: {
            postal_code: '10110' // Default postal code for THB cards
          }
        }
      });

      if (paymentMethodError) {
        console.error('❌ Payment method creation failed:', paymentMethodError);
        setError(paymentMethodError.message);
        setProcessing(false);
        setAuthenticationStep('');
        return;
      }

      console.log('✅ Payment method created successfully:', paymentMethod.id);

      setAuthenticationStep('Creating payment intent...');

      const requestBody = {
        amount: amountValue,
        currency: currency,
        customerId: `customer_${Date.now()}`, // Generate unique customer ID
        paymentMethodId: paymentMethod.id,
        metadata: {
          created_via: 'stripe_card_form',
          mode: mode,
          currency: currency
        }
      };

      console.log('🔄 Sending API request:', {
        url: '/api/deposits/create-intent',
        mode: mode,
        body: requestBody,
        bodyStringified: JSON.stringify(requestBody),
        amountValidation: {
          originalAmount: amount,
          parsedAmount: amountValue,
          isValidNumber: !isNaN(amountValue),
          isPositive: amountValue > 0
        }
      });

      // Create payment intent on backend
      const response = await fetch('/api/deposits/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stripe-mode': mode
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      console.log('📥 API response:', { status: response.status, result });

      if (!response.ok) {
        console.error('❌ API request failed:', { status: response.status, error: result.error });
        setError(result.error || 'Failed to create payment intent');
        setProcessing(false);
        setAuthenticationStep('');
        return;
      }

      setAuthenticationStep('Confirming payment (3D Secure authentication may be required)...');

      // Confirm payment with 3D Secure authentication support
      console.log('🔄 Confirming payment with 3D Secure support...');
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        result.paymentIntent.client_secret
      );

      if (confirmError) {
        console.error('❌ Payment confirmation failed:', confirmError);

        // Handle specific 3D Secure authentication errors
        if (confirmError.type === 'card_error') {
          if (confirmError.code === 'authentication_required') {
            setError('Authentication required. Please complete 3D Secure verification with your bank.');
          } else if (confirmError.code === 'card_declined') {
            setError(`Card declined: ${confirmError.message}`);
          } else {
            setError(confirmError.message);
          }
        } else {
          setError(confirmError.message);
        }
        setProcessing(false);
        setAuthenticationStep('');
        return;
      }

      setAuthenticationStep('Payment confirmed successfully!');
      console.log('✅ Payment confirmed successfully:', paymentIntent.status);

      // Check payment intent status
      if (paymentIntent.status === 'requires_capture') {
        // Payment authorized successfully (manual capture)
        console.log('✅ Payment authorized - ready for capture');
        setAuthenticationStep('Payment authorized successfully!');
      } else if (paymentIntent.status === 'succeeded') {
        // Payment completed successfully
        console.log('✅ Payment completed successfully');
        setAuthenticationStep('Payment completed successfully!');
      } else if (paymentIntent.status === 'requires_action') {
        // This shouldn't happen after confirmCardPayment, but handle it
        console.warn('⚠️ Payment still requires action after confirmation');
        setError('Payment requires additional authentication. Please try again.');
        setProcessing(false);
        setAuthenticationStep('');
        return;
      } else if (paymentIntent.status === 'canceled') {
        console.warn('⚠️ Payment was canceled');
        setError('Payment was canceled. Please try again.');
        setProcessing(false);
        setAuthenticationStep('');
        return;
      } else {
        console.warn('⚠️ Unexpected payment status:', paymentIntent.status);
        setError(`Unexpected payment status: ${paymentIntent.status}. Please contact support.`);
        setProcessing(false);
        setAuthenticationStep('');
        return;
      }

      // Call the parent component's onSubmit with successful payment
      onSubmit({
        amount: amountValue,
        currency: currency,
        paymentMethodId: paymentMethod.id,
        paymentIntent: paymentIntent,
        success: true,
        status: paymentIntent.status
      });

      setProcessing(false);
      setAuthenticationStep('');

    } catch (error) {
      console.error('Payment error:', error);
      setError('An unexpected error occurred. Please try again.');
      setProcessing(false);
      setAuthenticationStep('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CardNumberInput
        onCurrencyDetected={handleCurrencyDetected}
        onCardNumberChange={handleCardNumberChange}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information*
        </label>
        <div
          id="card-element"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          💡 Enter your complete card details for secure payment processing.
        </p>
        {error && (
          <p className="text-sm text-red-600 mt-1">{error}</p>
        )}
        {authenticationStep && (
          <p className="text-sm text-blue-600 mt-1">{authenticationStep}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Deposit Amount*
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ color: '#000000 !important' }}
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          {currency && (() => {
            const currencyConfig = getCurrencyConfig(currency);
            return `Minimum: ${formatCurrency(currencyConfig.minAmount, currency)}, Maximum: ${formatCurrency(currencyConfig.maxAmount, currency)}`;
          })()}
        </p>
      </div>

      <CurrencySelector
        value={currency}
        onChange={setCurrency}
        disabled={processing}
        cardNumber={realCardNumber}
        autoHide={true}
      />

      <button
        type="submit"
        disabled={loading || !stripe || processing}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? authenticationStep || 'Processing...' : loading ? 'Creating Deposit...' : 'Create Deposit'}
      </button>
    </form>
  );
};

export default StripeCardForm;
