import { useState, useEffect } from 'react';
import { smartDetectCurrency } from '../utils/currency';

export default function CardNumberInput({ onCurrencyDetected, onCardNumberChange }) {
  const [cardNumber, setCardNumber] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [detectedCurrency, setDetectedCurrency] = useState(null);

  // Format card number with spaces
  const formatCardNumber = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Add spaces every 4 digits
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    return formatted;
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    const formatted = formatCardNumber(value);
    
    // Limit to 19 characters (16 digits + 3 spaces)
    if (formatted.length <= 19) {
      setCardNumber(formatted);
      
      // Get raw digits for currency detection
      const rawDigits = formatted.replace(/\s/g, '');
      onCardNumberChange(rawDigits);
      
      // Try to detect currency when we have at least 6 digits
      if (rawDigits.length >= 6) {
        const currency = smartDetectCurrency(rawDigits);
        if (currency && currency !== detectedCurrency) {
          setDetectedCurrency(currency);
          onCurrencyDetected(currency);
          
          // Hide the input after successful detection
          setTimeout(() => {
            setIsVisible(false);
          }, 1000);
        }
      }
    }
  };

  const handleShowInput = () => {
    setIsVisible(true);
    setCardNumber('');
    setDetectedCurrency(null);
  };

  if (!isVisible && detectedCurrency) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Number (for currency detection)
        </label>
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            <span className="text-sm text-green-700">
              Currency detected from card: {detectedCurrency.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            onClick={handleShowInput}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Change card
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Card Number (for currency detection)*
      </label>
      <input
        type="text"
        value={cardNumber}
        onChange={handleInputChange}
        placeholder="1234 5678 9012 3456"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        autoComplete="cc-number"
      />
      <p className="text-xs text-gray-500 mt-1">
        💡 Enter your card number to automatically detect the correct currency by BIN
      </p>
      {detectedCurrency && (
        <p className="text-xs text-green-600 mt-1">
          ✓ Currency detected: {detectedCurrency.toUpperCase()}
        </p>
      )}
    </div>
  );
}
