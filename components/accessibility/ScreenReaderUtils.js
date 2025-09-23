import React from 'react';

// Screen Reader Only component - content visible only to screen readers
export const ScreenReaderOnly = ({ children, as: Component = 'span', ...props }) => {
  return (
    <Component 
      className="sr-only"
      {...props}
    >
      {children}
      <style jsx>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </Component>
  );
};

// Live Region component for dynamic announcements
export const LiveRegion = ({ 
  children, 
  priority = 'polite', 
  atomic = true,
  relevant = 'additions text',
  className = '',
  ...props 
}) => {
  return (
    <div
      aria-live={priority}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={`live-region ${className}`}
      {...props}
    >
      {children}
      <style jsx>{`
        .live-region {
          position: absolute;
          left: -10000px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

// Progress announcer for screen readers
export const ProgressAnnouncer = ({ 
  value, 
  max = 100, 
  label = 'Progress',
  description,
  format = 'percentage' 
}) => {
  const percentage = Math.round((value / max) * 100);
  
  const formatValue = () => {
    switch (format) {
      case 'percentage':
        return `${percentage}%`;
      case 'fraction':
        return `${value} of ${max}`;
      case 'steps':
        return `Step ${value} of ${max}`;
      default:
        return `${value}`;
    }
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      aria-describedby={description ? 'progress-description' : undefined}
    >
      <ScreenReaderOnly>
        {label}: {formatValue()}
      </ScreenReaderOnly>
      {description && (
        <ScreenReaderOnly id="progress-description">
          {description}
        </ScreenReaderOnly>
      )}
    </div>
  );
};

// Status announcer for dynamic content changes
export const StatusAnnouncer = ({ 
  status, 
  priority = 'polite',
  prefix = '',
  suffix = '' 
}) => {
  return (
    <LiveRegion priority={priority}>
      {prefix}{status}{suffix}
    </LiveRegion>
  );
};

// Loading announcer
export const LoadingAnnouncer = ({ 
  isLoading, 
  loadingText = 'Loading...',
  completeText = 'Loading complete',
  errorText = 'Loading failed',
  error = false 
}) => {
  const getMessage = () => {
    if (error) return errorText;
    if (isLoading) return loadingText;
    return completeText;
  };

  return (
    <LiveRegion priority={error ? 'assertive' : 'polite'}>
      {getMessage()}
    </LiveRegion>
  );
};

// Form validation announcer
export const ValidationAnnouncer = ({ 
  errors = [], 
  fieldName,
  priority = 'assertive' 
}) => {
  if (errors.length === 0) return null;

  const errorMessage = errors.length === 1 
    ? `${fieldName}: ${errors[0]}`
    : `${fieldName} has ${errors.length} errors: ${errors.join(', ')}`;

  return (
    <LiveRegion priority={priority}>
      {errorMessage}
    </LiveRegion>
  );
};

// Navigation announcer for route changes
export const NavigationAnnouncer = ({ 
  currentPage,
  totalPages,
  pageTitle 
}) => {
  return (
    <LiveRegion priority="polite">
      {pageTitle && `Navigated to ${pageTitle}.`}
      {totalPages && ` Page ${currentPage} of ${totalPages}.`}
    </LiveRegion>
  );
};

// Table announcer for dynamic table updates
export const TableAnnouncer = ({ 
  rowCount,
  columnCount,
  selectedCount = 0,
  sortColumn,
  sortDirection,
  action 
}) => {
  const getMessage = () => {
    let message = '';
    
    if (action === 'sort' && sortColumn) {
      message = `Table sorted by ${sortColumn} in ${sortDirection} order.`;
    } else if (action === 'filter') {
      message = `Table filtered. Showing ${rowCount} rows.`;
    } else if (action === 'select') {
      message = `${selectedCount} of ${rowCount} rows selected.`;
    } else {
      message = `Table updated. ${rowCount} rows, ${columnCount} columns.`;
    }
    
    return message;
  };

  return (
    <LiveRegion priority="polite">
      {getMessage()}
    </LiveRegion>
  );
};

// Modal announcer
export const ModalAnnouncer = ({ 
  isOpen, 
  title,
  description 
}) => {
  if (!isOpen) return null;

  return (
    <LiveRegion priority="assertive">
      {`Dialog opened: ${title}${description ? `. ${description}` : ''}`}
    </LiveRegion>
  );
};

// Search results announcer
export const SearchAnnouncer = ({ 
  query,
  resultCount,
  isSearching = false,
  hasError = false 
}) => {
  const getMessage = () => {
    if (hasError) {
      return `Search failed for "${query}".`;
    }
    if (isSearching) {
      return `Searching for "${query}"...`;
    }
    if (resultCount === 0) {
      return `No results found for "${query}".`;
    }
    if (resultCount === 1) {
      return `1 result found for "${query}".`;
    }
    return `${resultCount} results found for "${query}".`;
  };

  return (
    <LiveRegion priority={hasError ? 'assertive' : 'polite'}>
      {getMessage()}
    </LiveRegion>
  );
};

// Utility functions for screen reader support
export const screenReaderUtils = {
  // Generate unique IDs for ARIA relationships
  generateId: (prefix = 'sr') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Format numbers for screen readers
  formatNumber: (number, options = {}) => {
    const { 
      type = 'decimal',
      currency = 'USD',
      minimumFractionDigits = 0,
      maximumFractionDigits = 2 
    } = options;

    if (type === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits
      }).format(number);
    }

    if (type === 'percentage') {
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits,
        maximumFractionDigits
      }).format(number / 100);
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits,
      maximumFractionDigits
    }).format(number);
  },

  // Format dates for screen readers
  formatDate: (date, options = {}) => {
    const { 
      dateStyle = 'medium',
      timeStyle,
      includeTime = false 
    } = options;

    const formatOptions = { dateStyle };
    if (includeTime && timeStyle) {
      formatOptions.timeStyle = timeStyle;
    }

    return new Intl.DateTimeFormat('en-US', formatOptions).format(new Date(date));
  },

  // Create descriptive text for complex UI elements
  describeElement: (element) => {
    const descriptions = [];
    
    if (element.type) descriptions.push(element.type);
    if (element.state) descriptions.push(element.state);
    if (element.position) descriptions.push(`position ${element.position}`);
    if (element.total) descriptions.push(`of ${element.total}`);
    
    return descriptions.join(', ');
  },

  // Check if screen reader is likely being used
  isScreenReaderLikely: () => {
    // Check for common screen reader indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const hasScreenReaderUA = userAgent.includes('nvda') || 
                             userAgent.includes('jaws') || 
                             userAgent.includes('dragon');
    
    const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    
    return hasScreenReaderUA || (hasReducedMotion && hasSpeechSynthesis);
  }
};

export default {
  ScreenReaderOnly,
  LiveRegion,
  ProgressAnnouncer,
  StatusAnnouncer,
  LoadingAnnouncer,
  ValidationAnnouncer,
  NavigationAnnouncer,
  TableAnnouncer,
  ModalAnnouncer,
  SearchAnnouncer,
  screenReaderUtils
};
