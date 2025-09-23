#!/usr/bin/env node

/**
 * Analytics Testing Script
 * Comprehensive testing of analytics functionality
 */

const https = require('https');
const http = require('http');

class AnalyticsTester {
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
    console.log('📈 Starting Analytics Tests...\n');

    try {
      // First login to get admin token
      await this.loginAsAdmin();
      
      if (this.adminToken) {
        // Test analytics API
        await this.testAnalyticsAPI();
        
        // Test analytics with different date ranges
        await this.testDateRanges();
        
        // Test analytics performance
        await this.testAnalyticsPerformance();

        // Test report generation
        await this.testReportGeneration();

        // Test export functionality
        await this.testExportFunctionality();
      }

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async loginAsAdmin() {
    console.log('🔐 Logging in as admin...');
    
    try {
      const response = await this.makeRequest('/api/admin/login', 'POST', {
        email: 'admin@stripe-deposit.com',
        password: 'admin123'
      });
      
      if (response.status === 200) {
        const data = JSON.parse(response.body);
        this.adminToken = data.token;
        console.log('✅ Admin login successful\n');
      } else {
        throw new Error(`Login failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Admin login failed:', error.message);
      throw error;
    }
  }

  async testAnalyticsAPI() {
    console.log('📊 Testing Analytics API...');

    // Test basic analytics
    await this.test('Basic analytics data', async () => {
      const response = await this.makeRequest('/api/admin/analytics', 'POST', {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      
      // Validate response structure
      const requiredFields = ['summary', 'depositsOverTime', 'revenueOverTime', 'statusDistribution', 'topCustomers', 'performance'];
      for (const field of requiredFields) {
        if (!data.hasOwnProperty(field)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      console.log(`✅ Analytics data structure valid`);
      console.log(`   - Total deposits: ${data.summary.totalDeposits}`);
      console.log(`   - Total amount: $${(data.summary.totalAmount / 100).toFixed(2)}`);
      console.log(`   - Success rate: ${data.summary.successRate}%`);
    });

    // Test analytics without auth
    await this.test('Analytics without auth', async () => {
      const response = await this.makeRequest('/api/admin/analytics', 'POST', {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString()
      });
      
      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    });

    // Test analytics with invalid date range
    await this.test('Analytics with invalid date range', async () => {
      const response = await this.makeRequest('/api/admin/analytics', 'POST', {
        startDate: 'invalid-date',
        endDate: 'invalid-date'
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      // Should still work but with empty data
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });
  }

  async testDateRanges() {
    console.log('\n📅 Testing Date Ranges...');

    const dateRanges = [
      {
        name: 'Last 7 days',
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      {
        name: 'Last 30 days',
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      {
        name: 'Last 90 days',
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        end: new Date()
      }
    ];

    for (const range of dateRanges) {
      await this.test(`Analytics for ${range.name}`, async () => {
        const response = await this.makeRequest('/api/admin/analytics', 'POST', {
          startDate: range.start.toISOString(),
          endDate: range.end.toISOString()
        }, {
          'Authorization': `Bearer ${this.adminToken}`
        });
        
        if (response.status !== 200) {
          throw new Error(`Expected 200, got ${response.status}`);
        }
        
        const data = JSON.parse(response.body);
        console.log(`   - ${range.name}: ${data.summary.totalDeposits} deposits`);
      });
    }
  }

  async testAnalyticsPerformance() {
    console.log('\n⚡ Testing Analytics Performance...');

    await this.test('Analytics response time', async () => {
      const startTime = Date.now();
      
      const response = await this.makeRequest('/api/admin/analytics', 'POST', {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      console.log(`   - Response time: ${responseTime}ms`);
      
      if (responseTime > 5000) {
        throw new Error(`Response time too slow: ${responseTime}ms`);
      }
    });
  }

  async testReportGeneration() {
    console.log('\n📊 Testing Report Generation...');

    const reportTypes = ['deposits', 'customers', 'analytics'];

    for (const reportType of reportTypes) {
      await this.test(`Generate ${reportType} report`, async () => {
        const response = await this.makeRequest('/api/admin/reports/generate', 'POST', {
          reportType,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          format: 'json'
        }, {
          'Authorization': `Bearer ${this.adminToken}`
        });

        if (response.status !== 200) {
          throw new Error(`Expected 200, got ${response.status}`);
        }

        const data = JSON.parse(response.body);

        if (!data.success || !data.data || !data.reportType) {
          throw new Error('Invalid report structure');
        }

        console.log(`   - ${reportType} report: ${Array.isArray(data.data) ? data.data.length : 'object'} records`);
      });
    }

    // Test CSV report generation
    await this.test('Generate CSV report', async () => {
      const response = await this.makeRequest('/api/admin/reports/generate', 'POST', {
        reportType: 'deposits',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        format: 'csv'
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.headers['content-type']?.includes('text/csv')) {
        throw new Error('Expected CSV content type');
      }

      console.log(`   - CSV report generated successfully`);
    });

    // Test invalid report type
    await this.test('Invalid report type', async () => {
      const response = await this.makeRequest('/api/admin/reports/generate', 'POST', {
        reportType: 'invalid',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString()
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });
  }

  async testExportFunctionality() {
    console.log('\n📤 Testing Export Functionality...');

    // Test JSON export
    await this.test('JSON export', async () => {
      const response = await this.makeRequest('/api/admin/deposits/export', 'POST', {
        format: 'json',
        filters: {}
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const data = JSON.parse(response.body);

      if (!data.success || !data.data) {
        throw new Error('Invalid export structure');
      }

      console.log(`   - JSON export: ${data.data.length} records`);
    });

    // Test CSV export
    await this.test('CSV export', async () => {
      const response = await this.makeRequest('/api/admin/deposits/export', 'POST', {
        format: 'csv',
        filters: {}
      }, {
        'Authorization': `Bearer ${this.adminToken}`
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.headers['content-type']?.includes('text/csv')) {
        throw new Error('Expected CSV content type');
      }

      console.log(`   - CSV export generated successfully`);
    });

    // Test unsupported format
    await this.test('Unsupported export format', async () => {
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
    console.log('📈 ANALYTICS TEST RESULTS');
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
    
    console.log('\n🎉 Analytics testing completed!');
    
    if (this.testResults.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tester = new AnalyticsTester(baseUrl);
  tester.runAllTests().catch(console.error);
}

module.exports = AnalyticsTester;
