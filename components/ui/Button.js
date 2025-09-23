import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'transition-fast',
    'focus-ring',
    'border',
    'rounded-md',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed'
  ];

  const variantClasses = {
    primary: [
      'bg-primary',
      'border-transparent',
      'text-white',
      'hover:bg-primary-700',
      'active:bg-primary-800'
    ],
    secondary: [
      'bg-surface',
      'border-strong',
      'text-primary',
      'hover:bg-gray-50',
      'active:bg-gray-100'
    ],
    success: [
      'bg-success',
      'border-transparent',
      'text-white',
      'hover:bg-success-700',
      'active:bg-success-800'
    ],
    warning: [
      'bg-warning',
      'border-transparent',
      'text-white',
      'hover:bg-warning-700',
      'active:bg-warning-800'
    ],
    error: [
      'bg-error',
      'border-transparent',
      'text-white',
      'hover:bg-error-700',
      'active:bg-error-800'
    ],
    ghost: [
      'bg-transparent',
      'border-transparent',
      'text-secondary',
      'hover:bg-gray-100',
      'active:bg-gray-200'
    ],
    outline: [
      'bg-transparent',
      'border-strong',
      'text-primary',
      'hover:bg-gray-50',
      'active:bg-gray-100'
    ]
  };

  const sizeClasses = {
    xs: ['px-2', 'py-1', 'text-xs'],
    sm: ['px-3', 'py-1.5', 'text-sm'],
    md: ['px-4', 'py-2', 'text-base'],
    lg: ['px-6', 'py-3', 'text-lg'],
    xl: ['px-8', 'py-4', 'text-xl']
  };

  const widthClasses = fullWidth ? ['w-full'] : [];

  const allClasses = [
    ...baseClasses,
    ...variantClasses[variant],
    ...sizeClasses[size],
    ...widthClasses,
    className
  ].join(' ');

  const LoadingSpinner = () => (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  return (
    <button
      type={type}
      className={allClasses}
      disabled={disabled || loading}
      onClick={onClick}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      aria-label={loading ? `${children} (loading)` : undefined}
      role="button"
      {...props}
    >
      {loading && <LoadingSpinner />}
      {!loading && icon && iconPosition === 'left' && (
        <span className="mr-2">{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  );
};

export default Button;

// Usage examples:
// <Button variant="primary" size="md">Primary Button</Button>
// <Button variant="secondary" size="lg" icon="📊">With Icon</Button>
// <Button variant="success" loading={true}>Loading...</Button>
// <Button variant="outline" fullWidth>Full Width</Button>
