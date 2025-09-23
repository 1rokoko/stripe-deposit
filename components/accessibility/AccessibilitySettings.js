import React, { useState } from 'react';
import { useAccessibility } from './AccessibilityProvider';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const AccessibilitySettings = ({ isOpen, onClose }) => {
  const { preferences, updatePreference, announce } = useAccessibility();
  const [hasChanges, setHasChanges] = useState(false);

  const handlePreferenceChange = (key, value) => {
    updatePreference(key, value);
    setHasChanges(true);
    
    // Announce the change
    const labels = {
      reducedMotion: 'Reduced motion',
      highContrast: 'High contrast',
      largeText: 'Large text',
      screenReader: 'Screen reader optimizations',
      keyboardNavigation: 'Keyboard navigation'
    };
    
    announce(`${labels[key]} ${value ? 'enabled' : 'disabled'}`, 'polite');
  };

  const resetToDefaults = () => {
    const defaults = {
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      screenReader: false,
      keyboardNavigation: true
    };
    
    Object.keys(defaults).forEach(key => {
      updatePreference(key, defaults[key]);
    });
    
    setHasChanges(true);
    announce('Accessibility settings reset to defaults', 'polite');
  };

  const handleSave = () => {
    setHasChanges(false);
    announce('Accessibility settings saved', 'polite');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accessibility Settings"
      size="md"
    >
      <div className="accessibility-settings">
        <div className="settings-description">
          <p className="text-gray-600 mb-6">
            Customize your experience to better suit your accessibility needs.
            These settings will be saved to your browser.
          </p>
        </div>

        <div className="settings-grid space-y-6">
          {/* Reduced Motion */}
          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="reduced-motion" className="setting-label">
                <span className="setting-icon" aria-hidden="true">🎭</span>
                Reduced Motion
              </label>
              <input
                id="reduced-motion"
                type="checkbox"
                checked={preferences.reducedMotion}
                onChange={(e) => handlePreferenceChange('reducedMotion', e.target.checked)}
                className="setting-checkbox"
                aria-describedby="reduced-motion-desc"
              />
            </div>
            <p id="reduced-motion-desc" className="setting-description">
              Reduces animations and transitions for users sensitive to motion.
            </p>
          </div>

          {/* High Contrast */}
          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="high-contrast" className="setting-label">
                <span className="setting-icon" aria-hidden="true">🎨</span>
                High Contrast
              </label>
              <input
                id="high-contrast"
                type="checkbox"
                checked={preferences.highContrast}
                onChange={(e) => handlePreferenceChange('highContrast', e.target.checked)}
                className="setting-checkbox"
                aria-describedby="high-contrast-desc"
              />
            </div>
            <p id="high-contrast-desc" className="setting-description">
              Increases color contrast for better visibility.
            </p>
          </div>

          {/* Large Text */}
          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="large-text" className="setting-label">
                <span className="setting-icon" aria-hidden="true">🔍</span>
                Large Text
              </label>
              <input
                id="large-text"
                type="checkbox"
                checked={preferences.largeText}
                onChange={(e) => handlePreferenceChange('largeText', e.target.checked)}
                className="setting-checkbox"
                aria-describedby="large-text-desc"
              />
            </div>
            <p id="large-text-desc" className="setting-description">
              Increases text size throughout the application.
            </p>
          </div>

          {/* Screen Reader Optimizations */}
          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="screen-reader" className="setting-label">
                <span className="setting-icon" aria-hidden="true">🔊</span>
                Screen Reader Optimizations
              </label>
              <input
                id="screen-reader"
                type="checkbox"
                checked={preferences.screenReader}
                onChange={(e) => handlePreferenceChange('screenReader', e.target.checked)}
                className="setting-checkbox"
                aria-describedby="screen-reader-desc"
              />
            </div>
            <p id="screen-reader-desc" className="setting-description">
              Optimizes the interface for screen reader users.
            </p>
          </div>

          {/* Keyboard Navigation */}
          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="keyboard-nav" className="setting-label">
                <span className="setting-icon" aria-hidden="true">⌨️</span>
                Enhanced Keyboard Navigation
              </label>
              <input
                id="keyboard-nav"
                type="checkbox"
                checked={preferences.keyboardNavigation}
                onChange={(e) => handlePreferenceChange('keyboardNavigation', e.target.checked)}
                className="setting-checkbox"
                aria-describedby="keyboard-nav-desc"
              />
            </div>
            <p id="keyboard-nav-desc" className="setting-description">
              Enhances keyboard navigation with visible focus indicators.
            </p>
          </div>
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="keyboard-shortcuts mt-8">
          <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <kbd className="shortcut-key">Tab</kbd>
              <span className="shortcut-desc">Navigate forward</span>
            </div>
            <div className="shortcut-item">
              <kbd className="shortcut-key">Shift + Tab</kbd>
              <span className="shortcut-desc">Navigate backward</span>
            </div>
            <div className="shortcut-item">
              <kbd className="shortcut-key">Enter</kbd>
              <span className="shortcut-desc">Activate button/link</span>
            </div>
            <div className="shortcut-item">
              <kbd className="shortcut-key">Space</kbd>
              <span className="shortcut-desc">Toggle checkbox/button</span>
            </div>
            <div className="shortcut-item">
              <kbd className="shortcut-key">Escape</kbd>
              <span className="shortcut-desc">Close modal/menu</span>
            </div>
            <div className="shortcut-item">
              <kbd className="shortcut-key">Arrow Keys</kbd>
              <span className="shortcut-desc">Navigate lists/menus</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <Button
            variant="secondary"
            onClick={resetToDefaults}
            className="mr-3"
          >
            Reset to Defaults
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Settings
          </Button>
        </div>
      </div>

      <style jsx>{`
        .accessibility-settings {
          max-width: 600px;
        }
        
        .setting-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          background: #f9fafb;
        }
        
        .setting-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .setting-label {
          display: flex;
          align-items: center;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
        }
        
        .setting-icon {
          margin-right: 8px;
          font-size: 18px;
        }
        
        .setting-checkbox {
          width: 20px;
          height: 20px;
          accent-color: #3b82f6;
        }
        
        .setting-description {
          color: #6b7280;
          font-size: 14px;
          margin: 0;
        }
        
        .keyboard-shortcuts {
          border-top: 1px solid #e5e7eb;
          padding-top: 24px;
        }
        
        .shortcuts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        
        .shortcut-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .shortcut-key {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 4px 8px;
          font-family: monospace;
          font-size: 12px;
          min-width: 60px;
          text-align: center;
        }
        
        .shortcut-desc {
          color: #6b7280;
          font-size: 14px;
        }
        
        .settings-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>
    </Modal>
  );
};

export default AccessibilitySettings;
