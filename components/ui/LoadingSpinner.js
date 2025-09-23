import React from 'react';

const LoadingSpinner = ({
  size = 'md',
  color = 'primary',
  text = '',
  overlay = false,
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-gray-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    error: 'text-error-600',
    white: 'text-white'
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const spinnerClasses = [
    'animate-spin',
    sizeClasses[size],
    colorClasses[color],
    className
  ].filter(Boolean).join(' ');

  const SpinnerSVG = () => (
    <svg
      className={spinnerClasses}
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

  const content = (
    <div className="flex flex-col items-center justify-center space-y-2">
      <SpinnerSVG />
      {text && (
        <p className={`${textSizeClasses[size]} ${colorClasses[color]} font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

// Dots Loading Animation
export const LoadingDots = ({
  size = 'md',
  color = 'primary',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };

  const colorClasses = {
    primary: 'bg-primary-600',
    secondary: 'bg-gray-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    error: 'bg-error-600',
    white: 'bg-white'
  };

  const dotClasses = [
    'rounded-full',
    'animate-pulse',
    sizeClasses[size],
    colorClasses[color]
  ].join(' ');

  return (
    <div className={`flex space-x-1 ${className}`}>
      <div className={`${dotClasses} animation-delay-0`} />
      <div className={`${dotClasses} animation-delay-200`} />
      <div className={`${dotClasses} animation-delay-400`} />
    </div>
  );
};

// Pulse Loading Animation
export const LoadingPulse = ({
  size = 'md',
  color = 'primary',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24'
  };

  const colorClasses = {
    primary: 'bg-primary-200',
    secondary: 'bg-gray-200',
    success: 'bg-success-200',
    warning: 'bg-warning-200',
    error: 'bg-error-200'
  };

  const pulseClasses = [
    'rounded-full',
    'animate-ping',
    sizeClasses[size],
    colorClasses[color],
    className
  ].filter(Boolean).join(' ');

  return <div className={pulseClasses} />;
};

// Skeleton Loading
export const LoadingSkeleton = ({
  width = 'w-full',
  height = 'h-4',
  rounded = 'rounded',
  className = ''
}) => {
  return (
    <div
      className={`
        animate-pulse bg-gray-200 ${width} ${height} ${rounded} ${className}
      `}
    />
  );
};

// Card Skeleton
export const LoadingCardSkeleton = ({ className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-lg shadow border ${className}`}>
      <div className="animate-pulse">
        <div className="flex items-center space-x-4 mb-4">
          <div className="rounded-full bg-gray-200 h-10 w-10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
        <div className="flex justify-between items-center mt-6">
          <div className="h-8 bg-gray-200 rounded w-20" />
          <div className="h-8 bg-gray-200 rounded w-16" />
        </div>
      </div>
    </div>
  );
};

// Table Skeleton
export const LoadingTableSkeleton = ({ rows = 5, columns = 4, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow border overflow-hidden ${className}`}>
      <div className="animate-pulse">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-3 border-b">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
        
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4 border-b border-gray-100">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="h-4 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingSpinner;

// Usage examples:
// <LoadingSpinner size="lg" color="primary" text="Loading..." />
// <LoadingSpinner overlay text="Processing payment..." />
// <LoadingDots size="md" color="success" />
// <LoadingPulse size="lg" color="primary" />
// <LoadingSkeleton width="w-64" height="h-6" />
// <LoadingCardSkeleton />
// <LoadingTableSkeleton rows={3} columns={5} />
