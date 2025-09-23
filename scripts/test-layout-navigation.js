#!/usr/bin/env node

/**
 * Layout & Navigation Testing Script
 * Tests responsive design, mobile navigation, and layout improvements
 */

const fs = require('fs');
const path = require('path');

class LayoutNavigationTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.componentsDir = path.join(__dirname, '../components/admin');
    this.pagesDir = path.join(__dirname, '../pages/admin');
  }

  async runAllTests() {
    console.log('🏗️ Starting Layout & Navigation Tests...\n');

    try {
      // Test AdminLayout improvements
      await this.testAdminLayoutImprovements();
      
      // Test responsive design
      await this.testResponsiveDesign();
      
      // Test mobile navigation
      await this.testMobileNavigation();
      
      // Test page integrations
      await this.testPageIntegrations();

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testAdminLayoutImprovements() {
    console.log('🏗️ Testing AdminLayout Improvements...');

    await this.test('AdminLayout has ToastProvider integration', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('ToastProvider')) {
        throw new Error('ToastProvider not integrated in AdminLayout');
      }
      
      if (!content.includes('import { ToastProvider }')) {
        throw new Error('ToastProvider not imported');
      }
      
      console.log('   ✅ ToastProvider properly integrated');
    });

    await this.test('Mobile menu button implemented', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('mobile-menu-button')) {
        throw new Error('Mobile menu button not found');
      }
      
      if (!content.includes('Toggle navigation menu')) {
        throw new Error('Mobile menu button missing aria-label');
      }
      
      console.log('   ✅ Mobile menu button implemented with accessibility');
    });

    await this.test('Responsive CSS media queries', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      const requiredMediaQueries = [
        '@media (max-width: 768px)',
        '@media (min-width: 769px) and (max-width: 1024px)'
      ];
      
      for (const query of requiredMediaQueries) {
        if (!content.includes(query)) {
          throw new Error(`Missing media query: ${query}`);
        }
      }
      
      console.log('   ✅ Responsive media queries implemented');
    });

    await this.test('Sidebar overlay for mobile', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('sidebar-overlay')) {
        throw new Error('Sidebar overlay not implemented');
      }
      
      if (!content.includes('onClick={() => setSidebarOpen(false)}')) {
        throw new Error('Sidebar overlay click handler missing');
      }
      
      console.log('   ✅ Sidebar overlay implemented for mobile');
    });
  }

  async testResponsiveDesign() {
    console.log('\n📱 Testing Responsive Design...');

    await this.test('Mobile-first CSS approach', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      // Check for mobile-first approach (base styles, then media queries)
      const mobileFirstIndicators = [
        'transform: translateX(-100%)',
        'position: fixed',
        'z-index: 1000'
      ];
      
      for (const indicator of mobileFirstIndicators) {
        if (!content.includes(indicator)) {
          throw new Error(`Mobile-first indicator missing: ${indicator}`);
        }
      }
      
      console.log('   ✅ Mobile-first CSS approach implemented');
    });

    await this.test('Tablet responsive breakpoints', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('width: 60px')) {
        throw new Error('Tablet collapsed sidebar width not defined');
      }
      
      if (!content.includes('margin-left: 60px')) {
        throw new Error('Tablet main content margin not adjusted');
      }
      
      console.log('   ✅ Tablet responsive breakpoints implemented');
    });

    await this.test('Enhanced animations and transitions', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      const animationFeatures = [
        'transition: transform 0.3s ease-in-out',
        'transition: opacity 0.3s ease-in-out',
        'transition: all 0.2s ease'
      ];
      
      for (const feature of animationFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Animation feature missing: ${feature}`);
        }
      }
      
      console.log('   ✅ Enhanced animations and transitions implemented');
    });
  }

  async testMobileNavigation() {
    console.log('\n📲 Testing Mobile Navigation...');

    await this.test('Mobile navigation accessibility', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      const accessibilityFeatures = [
        'aria-label="Toggle navigation menu"',
        'aria-hidden="true"',
        'role="button"'
      ];
      
      let foundFeatures = 0;
      for (const feature of accessibilityFeatures) {
        if (content.includes(feature)) {
          foundFeatures++;
        }
      }
      
      if (foundFeatures < 2) {
        throw new Error('Insufficient mobile navigation accessibility features');
      }
      
      console.log('   ✅ Mobile navigation accessibility implemented');
    });

    await this.test('Touch-friendly interaction areas', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      // Check for adequate touch targets (44px minimum recommended)
      if (!content.includes('padding: 8px')) {
        throw new Error('Touch-friendly padding not found');
      }
      
      console.log('   ✅ Touch-friendly interaction areas implemented');
    });

    await this.test('Sidebar state management', async () => {
      const layoutPath = path.join(this.componentsDir, 'AdminLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('setSidebarOpen')) {
        throw new Error('Sidebar state management not found');
      }
      
      if (!content.includes('sidebarOpen')) {
        throw new Error('Sidebar state variable not found');
      }
      
      console.log('   ✅ Sidebar state management implemented');
    });
  }

  async testPageIntegrations() {
    console.log('\n🔗 Testing Page Integrations...');

    await this.test('Analytics page UI improvements', async () => {
      const analyticsPath = path.join(this.pagesDir, 'analytics.js');
      
      if (!fs.existsSync(analyticsPath)) {
        throw new Error('Analytics page not found');
      }
      
      const content = fs.readFileSync(analyticsPath, 'utf8');
      
      const requiredImports = [
        'LoadingSpinner',
        'Button',
        'useToast'
      ];
      
      for (const importName of requiredImports) {
        if (!content.includes(importName)) {
          throw new Error(`Missing import: ${importName}`);
        }
      }
      
      console.log('   ✅ Analytics page UI improvements implemented');
    });

    await this.test('Export functionality integration', async () => {
      const analyticsPath = path.join(this.pagesDir, 'analytics.js');
      const content = fs.readFileSync(analyticsPath, 'utf8');
      
      if (!content.includes('handleExport')) {
        throw new Error('Export functionality not found');
      }
      
      if (!content.includes('Export CSV') || !content.includes('Export Excel')) {
        throw new Error('Export buttons not found');
      }
      
      console.log('   ✅ Export functionality integration implemented');
    });

    await this.test('Toast notifications integration', async () => {
      const analyticsPath = path.join(this.pagesDir, 'analytics.js');
      const content = fs.readFileSync(analyticsPath, 'utf8');
      
      if (!content.includes('toast.success') || !content.includes('toast.error')) {
        throw new Error('Toast notifications not integrated');
      }
      
      console.log('   ✅ Toast notifications integration implemented');
    });

    await this.test('Loading states with new components', async () => {
      const analyticsPath = path.join(this.pagesDir, 'analytics.js');
      const content = fs.readFileSync(analyticsPath, 'utf8');
      
      if (!content.includes('<LoadingSpinner')) {
        throw new Error('LoadingSpinner component not used');
      }
      
      if (!content.includes('loading={loading}') && !content.includes('loading={exporting}')) {
        throw new Error('Loading states not properly implemented');
      }
      
      console.log('   ✅ Loading states with new components implemented');
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
    console.log('🏗️ LAYOUT & NAVIGATION TEST RESULTS');
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
    
    console.log('\n🎉 Layout & Navigation testing completed!');
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new LayoutNavigationTester();
  tester.runAllTests().catch(console.error);
}

module.exports = LayoutNavigationTester;
