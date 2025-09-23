import React, { useState, useRef, useEffect } from 'react';

const Select = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  error,
  helperText,
  disabled = false,
  required = false,
  size = 'md',
  fullWidth = false,
  searchable = false,
  multiple = false,
  className = '',
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  // Filter options based on search term
  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Get display value
  const getDisplayValue = () => {
    if (multiple) {
      if (!value || value.length === 0) return placeholder;
      if (value.length === 1) {
        const option = options.find(opt => opt.value === value[0]);
        return option ? option.label : '';
      }
      return `${value.length} selected`;
    } else {
      if (!value) return placeholder;
      const option = options.find(opt => opt.value === value);
      return option ? option.label : '';
    }
  };

  // Handle option selection
  const handleOptionSelect = (optionValue) => {
    if (multiple) {
      const newValue = value || [];
      const isSelected = newValue.includes(optionValue);
      const updatedValue = isSelected
        ? newValue.filter(v => v !== optionValue)
        : [...newValue, optionValue];
      onChange(updatedValue);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (highlightedIndex >= 0) {
          handleOptionSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
        }
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-4 py-3 text-lg'
  };

  const triggerClasses = [
    'relative w-full cursor-pointer rounded-md border bg-white text-left transition-fast focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    error ? 'border-error-500' : 'border-gray-300',
    disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-400',
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={fullWidth ? 'w-full' : ''} ref={selectRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          id={selectId}
          type="button"
          className={triggerClasses}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${selectId}-error` : 
            helperText ? `${selectId}-helper` : undefined
          }
        >
          <span className="block truncate text-gray-900">
            {getDisplayValue()}
          </span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md border border-gray-300 overflow-hidden">
            {searchable && (
              <div className="p-2 border-b border-gray-200">
                <input
                  ref={searchRef}
                  type="text"
                  className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                />
              </div>
            )}

            <ul
              ref={listRef}
              className="max-h-48 overflow-auto py-1"
              role="listbox"
              aria-labelledby={selectId}
            >
              {filteredOptions.length === 0 ? (
                <li className="px-4 py-2 text-sm text-gray-500">
                  No options found
                </li>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = multiple
                    ? value?.includes(option.value)
                    : value === option.value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <li
                      key={option.value}
                      className={`
                        cursor-pointer select-none relative px-4 py-2 text-sm transition-colors
                        ${isHighlighted ? 'bg-primary-100 text-primary-900' : 'text-gray-900'}
                        ${isSelected ? 'bg-primary-50 font-medium' : 'hover:bg-gray-100'}
                      `}
                      onClick={() => handleOptionSelect(option.value)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center">
                        {multiple && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mr-3 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        )}
                        <span className="block truncate">{option.label}</span>
                        {!multiple && isSelected && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary-600">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <p
          id={`${selectId}-error`}
          className="mt-1 text-sm text-error-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p
          id={`${selectId}-helper`}
          className="mt-1 text-sm text-gray-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Select;

// Usage examples:
// <Select
//   label="Status"
//   options={[
//     { value: 'pending', label: 'Pending' },
//     { value: 'captured', label: 'Captured' },
//     { value: 'failed', label: 'Failed' }
//   ]}
//   value={status}
//   onChange={setStatus}
// />
//
// <Select
//   label="Categories"
//   options={categories}
//   value={selectedCategories}
//   onChange={setSelectedCategories}
//   multiple
//   searchable
// />
