#!/usr/bin/env node

/**
 * UI Components Testing Script
 * Tests all UI components for functionality and accessibility
 */

const fs = require('fs');
const path = require('path');

class UIComponentTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.componentsDir = path.join(__dirname, '../components/ui');
    this.stylesDir = path.join(__dirname, '../styles');
  }

  async runAllTests() {
    console.log('🎨 Starting UI Components Tests...\n');

    try {
      // Test design system
      await this.testDesignSystem();
      
      // Test component files
      await this.testComponentFiles();
      
      // Test component structure
      await this.testComponentStructure();
      
      // Test accessibility features
      await this.testAccessibilityFeatures();

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testDesignSystem() {
    console.log('🎨 Testing Design System...');

    await this.test('Design system file exists', async () => {
      const designSystemPath = path.join(this.stylesDir, 'design-system.css');
      if (!fs.existsSync(designSystemPath)) {
        throw new Error('design-system.css not found');
      }
      
      const content = fs.readFileSync(designSystemPath, 'utf8');
      
      // Check for essential CSS variables
      const requiredVariables = [
        '--color-primary-500',
        '--color-success-500',
        '--color-error-500',
        '--font-family-sans',
        '--space-4',
        '--border-radius-md',
        '--shadow-md'
      ];
      
      for (const variable of requiredVariables) {
        if (!content.includes(variable)) {
          throw new Error(`Missing CSS variable: ${variable}`);
        }
      }
      
      console.log('   ✅ All essential CSS variables present');
    });

    await this.test('Utility classes defined', async () => {
      const designSystemPath = path.join(this.stylesDir, 'design-system.css');
      const content = fs.readFileSync(designSystemPath, 'utf8');
      
      const requiredClasses = [
        '.flex',
        '.items-center',
        '.justify-center',
        '.p-4',
        '.m-4',
        '.text-primary',
        '.bg-surface',
        '.border',
        '.rounded',
        '.shadow'
      ];
      
      for (const className of requiredClasses) {
        if (!content.includes(className)) {
          throw new Error(`Missing utility class: ${className}`);
        }
      }
      
      console.log('   ✅ All essential utility classes present');
    });

    await this.test('Dark mode support', async () => {
      const designSystemPath = path.join(this.stylesDir, 'design-system.css');
      const content = fs.readFileSync(designSystemPath, 'utf8');
      
      if (!content.includes('@media (prefers-color-scheme: dark)')) {
        throw new Error('Dark mode support not found');
      }
      
      console.log('   ✅ Dark mode support implemented');
    });
  }

  async testComponentFiles() {
    console.log('\n🧩 Testing Component Files...');

    const expectedComponents = [
      'Button.js',
      'Input.js',
      'Select.js',
      'Modal.js',
      'Toast.js',
      'LoadingSpinner.js',
      'Table.js',
      'Badge.js'
    ];

    for (const component of expectedComponents) {
      await this.test(`${component} exists and is valid`, async () => {
        const componentPath = path.join(this.componentsDir, component);
        
        if (!fs.existsSync(componentPath)) {
          throw new Error(`Component file ${component} not found`);
        }
        
        const content = fs.readFileSync(componentPath, 'utf8');
        
        // Check for React import
        if (!content.includes('import React')) {
          throw new Error(`${component} missing React import`);
        }
        
        // Check for export
        if (!content.includes('export default')) {
          throw new Error(`${component} missing default export`);
        }
        
        // Check for basic component structure
        if (!content.includes('const ') && !content.includes('function ')) {
          throw new Error(`${component} missing component definition`);
        }
        
        console.log(`   ✅ ${component} structure valid`);
      });
    }
  }

  async testComponentStructure() {
    console.log('\n🏗️ Testing Component Structure...');

    await this.test('Button component features', async () => {
      const buttonPath = path.join(this.componentsDir, 'Button.js');
      const content = fs.readFileSync(buttonPath, 'utf8');
      
      const requiredFeatures = [
        'variant',
        'size',
        'disabled',
        'loading',
        'onClick',
        'LoadingSpinner'
      ];
      
      for (const feature of requiredFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Button missing feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Button component has all required features');
    });

    await this.test('Input component accessibility', async () => {
      const inputPath = path.join(this.componentsDir, 'Input.js');
      const content = fs.readFileSync(inputPath, 'utf8');
      
      const accessibilityFeatures = [
        'aria-invalid',
        'aria-describedby',
        'htmlFor',
        'role="alert"',
        'forwardRef'
      ];
      
      for (const feature of accessibilityFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Input missing accessibility feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Input component has accessibility features');
    });

    await this.test('Modal component focus management', async () => {
      const modalPath = path.join(this.componentsDir, 'Modal.js');
      const content = fs.readFileSync(modalPath, 'utf8');
      
      const focusFeatures = [
        'useRef',
        'useEffect',
        'focus()',
        'tabIndex',
        'onKeyDown',
        'createPortal'
      ];
      
      for (const feature of focusFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Modal missing focus feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Modal component has focus management');
    });

    await this.test('Toast context provider', async () => {
      const toastPath = path.join(this.componentsDir, 'Toast.js');
      const content = fs.readFileSync(toastPath, 'utf8');
      
      const contextFeatures = [
        'createContext',
        'useContext',
        'ToastProvider',
        'useToast',
        'addToast',
        'removeToast'
      ];
      
      for (const feature of contextFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Toast missing context feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Toast component has context provider');
    });
  }

  async testAccessibilityFeatures() {
    console.log('\n♿ Testing Accessibility Features...');

    await this.test('ARIA labels and roles', async () => {
      const components = ['Input.js', 'Select.js', 'Modal.js', 'Table.js'];
      
      for (const component of components) {
        const componentPath = path.join(this.componentsDir, component);
        const content = fs.readFileSync(componentPath, 'utf8');
        
        const hasAriaFeatures = content.includes('aria-') || content.includes('role=');
        
        if (!hasAriaFeatures) {
          throw new Error(`${component} missing ARIA features`);
        }
      }
      
      console.log('   ✅ All components have ARIA features');
    });

    await this.test('Keyboard navigation support', async () => {
      const components = ['Select.js', 'Modal.js', 'Table.js'];
      
      for (const component of components) {
        const componentPath = path.join(this.componentsDir, component);
        const content = fs.readFileSync(componentPath, 'utf8');
        
        const hasKeyboardSupport = content.includes('onKeyDown') || content.includes('handleKeyDown');
        
        if (!hasKeyboardSupport) {
          throw new Error(`${component} missing keyboard navigation`);
        }
      }
      
      console.log('   ✅ Interactive components have keyboard navigation');
    });

    await this.test('Focus management', async () => {
      const components = ['Modal.js', 'Select.js'];
      
      for (const component of components) {
        const componentPath = path.join(this.componentsDir, component);
        const content = fs.readFileSync(componentPath, 'utf8');
        
        const hasFocusManagement = content.includes('focus()') && content.includes('useRef');
        
        if (!hasFocusManagement) {
          throw new Error(`${component} missing focus management`);
        }
      }
      
      console.log('   ✅ Components have proper focus management');
    });

    await this.test('Screen reader support', async () => {
      const designSystemPath = path.join(this.stylesDir, 'design-system.css');
      const content = fs.readFileSync(designSystemPath, 'utf8');
      
      if (!content.includes('.sr-only')) {
        throw new Error('Screen reader utility class not found');
      }
      
      console.log('   ✅ Screen reader support utilities available');
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
    console.log('🎨 UI COMPONENTS TEST RESULTS');
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
    
    console.log('\n🎉 UI Components testing completed!');
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new UIComponentTester();
  tester.runAllTests().catch(console.error);
}

module.exports = UIComponentTester;
