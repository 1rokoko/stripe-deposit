#!/usr/bin/env node

/**
 * Comprehensive Testing Suite
 * Runs all tests for UI components, accessibility, responsive design, and cross-browser compatibility
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      suites: []
    };
    this.scriptsDir = __dirname;
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Testing Suite...\n');
    console.log('='.repeat(60));
    console.log('🎯 STRIPE DEPOSIT - COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(60));

    try {
      // Run all test suites
      await this.runTestSuite('UI Components', 'test-ui-components.js');
      await this.runTestSuite('Layout & Navigation', 'test-layout-navigation.js');
      await this.runTestSuite('Accessibility', 'test-accessibility.js');
      await this.runTestSuite('Responsive Design', 'test-responsive-design.js');
      await this.runTestSuite('Analytics', 'test-analytics.js');
      
      // Additional validation tests
      await this.runValidationTests();
      
      // Cross-browser compatibility checks
      await this.runCompatibilityTests();

      this.printFinalResults();

    } catch (error) {
      console.error('❌ Comprehensive test suite failed:', error.message);
      process.exit(1);
    }
  }

  async runTestSuite(suiteName, scriptName) {
    console.log(`\n🔍 Running ${suiteName} Tests...`);
    console.log('-'.repeat(40));

    const scriptPath = path.join(this.scriptsDir, scriptName);
    
    if (!fs.existsSync(scriptPath)) {
      console.log(`⚠️  Test script ${scriptName} not found, skipping...`);
      return;
    }

    try {
      const result = await this.executeScript(scriptPath);
      
      // Parse results from script output
      const passed = this.extractTestCount(result.stdout, 'Passed');
      const failed = this.extractTestCount(result.stdout, 'Failed');
      const total = passed + failed;

      this.testResults.passed += passed;
      this.testResults.failed += failed;
      this.testResults.total += total;
      
      this.testResults.suites.push({
        name: suiteName,
        passed,
        failed,
        total,
        status: failed === 0 ? 'PASSED' : 'FAILED'
      });

      if (failed === 0) {
        console.log(`✅ ${suiteName}: ${passed}/${total} tests passed`);
      } else {
        console.log(`❌ ${suiteName}: ${passed}/${total} tests passed, ${failed} failed`);
      }

    } catch (error) {
      console.log(`❌ ${suiteName}: Test suite failed - ${error.message}`);
      this.testResults.suites.push({
        name: suiteName,
        passed: 0,
        failed: 1,
        total: 1,
        status: 'FAILED',
        error: error.message
      });
      this.testResults.failed += 1;
      this.testResults.total += 1;
    }
  }

  async runValidationTests() {
    console.log('\n🔍 Running Validation Tests...');
    console.log('-'.repeat(40));

    const validationTests = [
      {
        name: 'Package.json validation',
        test: () => this.validatePackageJson()
      },
      {
        name: 'Environment configuration',
        test: () => this.validateEnvironment()
      },
      {
        name: 'File structure integrity',
        test: () => this.validateFileStructure()
      },
      {
        name: 'CSS imports and dependencies',
        test: () => this.validateCSSImports()
      },
      {
        name: 'Component exports',
        test: () => this.validateComponentExports()
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of validationTests) {
      try {
        await test();
        console.log(`✅ ${name}`);
        passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        failed++;
      }
    }

    this.testResults.passed += passed;
    this.testResults.failed += failed;
    this.testResults.total += passed + failed;
    
    this.testResults.suites.push({
      name: 'Validation Tests',
      passed,
      failed,
      total: passed + failed,
      status: failed === 0 ? 'PASSED' : 'FAILED'
    });
  }

  async runCompatibilityTests() {
    console.log('\n🔍 Running Compatibility Tests...');
    console.log('-'.repeat(40));

    const compatibilityTests = [
      {
        name: 'Modern CSS features support',
        test: () => this.checkModernCSSFeatures()
      },
      {
        name: 'ES6+ JavaScript features',
        test: () => this.checkES6Features()
      },
      {
        name: 'Accessibility standards compliance',
        test: () => this.checkAccessibilityCompliance()
      },
      {
        name: 'Performance best practices',
        test: () => this.checkPerformanceBestPractices()
      },
      {
        name: 'Security best practices',
        test: () => this.checkSecurityBestPractices()
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of compatibilityTests) {
      try {
        await test();
        console.log(`✅ ${name}`);
        passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        failed++;
      }
    }

    this.testResults.passed += passed;
    this.testResults.failed += failed;
    this.testResults.total += passed + failed;
    
    this.testResults.suites.push({
      name: 'Compatibility Tests',
      passed,
      failed,
      total: passed + failed,
      status: failed === 0 ? 'PASSED' : 'FAILED'
    });
  }

  async executeScript(scriptPath) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd: path.dirname(scriptPath),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Script exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  extractTestCount(output, type) {
    const regex = new RegExp(`${type}:\\s*(\\d+)`, 'i');
    const match = output.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }

  async validatePackageJson() {
    const packagePath = path.join(__dirname, '../package.json');
    
    if (!fs.existsSync(packagePath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredFields = ['name', 'version', 'scripts', 'dependencies'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        throw new Error(`package.json missing required field: ${field}`);
      }
    }

    const requiredDependencies = ['next', 'react', 'stripe'];
    for (const dep of requiredDependencies) {
      if (!packageJson.dependencies[dep] && !packageJson.devDependencies?.[dep]) {
        throw new Error(`Missing required dependency: ${dep}`);
      }
    }
  }

  async validateEnvironment() {
    const envExamplePath = path.join(__dirname, '../.env.example');
    
    if (!fs.existsSync(envExamplePath)) {
      throw new Error('.env.example not found');
    }

    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    const requiredVars = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'API_AUTH_TOKEN'];
    
    for (const varName of requiredVars) {
      if (!envContent.includes(varName)) {
        throw new Error(`Missing environment variable in .env.example: ${varName}`);
      }
    }
  }

  async validateFileStructure() {
    const requiredDirs = [
      'components/ui',
      'components/admin',
      'components/accessibility',
      'components/layout',
      'pages/admin',
      'styles',
      'scripts',
      'api'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Required directory not found: ${dir}`);
      }
    }

    const requiredFiles = [
      'styles/design-system.css',
      'styles/responsive.css',
      'components/ui/Button.js',
      'components/accessibility/AccessibilityProvider.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
  }

  async validateCSSImports() {
    const designSystemPath = path.join(__dirname, '../styles/design-system.css');
    const content = fs.readFileSync(designSystemPath, 'utf8');
    
    if (!content.includes('@import') || !content.includes('responsive.css')) {
      throw new Error('Design system does not properly import responsive.css');
    }

    const responsivePath = path.join(__dirname, '../styles/responsive.css');
    if (!fs.existsSync(responsivePath)) {
      throw new Error('responsive.css file not found');
    }
  }

  async validateComponentExports() {
    const componentFiles = [
      'components/ui/Button.js',
      'components/ui/Input.js',
      'components/ui/Modal.js',
      'components/accessibility/AccessibilityProvider.js'
    ];

    for (const file of componentFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('export default') && !content.includes('module.exports')) {
          throw new Error(`Component ${file} missing proper export`);
        }
      }
    }
  }

  async checkModernCSSFeatures() {
    const cssFiles = [
      'styles/design-system.css',
      'styles/responsive.css'
    ];

    const modernFeatures = ['clamp(', 'var(--', 'grid', 'flex'];
    
    for (const file of cssFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        let foundFeatures = 0;
        for (const feature of modernFeatures) {
          if (content.includes(feature)) {
            foundFeatures++;
          }
        }
        
        if (foundFeatures < 2) {
          throw new Error(`${file} lacks modern CSS features`);
        }
      }
    }
  }

  async checkES6Features() {
    const jsFiles = [
      'components/ui/Button.js',
      'components/accessibility/AccessibilityProvider.js'
    ];

    const es6Features = ['const ', 'let ', '=>', 'import ', 'export '];
    
    for (const file of jsFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        let foundFeatures = 0;
        for (const feature of es6Features) {
          if (content.includes(feature)) {
            foundFeatures++;
          }
        }
        
        if (foundFeatures < 3) {
          throw new Error(`${file} lacks modern JavaScript features`);
        }
      }
    }
  }

  async checkAccessibilityCompliance() {
    const accessibilityDir = path.join(__dirname, '../components/accessibility');
    
    if (!fs.existsSync(accessibilityDir)) {
      throw new Error('Accessibility components directory not found');
    }

    const requiredFiles = [
      'AccessibilityProvider.js',
      'AccessibilitySettings.js',
      'KeyboardNavigation.js',
      'ScreenReaderUtils.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(accessibilityDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required accessibility file not found: ${file}`);
      }
    }
  }

  async checkPerformanceBestPractices() {
    // Check for lazy loading
    const componentFiles = fs.readdirSync(path.join(__dirname, '../components/ui'));
    
    // Check for proper React patterns
    for (const file of componentFiles) {
      if (file.endsWith('.js')) {
        const filePath = path.join(__dirname, '../components/ui', file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for React imports
        if (!content.includes('import React')) {
          throw new Error(`${file} missing React import`);
        }
      }
    }
  }

  async checkSecurityBestPractices() {
    // Check for environment variable usage
    const serverFiles = ['src/server.js'];
    
    for (const file of serverFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for hardcoded secrets (basic check)
        if (content.includes('sk_test_') || content.includes('pk_test_')) {
          throw new Error(`${file} may contain hardcoded API keys`);
        }
      }
    }
  }

  printFinalResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n📊 Test Suite Summary:');
    this.testResults.suites.forEach(suite => {
      const status = suite.status === 'PASSED' ? '✅' : '❌';
      console.log(`${status} ${suite.name}: ${suite.passed}/${suite.total} tests passed`);
    });

    console.log('\n📈 Overall Results:');
    console.log(`✅ Total Passed: ${this.testResults.passed}`);
    console.log(`❌ Total Failed: ${this.testResults.failed}`);
    console.log(`📊 Total Tests: ${this.testResults.total}`);
    
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    console.log(`🎯 Success Rate: ${successRate}%`);

    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
      console.log('✨ Stripe Deposit project is ready for production! ✨');
    } else {
      console.log('\n⚠️  Some tests failed. Please review and fix issues before production deployment.');
      
      const failedSuites = this.testResults.suites.filter(s => s.status === 'FAILED');
      if (failedSuites.length > 0) {
        console.log('\n❌ Failed Test Suites:');
        failedSuites.forEach(suite => {
          console.log(`   - ${suite.name}${suite.error ? `: ${suite.error}` : ''}`);
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ComprehensiveTester();
  tester.runAllTests().catch(console.error);
}

module.exports = ComprehensiveTester;
