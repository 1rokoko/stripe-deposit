import { useState, useEffect } from 'react';
import { getCurrencyOptions, smartDetectCurrency } from '../utils/currency';

const CurrencySelector = ({ value, onChange, disabled = false, cardNumber = '', autoDetected = false, autoHide = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [detectionSource, setDetectionSource] = useState('');
  const [isCardDetected, setIsCardDetected] = useState(false);
  const currencyOptions = getCurrencyOptions();

  // Auto-detect currency on mount if no value provided
  useEffect(() => {
    if (!value) {
      const detectedCurrency = smartDetectCurrency(cardNumber);
      onChange(detectedCurrency);

      // Set detection source for user feedback
      if (cardNumber && cardNumber.length >= 6) {
        setDetectionSource('card');
      } else {
        setDetectionSource('location');
      }
    }
  }, [value, onChange, cardNumber]);

  // Re-detect when card number changes
  useEffect(() => {
    if (cardNumber && cardNumber.length >= 6) {
      const detectedCurrency = smartDetectCurrency(cardNumber);
      console.log('🔍 Currency detection:', { cardNumber, detectedCurrency, currentValue: value });
      if (detectedCurrency && detectedCurrency !== value) {
        console.log('✅ Changing currency from', value, 'to', detectedCurrency);
        onChange(detectedCurrency);
        setDetectionSource('card');
        setIsCardDetected(true);
      }
    }
  }, [cardNumber]);

  const selectedCurrency = currencyOptions.find(option => option.value === value) || currencyOptions[0];

  const handleSelect = (currency) => {
    onChange(currency.value);
    setIsOpen(false);
    setDetectionSource('manual');
    setIsCardDetected(false);
  };

  // If autoHide is enabled and currency was detected from card, hide the selector
  if (autoHide && isCardDetected && detectionSource === 'card') {
    return (
      <div className="mb-4">
        <input type="hidden" name="currency" value={value} />
        <p className="text-sm text-green-600 mb-2">
          ✓ Currency auto-detected from your card: {selectedCurrency.symbol} {selectedCurrency.label}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Currency*
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          `}
          style={{ color: '#000000 !important' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium">{selectedCurrency.symbol}</span>
              <span>{selectedCurrency.label}</span>
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {currencyOptions.map((currency) => (
              <button
                key={currency.value}
                type="button"
                onClick={() => handleSelect(currency)}
                className={`
                  w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none
                  ${currency.value === value ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                `}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-medium w-8">{currency.symbol}</span>
                  <span>{currency.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <p className="text-sm text-gray-500 mt-1">
        {detectionSource === 'card' ? (
          <span className="text-green-600">✓ Auto-detected by BIN number from your card</span>
        ) : detectionSource === 'location' ? (
          <span className="text-blue-600">📍 Auto-detected from your location</span>
        ) : (
          'Auto-detected by card number (BIN)'
        )}
      </p>

      {detectionSource === 'card' && (
        <p className="text-xs text-green-600 mt-1">
          💡 We detected this currency from your card number. If this is wrong, please select the correct currency above.
        </p>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default CurrencySelector;
