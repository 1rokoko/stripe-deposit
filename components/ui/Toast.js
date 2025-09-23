import React, { useState, useEffect, createContext, useContext } from 'react';

// Toast Context
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      ...toast
    };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
    
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const removeAllToasts = () => {
    setToasts([]);
  };

  // Convenience methods
  const toast = {
    success: (message, options = {}) => addToast({ ...options, type: 'success', message }),
    error: (message, options = {}) => addToast({ ...options, type: 'error', message }),
    warning: (message, options = {}) => addToast({ ...options, type: 'warning', message }),
    info: (message, options = {}) => addToast({ ...options, type: 'info', message })
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast, removeAllToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container
const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};

// Individual Toast Item
const ToastItem = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(onRemove, 300); // Wait for exit animation
  };

  const typeConfig = {
    success: {
      icon: '✅',
      bgColor: 'bg-success-50',
      borderColor: 'border-success-200',
      textColor: 'text-success-800',
      iconColor: 'text-success-600'
    },
    error: {
      icon: '❌',
      bgColor: 'bg-error-50',
      borderColor: 'border-error-200',
      textColor: 'text-error-800',
      iconColor: 'text-error-600'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-warning-50',
      borderColor: 'border-warning-200',
      textColor: 'text-warning-800',
      iconColor: 'text-warning-600'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-200',
      textColor: 'text-primary-800',
      iconColor: 'text-primary-600'
    }
  };

  const config = typeConfig[toast.type] || typeConfig.info;

  const baseClasses = [
    'flex',
    'items-start',
    'p-4',
    'rounded-lg',
    'border',
    'shadow-lg',
    'max-w-sm',
    'w-full',
    'transition-all',
    'duration-300',
    'transform',
    config.bgColor,
    config.borderColor
  ];

  const animationClasses = isLeaving
    ? ['translate-x-full', 'opacity-0']
    : isVisible
    ? ['translate-x-0', 'opacity-100']
    : ['translate-x-full', 'opacity-0'];

  const toastClasses = [...baseClasses, ...animationClasses].join(' ');

  return (
    <div
      className={toastClasses}
      role="alert"
      aria-live="assertive"
    >
      <div className={`flex-shrink-0 ${config.iconColor}`}>
        <span className="text-lg">{config.icon}</span>
      </div>
      
      <div className="ml-3 flex-1">
        {toast.title && (
          <h4 className={`text-sm font-medium ${config.textColor}`}>
            {toast.title}
          </h4>
        )}
        <p className={`text-sm ${config.textColor} ${toast.title ? 'mt-1' : ''}`}>
          {toast.message}
        </p>
      </div>
      
      <button
        onClick={handleRemove}
        className={`ml-4 flex-shrink-0 ${config.textColor} hover:opacity-75 transition-opacity`}
        aria-label="Close notification"
      >
        <span className="text-lg">×</span>
      </button>
    </div>
  );
};

export default ToastProvider;

// Usage examples:
// const { toast } = useToast();
// toast.success('Deposit created successfully!');
// toast.error('Failed to process payment');
// toast.warning('Please verify your information');
// toast.info('New feature available', { duration: 10000 });
