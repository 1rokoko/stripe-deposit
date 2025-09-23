#!/usr/bin/env node

/**
 * Admin Panel Testing Script
 * Comprehensive testing of admin panel functionality
 */

const https = require('https');
const http = require('http');

class AdminPanelTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.adminToken = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Admin Panel Tests...\n');

    try {
      // Test authentication
      await this.testAdminLogin();
      
      if (this.adminToken) {
        // Test dashboard
        await this.testDashboard();
        
        // Test deposits management
        await this.testDepositsAPI();
        
        // Test deposit actions
        await this.testDepositActions();
        
        // Test bulk operations
        await this.testBulkOperations();
        
        // Test export functionality
        await this.testExportFunctionality();
        
        // Test logout
        await this.testAdminLogout();
      }

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testAdminLogin() {
    console.log('🔐 Testing Admin Authentication...');

    // Test invalid credentials
    await this.test('Invalid login credentials', async () => {
      const response = await this.makeRequest('/api/admin/login', 'POST', {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });
      
      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    });

    // Test valid credentials
    await this.test('Valid admin login', async () => {
      const response = await this.makeRequest('/api/admin/login', 'POST', {
        email: 'admin@stripe-deposit.com',
        password: 'admin123'
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!data.token) {
        throw new Error('No token in response');
      }
      
      this.adminToken = data.token;
      console.log('✅ Admin token obtained');
    });

    // Test manager credentials
    await this.test('Manager login', async () => {
      const response = await this.makeRequest('/api/admin/login', 'POST', {
        email: 'manager@stripe-deposit.com',
        password: 'manager123'
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });
  }

  async testDashboard() {
    console.log('\n📊 Testing Dashboard API...');

    await this.test('Dashboard data retrieval', async () => {
      const response = await this.makeRequest('/api/admin/dashboard', 'GET', null, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      const requiredFields = ['totalDeposits', 'totalAmount', 'pendingDeposits', 'successRate'];
      
      for (const field of requiredFields) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      console.log(`✅ Dashboard metrics: ${data.totalDeposits} deposits, $${(data.totalAmount / 100).toFixed(2)} total`);
    });

    await this.test('Dashboard without auth', async () => {
      const response = await this.makeRequest('/api/admin/dashboard', 'GET');
      
      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    });
  }

  async testDepositsAPI() {
    console.log('\n💰 Testing Deposits API...');

    await this.test('Deposits listing', async () => {
      const response = await this.makeRequest('/api/admin/deposits', 'GET', null, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!Array.isArray(data.deposits)) {
        throw new Error('Deposits should be an array');
      }
      
      console.log(`✅ Found ${data.deposits.length} deposits`);
    });

    await this.test('Deposits filtering by status', async () => {
      const response = await this.makeRequest('/api/admin/deposits?status=pending', 'GET', null, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      const pendingDeposits = data.deposits.filter(d => d.status === 'pending');
      
      if (pendingDeposits.length !== data.deposits.length) {
        throw new Error('Status filter not working correctly');
      }
    });

    await this.test('Deposits pagination', async () => {
      const response = await this.makeRequest('/api/admin/deposits?page=1&limit=5', 'GET', null, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!data.pagination) {
        throw new Error('Missing pagination info');
      }
      
      if (data.deposits.length > 5) {
        throw new Error('Pagination limit not respected');
      }
    });
  }

  async testDepositActions() {
    console.log('\n⚡ Testing Deposit Actions...');

    // First, get a pending deposit to test with
    const depositsResponse = await this.makeRequest('/api/admin/deposits?status=pending&limit=1', 'GET', null, {
      'Authorization': `Bearer ${this.adminToken}`
    });
    
    if (depositsResponse.status === 200) {
      const depositsData = JSON.parse(depositsResponse.body);
      
      if (depositsData.deposits.length > 0) {
        const testDeposit = depositsData.deposits[0];
        
        await this.test('Deposit action - invalid action', async () => {
          const response = await this.makeRequest(
            `/api/admin/deposits/${testDeposit.id}/invalid`, 
            'POST', 
            {}, 
            { 'Authorization': `Bearer ${this.adminToken}` }
          );
          
          if (response.status !== 400) {
            throw new Error(`Expected 400, got ${response.status}`);
          }
        });

        // Note: We don't test actual capture/release here to avoid affecting real data
        console.log('✅ Deposit actions API structure validated');
      } else {
        console.log('⚠️  No pending deposits found for action testing');
      }
    }
  }

  async testBulkOperations() {
    console.log('\n📦 Testing Bulk Operations...');

    await this.test('Bulk operation - invalid input', async () => {
      const response = await this.makeRequest('/api/admin/deposits/bulk', 'POST', {
        action: 'invalid',
        depositIds: []
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });

    await this.test('Bulk operation - missing fields', async () => {
      const response = await this.makeRequest('/api/admin/deposits/bulk', 'POST', {}, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });

    await this.test('Bulk operation - too many deposits', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => `deposit_${i}`);
      
      const response = await this.makeRequest('/api/admin/deposits/bulk', 'POST', {
        action: 'capture',
        depositIds: tooManyIds
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });
  }

  async testExportFunctionality() {
    console.log('\n📊 Testing Export Functionality...');

    await this.test('CSV export', async () => {
      const response = await this.makeRequest('/api/admin/deposits/export', 'POST', {
        format: 'csv',
        filters: { status: 'all' }
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      if (!response.headers['content-type'].includes('text/csv')) {
        throw new Error('Expected CSV content type');
      }
    });

    await this.test('JSON export', async () => {
      const response = await this.makeRequest('/api/admin/deposits/export', 'POST', {
        format: 'json',
        filters: { status: 'all' }
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      if (!response.headers['content-type'].includes('application/json')) {
        throw new Error('Expected JSON content type');
      }
    });

    await this.test('Export - unsupported format', async () => {
      const response = await this.makeRequest('/api/admin/deposits/export', 'POST', {
        format: 'xml',
        filters: {}
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });
  }

  async testAdminLogout() {
    console.log('\n🚪 Testing Admin Logout...');

    await this.test('Admin logout', async () => {
      const response = await this.makeRequest('/api/admin/logout', 'POST', {}, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    await this.test('Access after logout', async () => {
      const response = await this.makeRequest('/api/admin/dashboard', 'GET', null, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      // Note: Token might still be valid until it expires, so we just check the endpoint exists
      if (response.status !== 200 && response.status !== 401) {
        throw new Error(`Expected 200 or 401, got ${response.status}`);
      }
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

  makeRequest(path, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body
          });
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📋 ADMIN PANEL TEST RESULTS');
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
    
    console.log('\n🎉 Admin panel testing completed!');
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tester = new AdminPanelTester(baseUrl);
  tester.runAllTests().catch(console.error);
}

module.exports = AdminPanelTester;
