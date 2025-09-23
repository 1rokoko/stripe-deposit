#!/usr/bin/env node

/**
 * Accessibility Testing Script
 * Tests ARIA labels, keyboard navigation, focus management, and screen reader support
 */

const fs = require('fs');
const path = require('path');

class AccessibilityTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.componentsDir = path.join(__dirname, '../components');
    this.accessibilityDir = path.join(this.componentsDir, 'accessibility');
  }

  async runAllTests() {
    console.log('♿ Starting Accessibility Tests...\n');

    try {
      // Test accessibility components
      await this.testAccessibilityComponents();
      
      // Test ARIA implementation
      await this.testARIAImplementation();
      
      // Test keyboard navigation
      await this.testKeyboardNavigation();
      
      // Test screen reader support
      await this.testScreenReaderSupport();
      
      // Test focus management
      await this.testFocusManagement();

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testAccessibilityComponents() {
    console.log('♿ Testing Accessibility Components...');

    await this.test('AccessibilityProvider exists and is complete', async () => {
      const providerPath = path.join(this.accessibilityDir, 'AccessibilityProvider.js');
      
      if (!fs.existsSync(providerPath)) {
        throw new Error('AccessibilityProvider.js not found');
      }
      
      const content = fs.readFileSync(providerPath, 'utf8');
      
      const requiredFeatures = [
        'createContext',
        'useAccessibility',
        'reducedMotion',
        'highContrast',
        'largeText',
        'screenReader',
        'keyboardNavigation',
        'announce',
        'skipToContent',
        'skipToNavigation'
      ];
      
      for (const feature of requiredFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`AccessibilityProvider missing feature: ${feature}`);
        }
      }
      
      console.log('   ✅ AccessibilityProvider has all required features');
    });

    await this.test('AccessibilitySettings component exists', async () => {
      const settingsPath = path.join(this.accessibilityDir, 'AccessibilitySettings.js');
      
      if (!fs.existsSync(settingsPath)) {
        throw new Error('AccessibilitySettings.js not found');
      }
      
      const content = fs.readFileSync(settingsPath, 'utf8');
      
      const requiredElements = [
        'Modal',
        'checkbox',
        'aria-describedby',
        'keyboard shortcuts',
        'Reset to Defaults'
      ];
      
      for (const element of requiredElements) {
        if (!content.toLowerCase().includes(element.toLowerCase())) {
          throw new Error(`AccessibilitySettings missing element: ${element}`);
        }
      }
      
      console.log('   ✅ AccessibilitySettings component complete');
    });

    await this.test('KeyboardNavigation utilities exist', async () => {
      const keyboardPath = path.join(this.accessibilityDir, 'KeyboardNavigation.js');
      
      if (!fs.existsSync(keyboardPath)) {
        throw new Error('KeyboardNavigation.js not found');
      }
      
      const content = fs.readFileSync(keyboardPath, 'utf8');
      
      const requiredUtilities = [
        'useKeyboardNavigation',
        'useRovingTabIndex',
        'getFocusableElements',
        'focusUtils',
        'trapFocus',
        'onEscape',
        'onEnter',
        'onArrowUp',
        'onArrowDown'
      ];
      
      for (const utility of requiredUtilities) {
        if (!content.includes(utility)) {
          throw new Error(`KeyboardNavigation missing utility: ${utility}`);
        }
      }
      
      console.log('   ✅ KeyboardNavigation utilities complete');
    });

    await this.test('ScreenReaderUtils components exist', async () => {
      const screenReaderPath = path.join(this.accessibilityDir, 'ScreenReaderUtils.js');
      
      if (!fs.existsSync(screenReaderPath)) {
        throw new Error('ScreenReaderUtils.js not found');
      }
      
      const content = fs.readFileSync(screenReaderPath, 'utf8');
      
      const requiredComponents = [
        'ScreenReaderOnly',
        'LiveRegion',
        'ProgressAnnouncer',
        'StatusAnnouncer',
        'LoadingAnnouncer',
        'ValidationAnnouncer',
        'NavigationAnnouncer',
        'TableAnnouncer',
        'ModalAnnouncer',
        'SearchAnnouncer'
      ];
      
      for (const component of requiredComponents) {
        if (!content.includes(component)) {
          throw new Error(`ScreenReaderUtils missing component: ${component}`);
        }
      }
      
      console.log('   ✅ ScreenReaderUtils components complete');
    });
  }

  async testARIAImplementation() {
    console.log('\n🏷️ Testing ARIA Implementation...');

    await this.test('UI components have ARIA labels', async () => {
      const uiDir = path.join(this.componentsDir, 'ui');
      const uiComponents = ['Button.js', 'Input.js', 'Select.js', 'Modal.js', 'Table.js'];
      
      for (const component of uiComponents) {
        const componentPath = path.join(uiDir, component);
        if (fs.existsSync(componentPath)) {
          const content = fs.readFileSync(componentPath, 'utf8');
          
          const hasARIA = content.includes('aria-') || content.includes('role=');
          
          if (!hasARIA) {
            throw new Error(`${component} missing ARIA attributes`);
          }
        }
      }
      
      console.log('   ✅ UI components have ARIA labels');
    });

    await this.test('AdminLayout has accessibility integration', async () => {
      const layoutPath = path.join(this.componentsDir, 'admin', 'AdminLayout.js');
      
      if (!fs.existsSync(layoutPath)) {
        throw new Error('AdminLayout.js not found');
      }
      
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      const accessibilityFeatures = [
        'AccessibilityProvider',
        'AccessibilitySettings',
        'ScreenReaderOnly',
        'NavigationAnnouncer',
        'accessibility-button'
      ];
      
      for (const feature of accessibilityFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`AdminLayout missing accessibility feature: ${feature}`);
        }
      }
      
      console.log('   ✅ AdminLayout has accessibility integration');
    });

    await this.test('Form elements have proper labeling', async () => {
      const inputPath = path.join(this.componentsDir, 'ui', 'Input.js');
      
      if (fs.existsSync(inputPath)) {
        const content = fs.readFileSync(inputPath, 'utf8');
        
        const labelingFeatures = [
          'htmlFor',
          'aria-invalid',
          'aria-describedby',
          'role="alert"'
        ];
        
        for (const feature of labelingFeatures) {
          if (!content.includes(feature)) {
            throw new Error(`Input component missing labeling feature: ${feature}`);
          }
        }
      }
      
      console.log('   ✅ Form elements have proper labeling');
    });
  }

  async testKeyboardNavigation() {
    console.log('\n⌨️ Testing Keyboard Navigation...');

    await this.test('Interactive elements support keyboard events', async () => {
      const components = [
        { file: 'ui/Button.js', events: ['onClick'] },
        { file: 'ui/Select.js', events: ['onKeyDown', 'handleKeyDown'] },
        { file: 'ui/Modal.js', events: ['onKeyDown', 'Escape'] },
        { file: 'ui/Table.js', events: ['onKeyDown', 'tabIndex'] }
      ];
      
      for (const { file, events } of components) {
        const componentPath = path.join(this.componentsDir, file);
        
        if (fs.existsSync(componentPath)) {
          const content = fs.readFileSync(componentPath, 'utf8');
          
          let hasKeyboardSupport = false;
          for (const event of events) {
            if (content.includes(event)) {
              hasKeyboardSupport = true;
              break;
            }
          }
          
          if (!hasKeyboardSupport) {
            throw new Error(`${file} missing keyboard navigation support`);
          }
        }
      }
      
      console.log('   ✅ Interactive elements support keyboard events');
    });

    await this.test('Focus management implemented', async () => {
      const modalPath = path.join(this.componentsDir, 'ui', 'Modal.js');
      
      if (fs.existsSync(modalPath)) {
        const content = fs.readFileSync(modalPath, 'utf8');
        
        const focusFeatures = [
          'useRef',
          'focus()',
          'useEffect',
          'tabIndex',
          'previousActiveElement'
        ];
        
        let focusFeatureCount = 0;
        for (const feature of focusFeatures) {
          if (content.includes(feature)) {
            focusFeatureCount++;
          }
        }
        
        if (focusFeatureCount < 3) {
          throw new Error('Modal component insufficient focus management');
        }
      }
      
      console.log('   ✅ Focus management implemented');
    });

    await this.test('Skip links available', async () => {
      const providerPath = path.join(this.accessibilityDir, 'AccessibilityProvider.js');
      const content = fs.readFileSync(providerPath, 'utf8');
      
      if (!content.includes('Skip to main content') || !content.includes('Skip to navigation')) {
        throw new Error('Skip links not implemented');
      }
      
      console.log('   ✅ Skip links available');
    });
  }

  async testScreenReaderSupport() {
    console.log('\n🔊 Testing Screen Reader Support...');

    await this.test('Live regions implemented', async () => {
      const screenReaderPath = path.join(this.accessibilityDir, 'ScreenReaderUtils.js');
      const content = fs.readFileSync(screenReaderPath, 'utf8');
      
      const liveRegionFeatures = [
        'aria-live',
        'aria-atomic',
        'aria-relevant',
        'polite',
        'assertive'
      ];
      
      for (const feature of liveRegionFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Live regions missing feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Live regions implemented');
    });

    await this.test('Screen reader only content', async () => {
      const screenReaderPath = path.join(this.accessibilityDir, 'ScreenReaderUtils.js');
      const content = fs.readFileSync(screenReaderPath, 'utf8');
      
      if (!content.includes('sr-only') || !content.includes('ScreenReaderOnly')) {
        throw new Error('Screen reader only content not implemented');
      }
      
      console.log('   ✅ Screen reader only content implemented');
    });

    await this.test('Status announcements', async () => {
      const screenReaderPath = path.join(this.accessibilityDir, 'ScreenReaderUtils.js');
      const content = fs.readFileSync(screenReaderPath, 'utf8');
      
      const announcementTypes = [
        'StatusAnnouncer',
        'LoadingAnnouncer',
        'ValidationAnnouncer',
        'NavigationAnnouncer'
      ];
      
      for (const type of announcementTypes) {
        if (!content.includes(type)) {
          throw new Error(`Missing announcement type: ${type}`);
        }
      }
      
      console.log('   ✅ Status announcements implemented');
    });
  }

  async testFocusManagement() {
    console.log('\n🎯 Testing Focus Management...');

    await this.test('Focus utilities available', async () => {
      const keyboardPath = path.join(this.accessibilityDir, 'KeyboardNavigation.js');
      const content = fs.readFileSync(keyboardPath, 'utf8');
      
      const focusUtilities = [
        'focusUtils',
        'saveFocus',
        'restoreFocus',
        'focusFirst',
        'focusLast',
        'isFocusable'
      ];
      
      for (const utility of focusUtilities) {
        if (!content.includes(utility)) {
          throw new Error(`Missing focus utility: ${utility}`);
        }
      }
      
      console.log('   ✅ Focus utilities available');
    });

    await this.test('Focus trap implementation', async () => {
      const keyboardPath = path.join(this.accessibilityDir, 'KeyboardNavigation.js');
      const content = fs.readFileSync(keyboardPath, 'utf8');
      
      if (!content.includes('trapFocus') || !content.includes('getFocusableElements')) {
        throw new Error('Focus trap not properly implemented');
      }
      
      console.log('   ✅ Focus trap implementation available');
    });

    await this.test('Roving tabindex support', async () => {
      const keyboardPath = path.join(this.accessibilityDir, 'KeyboardNavigation.js');
      const content = fs.readFileSync(keyboardPath, 'utf8');
      
      if (!content.includes('useRovingTabIndex') || !content.includes('tabIndex')) {
        throw new Error('Roving tabindex not implemented');
      }
      
      console.log('   ✅ Roving tabindex support available');
    });
  }

  async test(name, testFn) {
    try {
      await testFn();
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: 'PASSED' });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAILED', error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('♿ ACCESSIBILITY TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total: ${this.testResults.passed + this.testResults.failed}`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
    }
    
    console.log('\n🎉 Accessibility testing completed!');
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AccessibilityTester();
  tester.runAllTests().catch(console.error);
}

module.exports = AccessibilityTester;
