import React from 'react';

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  rounded = true,
  className = ''
}) => {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'font-medium',
    'transition-colors'
  ];

  const variantClasses = {
    default: [
      'bg-gray-100',
      'text-gray-800',
      'border-gray-200'
    ],
    primary: [
      'bg-primary-100',
      'text-primary-800',
      'border-primary-200'
    ],
    success: [
      'bg-success-100',
      'text-success-800',
      'border-success-200'
    ],
    warning: [
      'bg-warning-100',
      'text-warning-800',
      'border-warning-200'
    ],
    error: [
      'bg-error-100',
      'text-error-800',
      'border-error-200'
    ],
    info: [
      'bg-blue-100',
      'text-blue-800',
      'border-blue-200'
    ],
    // Status-specific variants
    pending: [
      'bg-warning-100',
      'text-warning-800',
      'border-warning-200'
    ],
    captured: [
      'bg-success-100',
      'text-success-800',
      'border-success-200'
    ],
    failed: [
      'bg-error-100',
      'text-error-800',
      'border-error-200'
    ],
    released: [
      'bg-gray-100',
      'text-gray-800',
      'border-gray-200'
    ]
  };

  const sizeClasses = {
    xs: ['px-1.5', 'py-0.5', 'text-xs'],
    sm: ['px-2', 'py-1', 'text-xs'],
    md: ['px-2.5', 'py-1', 'text-sm'],
    lg: ['px-3', 'py-1.5', 'text-sm'],
    xl: ['px-4', 'py-2', 'text-base']
  };

  const roundedClasses = rounded ? ['rounded-full'] : ['rounded'];

  const allClasses = [
    ...baseClasses,
    ...variantClasses[variant] || variantClasses.default,
    ...sizeClasses[size],
    ...roundedClasses,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={allClasses}>
      {children}
    </span>
  );
};

// Dot Badge - for status indicators
export const DotBadge = ({
  children,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const dotColorClasses = {
    default: 'bg-gray-400',
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
    info: 'bg-blue-500',
    pending: 'bg-warning-500',
    captured: 'bg-success-500',
    failed: 'bg-error-500',
    released: 'bg-gray-400'
  };

  const dotSizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm',
    xl: 'text-base'
  };

  return (
    <span className={`inline-flex items-center ${textSizeClasses[size]} font-medium text-gray-900 ${className}`}>
      <span
        className={`
          ${dotSizeClasses[size]}
          ${dotColorClasses[variant] || dotColorClasses.default}
          rounded-full mr-2
        `}
      />
      {children}
    </span>
  );
};

// Number Badge - for counts
export const NumberBadge = ({
  count,
  max = 99,
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const displayCount = count > max ? `${max}+` : count;
  
  if (count === 0) return null;

  const sizeClasses = {
    xs: ['min-w-4', 'h-4', 'text-xs'],
    sm: ['min-w-5', 'h-5', 'text-xs'],
    md: ['min-w-6', 'h-6', 'text-sm'],
    lg: ['min-w-7', 'h-7', 'text-sm'],
    xl: ['min-w-8', 'h-8', 'text-base']
  };

  return (
    <Badge
      variant={variant}
      size={size}
      className={`
        ${sizeClasses[size].join(' ')}
        rounded-full flex items-center justify-center
        ${className}
      `}
    >
      {displayCount}
    </Badge>
  );
};

// Icon Badge - with icon
export const IconBadge = ({
  icon,
  children,
  variant = 'default',
  size = 'md',
  iconPosition = 'left',
  className = ''
}) => {
  const iconSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5'
  };

  return (
    <Badge variant={variant} size={size} className={className}>
      {icon && iconPosition === 'left' && (
        <span className={`${iconSizeClasses[size]} mr-1`}>
          {icon}
        </span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className={`${iconSizeClasses[size]} ml-1`}>
          {icon}
        </span>
      )}
    </Badge>
  );
};

export default Badge;

// Usage examples:
// <Badge variant="success">Active</Badge>
// <Badge variant="pending" size="sm">Pending</Badge>
// <DotBadge variant="captured">Captured</DotBadge>
// <NumberBadge count={5} variant="error" />
// <IconBadge icon="🔒" variant="warning">Locked</IconBadge>
