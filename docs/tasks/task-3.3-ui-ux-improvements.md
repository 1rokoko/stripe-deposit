# Задача 3.3: Улучшение UI/UX

## 📋 Описание
Улучшить пользовательский интерфейс: добавить лоадеры, улучшить обработку ошибок, добавить подтверждения операций, сделать адаптивный дизайн для мобильных устройств.

## 🎯 Цели
- Создать современный и интуитивный интерфейс
- Обеспечить отличный пользовательский опыт
- Сделать приложение полностью responsive

## 🔧 Технические требования

### 1. Система компонентов UI
Файл: `components/ui/index.js`

```javascript
// Button Component
export function Button({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  loading = false, 
  disabled = false,
  onClick,
  ...props 
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
  };
  
  const sizes = {
    small: 'px-3 py-2 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  };
  
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${
    (disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''
  }`;

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// Input Component
export function Input({ 
  label, 
  error, 
  helperText, 
  required = false,
  ...props 
}) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

// Card Component
export function Card({ children, className = '', ...props }) {
  return (
    <div 
      className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Modal Component
export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Loading Spinner
export function LoadingSpinner({ size = 'medium' }) {
  const sizes = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="flex justify-center items-center">
      <svg 
        className={`animate-spin ${sizes[size]} text-blue-600`} 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );
}

// Alert Component
export function Alert({ type = 'info', title, message, onClose }) {
  const types = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`border rounded-lg p-4 ${types[type]}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-lg">{icons[type]}</span>
        </div>
        <div className="ml-3 flex-1">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          <p className="text-sm">{message}</p>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button onClick={onClose} className="text-sm hover:opacity-75">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 2. Улучшенная форма депозита
Файл: `components/DepositForm.js`

```javascript
import { useState } from 'react';
import { Button, Input, Card, Alert, LoadingSpinner } from './ui';

export default function DepositForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    amount: '',
    customerId: '',
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.customerId) {
      newErrors.customerId = 'Customer ID is required';
    }

    if (!formData.cardNumber || formData.cardNumber.length < 13) {
      newErrors.cardNumber = 'Valid card number is required';
    }

    if (!formData.expMonth || formData.expMonth < 1 || formData.expMonth > 12) {
      newErrors.expMonth = 'Valid expiry month is required';
    }

    if (!formData.expYear || formData.expYear < new Date().getFullYear()) {
      newErrors.expYear = 'Valid expiry year is required';
    }

    if (!formData.cvc || formData.cvc.length < 3) {
      newErrors.cvc = 'Valid CVC is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setAlert({
        type: 'error',
        message: 'Please fix the errors below'
      });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      await onSubmit(formData);
      setAlert({
        type: 'success',
        message: 'Deposit created successfully!'
      });
      setFormData({
        amount: '',
        customerId: '',
        cardNumber: '',
        expMonth: '',
        expYear: '',
        cvc: ''
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.message || 'Failed to create deposit'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const testCards = [
    { name: 'Success Card', number: '4242424242424242' },
    { name: 'Declined Card', number: '4000000000000002' },
    { name: 'Insufficient Funds', number: '4000000000009995' },
    { name: '3D Secure', number: '4000002500003155' }
  ];

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Deposit</h2>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Test Cards</h3>
        <div className="grid grid-cols-2 gap-2">
          {testCards.map((card, index) => (
            <button
              key={index}
              type="button"
              className="text-xs p-2 bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => handleInputChange('cardNumber', card.number)}
            >
              {card.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          value={formData.amount}
          onChange={(e) => handleInputChange('amount', e.target.value)}
          error={errors.amount}
          placeholder="100.00"
          required
        />

        <Input
          label="Customer ID"
          value={formData.customerId}
          onChange={(e) => handleInputChange('customerId', e.target.value)}
          error={errors.customerId}
          placeholder="cus_..."
          required
        />

        <Input
          label="Card Number"
          value={formData.cardNumber}
          onChange={(e) => handleInputChange('cardNumber', e.target.value)}
          error={errors.cardNumber}
          placeholder="4242424242424242"
          maxLength="19"
          required
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Month"
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
            label="Year"
            type="number"
            value={formData.expYear}
            onChange={(e) => handleInputChange('expYear', e.target.value)}
            error={errors.expYear}
            placeholder="2025"
            min={new Date().getFullYear()}
            required
          />

          <Input
            label="CVC"
            value={formData.cvc}
            onChange={(e) => handleInputChange('cvc', e.target.value)}
            error={errors.cvc}
            placeholder="123"
            maxLength="4"
            required
          />
        </div>

        <Button
          type="submit"
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating Deposit...' : 'Create Deposit'}
        </Button>
      </form>
    </Card>
  );
}
```

### 3. Responsive Layout
Файл: `components/Layout.js`

```javascript
import { useState } from 'react';
import Head from 'next/head';
import { Button } from './ui';

export default function Layout({ children, title = 'Stripe Deposit' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-gray-600 opacity-75" />
          </div>
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <h1 className="text-xl font-bold">Stripe Deposit</h1>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="mt-8">
            <a href="/" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Dashboard
            </a>
            <a href="/deposits" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Deposits
            </a>
            <a href="/customers" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Customers
            </a>
          </nav>
        </div>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top bar */}
          <div className="flex items-center justify-between h-16 px-4 bg-white border-b lg:px-8">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center space-x-4">
              <Button variant="secondary" size="small">
                Profile
              </Button>
              <Button variant="danger" size="small">
                Logout
              </Button>
            </div>
          </div>

          {/* Page content */}
          <main className="p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
```

### 4. Confirmation Dialog
Файл: `components/ConfirmationDialog.js`

```javascript
import { Modal, Button } from './ui';

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="mb-6">
        <p className="text-gray-600">{message}</p>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          variant="secondary"
          onClick={onClose}
        >
          {cancelText}
        </Button>
        <Button
          variant={type}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
```

### 5. Toast Notifications
Файл: `components/Toast.js`

```javascript
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...toast, id }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, removeToast }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
}

function Toast({ type = 'info', title, message, onClose }) {
  const types = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-500 text-white'
  };

  return (
    <div className={`rounded-lg p-4 shadow-lg max-w-sm ${types[type]} animate-slide-in`}>
      <div className="flex items-start">
        <div className="flex-1">
          {title && <h4 className="font-medium">{title}</h4>}
          <p className="text-sm">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 text-white hover:opacity-75"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
```

### 6. CSS Animations
Файл: `styles/animations.css`

```css
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes bounce-in {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-bounce-in {
  animation: bounce-in 0.5s ease-out;
}

/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Responsive utilities */
@media (max-width: 640px) {
  .mobile-full {
    width: 100% !important;
  }
  
  .mobile-hidden {
    display: none !important;
  }
}

/* Focus styles for accessibility */
.focus-visible:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .dark-mode {
    background-color: #1f2937;
    color: #f9fafb;
  }
}
```

## 📝 Шаги выполнения

### Шаг 1: Создание UI компонентов
1. Создать базовые UI компоненты
2. Добавить Tailwind CSS
3. Реализовать responsive дизайн

### Шаг 2: Улучшение форм
1. Добавить валидацию в real-time
2. Улучшить error handling
3. Добавить loading states

### Шаг 3: Добавление интерактивности
1. Реализовать toast notifications
2. Добавить confirmation dialogs
3. Создать smooth animations

### Шаг 4: Mobile optimization
1. Сделать responsive layout
2. Оптимизировать touch interactions
3. Добавить mobile-specific features

### Шаг 5: Accessibility
1. Добавить ARIA labels
2. Обеспечить keyboard navigation
3. Проверить color contrast

## ✅ Критерии готовности
- [ ] UI компоненты созданы
- [ ] Responsive дизайн работает
- [ ] Loading states добавлены
- [ ] Error handling улучшен
- [ ] Animations работают плавно
- [ ] Mobile experience оптимизирован

## 🧪 Тестирование

### Responsive тестирование
- Тестировать на разных размерах экрана
- Проверить touch interactions
- Убедиться в читаемости на мобильных

### Accessibility тестирование
- Использовать screen reader
- Проверить keyboard navigation
- Тестировать color contrast

## 🚨 Важные замечания
- Поддерживать consistency в дизайне
- Оптимизировать производительность анимаций
- Тестировать на реальных устройствах
- Следовать accessibility guidelines
- Использовать semantic HTML

## 📚 Полезные ссылки
- [Tailwind CSS](https://tailwindcss.com/)
- [React Accessibility](https://reactjs.org/docs/accessibility.html)
- [Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 🔍 Проверка результата
После выполнения:
1. Интерфейс выглядит современно
2. Все элементы responsive
3. Loading states информативны
4. Error handling user-friendly
