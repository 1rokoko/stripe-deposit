#!/usr/bin/env node

/**
 * Responsive Design Testing Script
 * Tests mobile-first responsive design, breakpoints, and flexible layouts
 */

const fs = require('fs');
const path = require('path');

class ResponsiveDesignTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.stylesDir = path.join(__dirname, '../styles');
    this.componentsDir = path.join(__dirname, '../components');
  }

  async runAllTests() {
    console.log('📱 Starting Responsive Design Tests...\n');

    try {
      // Test responsive CSS system
      await this.testResponsiveCSSSystem();
      
      // Test responsive components
      await this.testResponsiveComponents();
      
      // Test breakpoint implementation
      await this.testBreakpointImplementation();
      
      // Test mobile-first approach
      await this.testMobileFirstApproach();
      
      // Test layout responsiveness
      await this.testLayoutResponsiveness();

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testResponsiveCSSSystem() {
    console.log('📱 Testing Responsive CSS System...');

    await this.test('Responsive CSS file exists and is complete', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      
      if (!fs.existsSync(responsivePath)) {
        throw new Error('responsive.css not found');
      }
      
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      const requiredFeatures = [
        '--breakpoint-xs',
        '--breakpoint-sm',
        '--breakpoint-md',
        '--breakpoint-lg',
        '--breakpoint-xl',
        'container',
        'grid',
        'flex',
        'clamp(',
        '@media (min-width:'
      ];
      
      for (const feature of requiredFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Responsive CSS missing feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Responsive CSS system complete');
    });

    await this.test('CSS variables for responsive spacing', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      const spacingVariables = [
        '--space-responsive-xs',
        '--space-responsive-sm',
        '--space-responsive-md',
        '--space-responsive-lg',
        '--space-responsive-xl'
      ];
      
      for (const variable of spacingVariables) {
        if (!content.includes(variable)) {
          throw new Error(`Missing responsive spacing variable: ${variable}`);
        }
      }
      
      console.log('   ✅ Responsive spacing variables implemented');
    });

    await this.test('Responsive typography with clamp()', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      const typographyFeatures = [
        '--text-responsive-xs',
        '--text-responsive-base',
        '--text-responsive-xl',
        'clamp(',
        'heading-responsive-1',
        'heading-responsive-2'
      ];
      
      for (const feature of typographyFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Missing responsive typography feature: ${feature}`);
        }
      }
      
      console.log('   ✅ Responsive typography with clamp() implemented');
    });

    await this.test('Design system imports responsive CSS', async () => {
      const designSystemPath = path.join(this.stylesDir, 'design-system.css');
      
      if (fs.existsSync(designSystemPath)) {
        const content = fs.readFileSync(designSystemPath, 'utf8');
        
        if (!content.includes('@import') || !content.includes('responsive.css')) {
          throw new Error('Design system does not import responsive CSS');
        }
      }
      
      console.log('   ✅ Design system imports responsive CSS');
    });
  }

  async testResponsiveComponents() {
    console.log('\n🧩 Testing Responsive Components...');

    await this.test('ResponsiveLayout components exist', async () => {
      const layoutPath = path.join(this.componentsDir, 'layout', 'ResponsiveLayout.js');
      
      if (!fs.existsSync(layoutPath)) {
        throw new Error('ResponsiveLayout.js not found');
      }
      
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      const requiredComponents = [
        'useBreakpoint',
        'ResponsiveContainer',
        'ResponsiveGrid',
        'ResponsiveFlex',
        'ResponsiveCard',
        'ResponsiveText',
        'ResponsiveHeading',
        'ResponsiveShow',
        'ResponsiveHide',
        'ResponsiveImage',
        'ResponsiveLayout'
      ];
      
      for (const component of requiredComponents) {
        if (!content.includes(component)) {
          throw new Error(`ResponsiveLayout missing component: ${component}`);
        }
      }
      
      console.log('   ✅ ResponsiveLayout components complete');
    });

    await this.test('useBreakpoint hook implementation', async () => {
      const layoutPath = path.join(this.componentsDir, 'layout', 'ResponsiveLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      const hookFeatures = [
        'useState',
        'useEffect',
        'window.innerWidth',
        'addEventListener',
        'removeEventListener',
        'isMobile',
        'isTablet',
        'isDesktop'
      ];
      
      for (const feature of hookFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`useBreakpoint hook missing feature: ${feature}`);
        }
      }
      
      console.log('   ✅ useBreakpoint hook properly implemented');
    });

    await this.test('Responsive grid system', async () => {
      const layoutPath = path.join(this.componentsDir, 'layout', 'ResponsiveLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('ResponsiveGrid') || !content.includes('grid-cols-')) {
        throw new Error('ResponsiveGrid component not properly implemented');
      }
      
      if (!content.includes('xs:') || !content.includes('md:') || !content.includes('lg:')) {
        throw new Error('ResponsiveGrid missing breakpoint props');
      }
      
      console.log('   ✅ Responsive grid system implemented');
    });

    await this.test('Responsive show/hide utilities', async () => {
      const layoutPath = path.join(this.componentsDir, 'layout', 'ResponsiveLayout.js');
      const content = fs.readFileSync(layoutPath, 'utf8');
      
      if (!content.includes('ResponsiveShow') || !content.includes('ResponsiveHide')) {
        throw new Error('ResponsiveShow/Hide components not found');
      }
      
      if (!content.includes('hidden') || !content.includes('block')) {
        throw new Error('Show/Hide utilities not properly implemented');
      }
      
      console.log('   ✅ Responsive show/hide utilities implemented');
    });
  }

  async testBreakpointImplementation() {
    console.log('\n📏 Testing Breakpoint Implementation...');

    await this.test('Standard breakpoints defined', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      const standardBreakpoints = [
        '640px', // sm
        '768px', // md
        '1024px', // lg
        '1280px', // xl
        '1536px'  // 2xl
      ];
      
      for (const breakpoint of standardBreakpoints) {
        if (!content.includes(breakpoint)) {
          throw new Error(`Missing standard breakpoint: ${breakpoint}`);
        }
      }
      
      console.log('   ✅ Standard breakpoints defined');
    });

    await this.test('Media queries follow mobile-first', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      // Check for min-width media queries (mobile-first)
      const mobileFirstQueries = [
        '@media (min-width: 640px)',
        '@media (min-width: 768px)',
        '@media (min-width: 1024px)',
        '@media (min-width: 1280px)'
      ];
      
      for (const query of mobileFirstQueries) {
        if (!content.includes(query)) {
          throw new Error(`Missing mobile-first media query: ${query}`);
        }
      }
      
      // Check that max-width queries are minimal (should be mobile-first)
      const maxWidthCount = (content.match(/@media \(max-width:/g) || []).length;
      if (maxWidthCount > 2) { // Allow some for special cases like print
        throw new Error('Too many max-width media queries - not mobile-first');
      }
      
      console.log('   ✅ Media queries follow mobile-first approach');
    });

    await this.test('Responsive utility classes', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      const utilityClasses = [
        'sm\\:hidden',
        'md\\:block',
        'lg\\:flex',
        'xl\\:grid',
        'sm\\:grid-cols-2',
        'md\\:grid-cols-3',
        'lg\\:grid-cols-4'
      ];
      
      for (const utilityClass of utilityClasses) {
        if (!content.includes(utilityClass)) {
          throw new Error(`Missing responsive utility class: ${utilityClass}`);
        }
      }
      
      console.log('   ✅ Responsive utility classes implemented');
    });
  }

  async testMobileFirstApproach() {
    console.log('\n📱 Testing Mobile-First Approach...');

    await this.test('Base styles are mobile-optimized', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      // Check for mobile-first indicators
      const mobileFirstIndicators = [
        'min-height: 44px', // Touch-friendly minimum
        'flex-direction: column', // Mobile-first layout
        'width: 100%', // Full width by default
        'padding-left: var(--space-4)', // Mobile padding
        'padding-right: var(--space-4)'
      ];
      
      let foundIndicators = 0;
      for (const indicator of mobileFirstIndicators) {
        if (content.includes(indicator)) {
          foundIndicators++;
        }
      }
      
      if (foundIndicators < 3) {
        throw new Error('Insufficient mobile-first base styles');
      }
      
      console.log('   ✅ Base styles are mobile-optimized');
    });

    await this.test('Touch-friendly interaction areas', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      // Check for 44px minimum (Apple's recommended touch target size)
      if (!content.includes('44px')) {
        throw new Error('Touch-friendly minimum size (44px) not found');
      }
      
      console.log('   ✅ Touch-friendly interaction areas implemented');
    });

    await this.test('Fluid typography with clamp()', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      const clampCount = (content.match(/clamp\(/g) || []).length;
      
      if (clampCount < 5) {
        throw new Error('Insufficient use of clamp() for fluid typography');
      }
      
      console.log('   ✅ Fluid typography with clamp() implemented');
    });
  }

  async testLayoutResponsiveness() {
    console.log('\n🏗️ Testing Layout Responsiveness...');

    await this.test('AdminLayout responsive integration', async () => {
      const adminLayoutPath = path.join(this.componentsDir, 'admin', 'AdminLayout.js');
      
      if (fs.existsSync(adminLayoutPath)) {
        const content = fs.readFileSync(adminLayoutPath, 'utf8');
        
        const responsiveFeatures = [
          '@media (max-width: 768px)',
          'transform: translateX',
          'position: fixed',
          'mobile-menu-button',
          'sidebar-overlay'
        ];
        
        for (const feature of responsiveFeatures) {
          if (!content.includes(feature)) {
            throw new Error(`AdminLayout missing responsive feature: ${feature}`);
          }
        }
      }
      
      console.log('   ✅ AdminLayout responsive integration complete');
    });

    await this.test('Dashboard responsive components', async () => {
      const dashboardPath = path.join(__dirname, '../pages/admin/dashboard.js');
      
      if (fs.existsSync(dashboardPath)) {
        const content = fs.readFileSync(dashboardPath, 'utf8');
        
        const responsiveImports = [
          'ResponsiveContainer',
          'ResponsiveGrid',
          'useBreakpoint'
        ];
        
        let foundImports = 0;
        for (const importName of responsiveImports) {
          if (content.includes(importName)) {
            foundImports++;
          }
        }
        
        if (foundImports < 2) {
          throw new Error('Dashboard missing responsive component imports');
        }
      }
      
      console.log('   ✅ Dashboard responsive components integrated');
    });

    await this.test('Print styles included', async () => {
      const responsivePath = path.join(this.stylesDir, 'responsive.css');
      const content = fs.readFileSync(responsivePath, 'utf8');
      
      if (!content.includes('@media print')) {
        throw new Error('Print styles not included');
      }
      
      if (!content.includes('print\\:hidden') || !content.includes('print\\:block')) {
        throw new Error('Print utility classes not implemented');
      }
      
      console.log('   ✅ Print styles included');
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
    console.log('📱 RESPONSIVE DESIGN TEST RESULTS');
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
    
    console.log('\n🎉 Responsive design testing completed!');
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ResponsiveDesignTester();
  tester.runAllTests().catch(console.error);
}

module.exports = ResponsiveDesignTester;
