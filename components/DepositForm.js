import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Alert } from './ui/Alert';

export default function DepositForm({ onSubmit, loading = false, mode = 'test' }) {
  const [formData, setFormData] = useState({
    amount: '',
    customerId: '',
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: ''
  });
  const [errors, setErrors] = useState({});
  const [localAlert, setLocalAlert] = useState(null);

  const validateForm = () => {
    const newErrors = {};

    // Amount validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (parseFloat(formData.amount) < 1) {
      newErrors.amount = 'Minimum amount is $1.00';
    } else if (parseFloat(formData.amount) > 10000) {
      newErrors.amount = 'Maximum amount is $10,000.00';
    }

    // Customer ID validation
    if (!formData.customerId) {
      newErrors.customerId = 'Customer ID is required';
    } else if (formData.customerId.length < 3) {
      newErrors.customerId = 'Customer ID must be at least 3 characters';
    }

    // Card number validation
    if (!formData.cardNumber) {
      newErrors.cardNumber = 'Card number is required';
    } else if (formData.cardNumber.replace(/\s/g, '').length < 13) {
      newErrors.cardNumber = 'Valid card number is required';
    }

    // Expiry month validation
    if (!formData.expMonth) {
      newErrors.expMonth = 'Expiry month is required';
    } else if (formData.expMonth < 1 || formData.expMonth > 12) {
      newErrors.expMonth = 'Valid expiry month (1-12) is required';
    }

    // Expiry year validation
    const currentYear = new Date().getFullYear();
    if (!formData.expYear) {
      newErrors.expYear = 'Expiry year is required';
    } else if (formData.expYear < currentYear || formData.expYear > currentYear + 20) {
      newErrors.expYear = 'Valid expiry year is required';
    }

    // CVC validation
    if (!formData.cvc) {
      newErrors.cvc = 'CVC is required';
    } else if (formData.cvc.length < 3 || formData.cvc.length > 4) {
      newErrors.cvc = 'Valid CVC (3-4 digits) is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setLocalAlert({
        type: 'error',
        message: 'Please fix the errors below'
      });
      return;
    }

    setLocalAlert(null);

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        amount: '',
        customerId: '',
        cardNumber: '',
        expMonth: '',
        expYear: '',
        cvc: ''
      });
      setErrors({});
    } catch (error) {
      setLocalAlert({
        type: 'error',
        message: error.message || 'Failed to create deposit'
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Clear local alert when user makes changes
    if (localAlert) {
      setLocalAlert(null);
    }
  };

  const formatCardNumber = (value) => {
    // Remove all non-digits
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const testCards = [
    { name: 'Success Card', number: '4242424242424242', description: 'Always succeeds' },
    { name: 'Declined Card', number: '4000000000000002', description: 'Always declined' },
    { name: 'Insufficient Funds', number: '4000000000009995', description: 'Insufficient funds' },
    { name: '3D Secure', number: '4000002500003155', description: 'Requires authentication' }
  ];

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Create New Deposit</h2>

      {localAlert && (
        <div className="mb-4">
          <Alert
            type={localAlert.type}
            message={localAlert.message}
            onClose={() => setLocalAlert(null)}
          />
        </div>
      )}

      {/* Mode-specific warnings and test cards */}
      {mode === 'live' ? (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-medium text-red-800 mb-2">⚠️ LIVE MODE WARNING</h3>
          <p className="text-sm text-red-700">
            You are in LIVE mode. Real charges will be made to your card.
            Only use real card information that you own.
          </p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Test Cards (Demo Mode)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {testCards.map((card, index) => (
            <button
              key={index}
              type="button"
              className="text-left text-xs p-2 bg-white hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
              onClick={() => {
                handleInputChange('cardNumber', card.number);
                handleInputChange('expMonth', '12');
                handleInputChange('expYear', '2025');
                handleInputChange('cvc', '123');
              }}
            >
              <div className="font-medium text-gray-900">{card.name}</div>
              <div className="text-gray-500">{card.description}</div>
              <div className="text-gray-400 font-mono">{card.number}</div>
            </button>
          ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Deposit Amount"
            type="number"
            step="0.01"
            min="1"
            max="10000"
            value={formData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            error={errors.amount}
            placeholder="100.00"
            required
            helperText="Minimum: $1.00, Maximum: $10,000.00"
          />

          <Input
            label="Customer ID"
            value={formData.customerId}
            onChange={(e) => handleInputChange('customerId', e.target.value)}
            error={errors.customerId}
            placeholder="customer_123"
            required
            helperText="Unique identifier for the customer"
          />
        </div>

        <Input
          label="Card Number"
          value={formData.cardNumber}
          onChange={(e) => handleInputChange('cardNumber', formatCardNumber(e.target.value))}
          error={errors.cardNumber}
          placeholder="4242 4242 4242 4242"
          maxLength="19"
          required
          helperText="Use test cards above for demo"
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Expiry Month"
            type="number"
            value={formData.expMonth}
            onChange={(e) => handleInputChange('expMonth', e.target.value)}
            error={errors.expMonth}
            placeholder="12"
            min="1"
            max="12"
            required
          />

          <Input
            label="Expiry Year"
            type="number"
            value={formData.expYear}
            onChange={(e) => handleInputChange('expYear', e.target.value)}
            error={errors.expYear}
            placeholder="2025"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 20}
            required
          />

          <Input
            label="CVC"
            type="password"
            value={formData.cvc}
            onChange={(e) => handleInputChange('cvc', e.target.value.replace(/\D/g, ''))}
            error={errors.cvc}
            placeholder="123"
            maxLength="4"
            required
          />
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="w-full"
            size="large"
          >
            {loading ? 'Creating Deposit...' : 'Create Deposit'}
          </Button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 How Deposits Work</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Deposits are held securely and not charged immediately</li>
          <li>• You can capture (charge) or release (cancel) deposits later</li>
          <li>• All transactions are processed through Stripe's secure platform</li>
          <li>• Test mode uses demo data - no real charges are made</li>
        </ul>
      </div>
    </Card>
  );
}
