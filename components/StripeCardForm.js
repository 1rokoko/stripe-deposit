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

  // Function to detect test card patterns
  const isTestCard = (cardNumber) => {
    if (!cardNumber) return false;
    const cleanNumber = cardNumber.replace(/\s/g, '');

    // Common Stripe test card patterns
    const testCardPatterns = [
      '4242424242424242', // Visa
      '4000000000000002', // Visa (declined)
      '5555555555554444', // Mastercard
      '378282246310005',  // American Express
      '6011111111111117', // Discover
    ];

    return testCardPatterns.some(pattern => cleanNumber.startsWith(pattern.substring(0, 6)));
  };

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
        hidePostalCode: mode === 'test', // Show postal code in live mode, hide in test mode
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

    // Check for test cards in live mode before proceeding
    if (mode === 'live' && isTestCard(realCardNumber)) {
      setError('❌ Тестовые карты не работают в live режиме. Пожалуйста, используйте реальную карту для live транзакций.');
      setProcessing(false);
      setAuthenticationStep('');
      return;
    }

    try {
      setAuthenticationStep('Creating payment method...');
      console.log('🔄 Creating payment method with mode:', mode);

      // Create payment method
      const paymentMethodParams = {
        type: 'card',
        card: cardElement,
      };

      // Only add default postal code for test mode
      if (mode === 'test') {
        paymentMethodParams.billing_details = {
          address: {
            postal_code: '10110' // Default postal code for test mode
          }
        };
      }
      // In live mode, let Stripe Elements handle the postal code from user input

      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod(paymentMethodParams);

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
        customerId: `temp_customer_${Date.now()}`, // Temporary ID, API will create real Stripe customer
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

      // Declare variables for payment intents
      let paymentIntent, mainPaymentIntent;

      // Check if this is a verification payment (step 1) or main deposit (step 2)
      if (result.verification) {
        setAuthenticationStep('Confirming verification payment (3D Secure authentication may be required)...');

        // Step 1: Confirm verification payment
        console.log('🔄 Confirming verification payment with 3D Secure support...');
        const { error: confirmError, paymentIntent: verificationPaymentIntent } = await stripe.confirmCardPayment(
          result.paymentIntent.client_secret
        );
        paymentIntent = verificationPaymentIntent;

        if (confirmError) {
          console.error('❌ Verification payment confirmation failed:', confirmError);
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

        console.log('✅ Verification payment confirmed successfully:', paymentIntent.status);
        setAuthenticationStep('Verification successful! Creating main deposit...');

        // Step 2: Create main deposit after successful verification
        console.log('🔄 Creating main deposit after verification...');
        const mainDepositResponse = await fetch('/api/deposits/create-main-deposit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Stripe-Mode': mode
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            currency: currency,
            customerId: customerId,
            paymentMethodId: paymentMethod.id,
            verificationPaymentIntentId: paymentIntent.id
          })
        });

        const mainDepositResult = await mainDepositResponse.json();
        console.log('📥 Main deposit API response:', { status: mainDepositResponse.status, result: mainDepositResult });

        if (!mainDepositResponse.ok) {
          console.error('❌ Main deposit creation failed:', { status: mainDepositResponse.status, error: mainDepositResult.error });
          setError(mainDepositResult.error || 'Failed to create main deposit');
          setProcessing(false);
          setAuthenticationStep('');
          return;
        }

        setAuthenticationStep('Confirming main deposit (3D Secure authentication may be required)...');

        // Confirm main deposit payment
        console.log('🔄 Confirming main deposit with 3D Secure support...');
        const { error: mainConfirmError, paymentIntent: mainDepositPaymentIntent } = await stripe.confirmCardPayment(
          mainDepositResult.paymentIntent.client_secret
        );
        mainPaymentIntent = mainDepositPaymentIntent;

        if (mainConfirmError) {
          console.error('❌ Main deposit confirmation failed:', mainConfirmError);
          if (mainConfirmError.type === 'card_error') {
            if (mainConfirmError.code === 'authentication_required') {
              setError('Authentication required for main deposit. Please complete 3D Secure verification with your bank.');
            } else if (mainConfirmError.code === 'card_declined') {
              setError(`Main deposit declined: ${mainConfirmError.message}`);
            } else {
              setError(mainConfirmError.message);
            }
          } else {
            setError(mainConfirmError.message);
          }
          setProcessing(false);
          setAuthenticationStep('');
          return;
        }

        setAuthenticationStep('Main deposit confirmed successfully!');
        console.log('✅ Main deposit confirmed successfully:', mainPaymentIntent.status);

        // Use main deposit payment intent for final processing
        const finalPaymentIntent = mainPaymentIntent;
      } else {
        // Legacy single-step process
        setAuthenticationStep('Confirming payment (3D Secure authentication may be required)...');

        console.log('🔄 Confirming payment with 3D Secure support...');
        const { error: confirmError, paymentIntent: singlePaymentIntent } = await stripe.confirmCardPayment(
          result.paymentIntent.client_secret
        );
        paymentIntent = singlePaymentIntent;

        if (confirmError) {
          console.error('❌ Payment confirmation failed:', confirmError);
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
      }

      // Get the final payment intent (either from two-step or single-step process)
      const finalPaymentIntent = result.verification ? mainPaymentIntent : paymentIntent;

      // Check payment intent status
      if (finalPaymentIntent.status === 'requires_capture') {
        // Payment authorized successfully (manual capture)
        console.log('✅ Payment authorized - ready for capture');
        setAuthenticationStep('Deposit authorized successfully! Funds are held securely.');
      } else if (finalPaymentIntent.status === 'succeeded') {
        // Payment completed successfully
        console.log('✅ Payment completed successfully');
        setAuthenticationStep('Deposit completed successfully!');
      } else if (finalPaymentIntent.status === 'requires_action') {
        // This shouldn't happen after confirmCardPayment, but handle it
        console.warn('⚠️ Payment still requires action after confirmation');
        setError('Payment requires additional authentication. Please try again.');
        setProcessing(false);
        setAuthenticationStep('');
        return;
      } else if (finalPaymentIntent.status === 'canceled') {
        console.warn('⚠️ Payment was canceled');
        setError('Payment was canceled. Please try again.');
        setProcessing(false);
        setAuthenticationStep('');
        return;
      } else {
        console.warn('⚠️ Unexpected payment status:', finalPaymentIntent.status);
        setError(`Unexpected payment status: ${finalPaymentIntent.status}. Please contact support.`);
        setProcessing(false);
        setAuthenticationStep('');
        return;
      }

      // Call the parent component's onSubmit with successful payment
      onSubmit({
        amount: amountValue,
        currency: currency,
        paymentMethodId: paymentMethod.id,
        paymentIntent: finalPaymentIntent,
        success: true,
        status: finalPaymentIntent.status,
        verification: result.verification || false
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
