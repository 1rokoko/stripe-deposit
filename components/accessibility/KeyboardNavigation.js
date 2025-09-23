import { useEffect, useRef } from 'react';

// Custom hook for keyboard navigation
export const useKeyboardNavigation = (options = {}) => {
  const {
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onTab,
    onShiftTab,
    trapFocus = false,
    autoFocus = false
  } = options;

  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event) => {
      const { key, shiftKey, target } = event;

      switch (key) {
        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape(event);
          }
          break;

        case 'Enter':
          if (onEnter) {
            event.preventDefault();
            onEnter(event);
          }
          break;

        case 'ArrowUp':
          if (onArrowUp) {
            event.preventDefault();
            onArrowUp(event);
          }
          break;

        case 'ArrowDown':
          if (onArrowDown) {
            event.preventDefault();
            onArrowDown(event);
          }
          break;

        case 'ArrowLeft':
          if (onArrowLeft) {
            event.preventDefault();
            onArrowLeft(event);
          }
          break;

        case 'ArrowRight':
          if (onArrowRight) {
            event.preventDefault();
            onArrowRight(event);
          }
          break;

        case 'Tab':
          if (trapFocus) {
            const focusableElements = getFocusableElements(container);
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (shiftKey) {
              if (target === firstElement) {
                event.preventDefault();
                lastElement?.focus();
              }
              if (onShiftTab) onShiftTab(event);
            } else {
              if (target === lastElement) {
                event.preventDefault();
                firstElement?.focus();
              }
              if (onTab) onTab(event);
            }
          }
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Auto focus first focusable element
    if (autoFocus) {
      const focusableElements = getFocusableElements(container);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onTab, onShiftTab, trapFocus, autoFocus]);

  return containerRef;
};

// Get all focusable elements within a container
export const getFocusableElements = (container) => {
  if (!container) return [];

  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors))
    .filter(element => {
      // Check if element is visible
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             element.offsetParent !== null;
    });
};

// Custom hook for roving tabindex (for lists, menus, etc.)
export const useRovingTabIndex = (items = [], initialIndex = 0) => {
  const activeIndex = useRef(initialIndex);
  const itemRefs = useRef([]);

  const setActiveIndex = (index) => {
    if (index >= 0 && index < items.length) {
      // Remove tabindex from all items
      itemRefs.current.forEach(ref => {
        if (ref.current) {
          ref.current.tabIndex = -1;
        }
      });

      // Set tabindex on active item
      if (itemRefs.current[index]?.current) {
        itemRefs.current[index].current.tabIndex = 0;
        activeIndex.current = index;
      }
    }
  };

  const focusItem = (index) => {
    if (itemRefs.current[index]?.current) {
      itemRefs.current[index].current.focus();
      setActiveIndex(index);
    }
  };

  const moveNext = () => {
    const nextIndex = (activeIndex.current + 1) % items.length;
    focusItem(nextIndex);
  };

  const movePrevious = () => {
    const prevIndex = activeIndex.current === 0 ? items.length - 1 : activeIndex.current - 1;
    focusItem(prevIndex);
  };

  const moveFirst = () => {
    focusItem(0);
  };

  const moveLast = () => {
    focusItem(items.length - 1);
  };

  // Initialize refs array
  useEffect(() => {
    itemRefs.current = items.map((_, index) => itemRefs.current[index] || { current: null });
    setActiveIndex(initialIndex);
  }, [items.length, initialIndex]);

  return {
    itemRefs,
    activeIndex: activeIndex.current,
    setActiveIndex,
    focusItem,
    moveNext,
    movePrevious,
    moveFirst,
    moveLast
  };
};

// Focus management utilities
export const focusUtils = {
  // Save current focus and restore later
  saveFocus: () => {
    return document.activeElement;
  },

  restoreFocus: (element) => {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  },

  // Focus first element in container
  focusFirst: (container) => {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
      return true;
    }
    return false;
  },

  // Focus last element in container
  focusLast: (container) => {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
      return true;
    }
    return false;
  },

  // Check if element is focusable
  isFocusable: (element) => {
    if (!element) return false;
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];

    return focusableSelectors.some(selector => element.matches(selector));
  },

  // Announce to screen readers
  announce: (message, priority = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
};

// Keyboard navigation component wrapper
export const KeyboardNavigationWrapper = ({ 
  children, 
  onEscape,
  onEnter,
  trapFocus = false,
  autoFocus = false,
  className = '',
  ...props 
}) => {
  const containerRef = useKeyboardNavigation({
    onEscape,
    onEnter,
    trapFocus,
    autoFocus
  });

  return (
    <div 
      ref={containerRef}
      className={`keyboard-navigation-container ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default {
  useKeyboardNavigation,
  useRovingTabIndex,
  getFocusableElements,
  focusUtils,
  KeyboardNavigationWrapper
};
