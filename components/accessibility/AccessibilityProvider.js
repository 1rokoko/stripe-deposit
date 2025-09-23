import React, { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext();

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider = ({ children }) => {
  const [preferences, setPreferences] = useState({
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    screenReader: false,
    keyboardNavigation: true
  });

  const [announcements, setAnnouncements] = useState([]);
  const [focusVisible, setFocusVisible] = useState(false);

  useEffect(() => {
    // Detect user preferences
    const detectPreferences = () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
      const screenReader = window.navigator.userAgent.includes('NVDA') || 
                          window.navigator.userAgent.includes('JAWS') ||
                          window.speechSynthesis;

      setPreferences(prev => ({
        ...prev,
        reducedMotion,
        highContrast,
        screenReader
      }));
    };

    detectPreferences();

    // Listen for preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    motionQuery.addEventListener('change', detectPreferences);
    contrastQuery.addEventListener('change', detectPreferences);

    return () => {
      motionQuery.removeEventListener('change', detectPreferences);
      contrastQuery.removeEventListener('change', detectPreferences);
    };
  }, []);

  useEffect(() => {
    // Apply accessibility preferences to document
    const root = document.documentElement;
    
    if (preferences.reducedMotion) {
      root.style.setProperty('--animation-duration', '0.01ms');
      root.style.setProperty('--transition-duration', '0.01ms');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }

    if (preferences.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (preferences.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
  }, [preferences]);

  useEffect(() => {
    // Keyboard navigation detection
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        setFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const announce = (message, priority = 'polite') => {
    const id = Date.now();
    const announcement = { id, message, priority };
    
    setAnnouncements(prev => [...prev, announcement]);
    
    // Remove announcement after it's been read
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 1000);
  };

  const updatePreference = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Save to localStorage
    localStorage.setItem('accessibility-preferences', JSON.stringify({
      ...preferences,
      [key]: value
    }));
  };

  const skipToContent = () => {
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const skipToNavigation = () => {
    const navigation = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (navigation) {
      navigation.focus();
      navigation.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const value = {
    preferences,
    updatePreference,
    announce,
    focusVisible,
    skipToContent,
    skipToNavigation,
    announcements
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      
      {/* Screen Reader Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="polite-announcements"
      >
        {announcements
          .filter(a => a.priority === 'polite')
          .map(a => (
            <div key={a.id}>{a.message}</div>
          ))
        }
      </div>
      
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        id="assertive-announcements"
      >
        {announcements
          .filter(a => a.priority === 'assertive')
          .map(a => (
            <div key={a.id}>{a.message}</div>
          ))
        }
      </div>

      {/* Skip Links */}
      <div className="skip-links">
        <button
          className="skip-link"
          onClick={skipToContent}
          onFocus={(e) => e.target.classList.add('visible')}
          onBlur={(e) => e.target.classList.remove('visible')}
        >
          Skip to main content
        </button>
        <button
          className="skip-link"
          onClick={skipToNavigation}
          onFocus={(e) => e.target.classList.add('visible')}
          onBlur={(e) => e.target.classList.remove('visible')}
        >
          Skip to navigation
        </button>
      </div>

      <style jsx>{`
        .skip-links {
          position: fixed;
          top: -100px;
          left: 0;
          z-index: 9999;
        }
        
        .skip-link {
          position: absolute;
          top: 0;
          left: 0;
          background: #000;
          color: #fff;
          padding: 8px 16px;
          text-decoration: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          transition: top 0.3s ease;
        }
        
        .skip-link.visible,
        .skip-link:focus {
          top: 100px;
        }
        
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
        
        /* High Contrast Mode */
        :global(.high-contrast) {
          --color-primary-500: #0000ff;
          --color-success-500: #008000;
          --color-error-500: #ff0000;
          --color-warning-500: #ffff00;
          --color-text: #000000;
          --color-background: #ffffff;
          --color-border: #000000;
        }
        
        /* Large Text Mode */
        :global(.large-text) {
          font-size: 120%;
        }
        
        :global(.large-text) h1 {
          font-size: 2.5rem;
        }
        
        :global(.large-text) h2 {
          font-size: 2rem;
        }
        
        :global(.large-text) h3 {
          font-size: 1.5rem;
        }
        
        /* Focus Visible Enhancement */
        :global(.focus-visible) *:focus {
          outline: 2px solid #0066cc;
          outline-offset: 2px;
        }
        
        /* Reduced Motion */
        :global([data-reduced-motion="true"]) * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `}</style>
    </AccessibilityContext.Provider>
  );
};

export default AccessibilityProvider;
