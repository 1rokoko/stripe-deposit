#!/usr/bin/env node

/**
 * Comprehensive Load Testing Tool
 * Tests API endpoints, webhooks, and database performance under load
 */

const https = require('https');
const crypto = require('crypto');
const { loadEnv } = require('../src/config');

const BASE_URL = process.env.API_BASE_URL || 'https://stripe-deposit.vercel.app';

/**
 * HTTP request helper
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const startTime = Date.now();
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'load-test-tool/1.0',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: parsed,
            raw: data,
            duration
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: null,
            raw: data,
            duration,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        error: error.message,
        duration: Date.now() - startTime
      });
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Load test configuration
 */
const LOAD_TEST_CONFIG = {
  warmup: {
    duration: 30000,    // 30 seconds
    concurrency: 1,     // 1 request per second
    rampUp: false
  },
  rampUp: {
    duration: 60000,    // 1 minute
    startConcurrency: 1,
    endConcurrency: 10,
    rampUp: true
  },
  sustained: {
    duration: 120000,   // 2 minutes
    concurrency: 10,    // 10 requests per second
    rampUp: false
  },
  peak: {
    duration: 60000,    // 1 minute
    startConcurrency: 10,
    endConcurrency: 25,
    rampUp: true
  },
  cooldown: {
    duration: 30000,    // 30 seconds
    startConcurrency: 25,
    endConcurrency: 1,
    rampUp: true
  }
};

/**
 * Test scenarios
 */
const TEST_SCENARIOS = {
  healthCheck: {
    name: 'Health Check',
    weight: 30,
    endpoint: '/healthz',
    method: 'GET',
    headers: {},
    expectedStatus: [200]
  },
  
  getDeposits: {
    name: 'Get Deposits',
    weight: 25,
    endpoint: '/api/deposits',
    method: 'GET',
    headers: {},
    expectedStatus: [200, 401]
  },
  
  createDeposit: {
    name: 'Create Deposit',
    weight: 20,
    endpoint: '/api/deposits/hold/100',
    method: 'POST',
    headers: {},
    body: {
      customerId: 'cus_test_load_testing',
      paymentMethodId: 'pm_card_visa'
    },
    expectedStatus: [200, 201, 400, 401, 429]
  },
  
  getMetrics: {
    name: 'Get Metrics',
    weight: 15,
    endpoint: '/metrics',
    method: 'GET',
    headers: {},
    expectedStatus: [200, 401]
  },
  
  webhook: {
    name: 'Webhook Processing',
    weight: 10,
    endpoint: '/api/stripe/webhook',
    method: 'POST',
    headers: {
      'Stripe-Signature': 'test-signature'
    },
    body: {
      id: 'evt_test_webhook',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_webhook',
          object: 'payment_intent',
          status: 'succeeded'
        }
      }
    },
    expectedStatus: [200, 400, 401]
  }
};

/**
 * Load test metrics collector
 */
class LoadTestMetrics {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.startTime = Date.now();
    this.requests = [];
    this.errors = [];
    this.scenarios = {};
    
    // Initialize scenario metrics
    Object.keys(TEST_SCENARIOS).forEach(scenario => {
      this.scenarios[scenario] = {
        total: 0,
        success: 0,
        errors: 0,
        durations: [],
        statusCodes: {}
      };
    });
  }
  
  recordRequest(scenario, response, error = null) {
    const now = Date.now();
    
    const record = {
      timestamp: now,
      scenario,
      duration: response?.duration || 0,
      status: response?.status || 0,
      success: !error && response?.status < 400,
      error: error?.message || null
    };
    
    this.requests.push(record);
    
    if (error) {
      this.errors.push({ ...record, error });
    }
    
    // Update scenario metrics
    const scenarioMetrics = this.scenarios[scenario];
    scenarioMetrics.total++;
    
    if (record.success) {
      scenarioMetrics.success++;
      scenarioMetrics.durations.push(record.duration);
    } else {
      scenarioMetrics.errors++;
    }
    
    // Track status codes
    const statusCode = record.status || 'error';
    scenarioMetrics.statusCodes[statusCode] = (scenarioMetrics.statusCodes[statusCode] || 0) + 1;
  }
  
  getMetrics() {
    const now = Date.now();
    const totalDuration = now - this.startTime;
    const totalRequests = this.requests.length;
    const totalErrors = this.errors.length;
    const successfulRequests = totalRequests - totalErrors;
    
    // Calculate overall statistics
    const durations = this.requests
      .filter(r => r.success)
      .map(r => r.duration);
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    const sortedDurations = durations.sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedDurations, 50);
    const p95 = this.calculatePercentile(sortedDurations, 95);
    const p99 = this.calculatePercentile(sortedDurations, 99);
    
    // Calculate requests per second
    const rps = totalRequests / (totalDuration / 1000);
    
    return {
      summary: {
        totalDuration: Math.round(totalDuration / 1000), // seconds
        totalRequests,
        successfulRequests,
        totalErrors,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) : 0,
        requestsPerSecond: rps.toFixed(2),
        avgDuration: Math.round(avgDuration),
        p50Duration: Math.round(p50),
        p95Duration: Math.round(p95),
        p99Duration: Math.round(p99)
      },
      scenarios: Object.entries(this.scenarios).map(([name, metrics]) => {
        const scenarioDurations = metrics.durations;
        const scenarioAvg = scenarioDurations.length > 0 
          ? scenarioDurations.reduce((sum, d) => sum + d, 0) / scenarioDurations.length 
          : 0;
        
        return {
          name,
          total: metrics.total,
          success: metrics.success,
          errors: metrics.errors,
          successRate: metrics.total > 0 ? (metrics.success / metrics.total * 100).toFixed(2) : 0,
          avgDuration: Math.round(scenarioAvg),
          statusCodes: metrics.statusCodes
        };
      }),
      errors: this.errors.slice(-10) // Last 10 errors
    };
  }
  
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
}

/**
 * Load test runner
 */
class LoadTestRunner {
  constructor() {
    this.metrics = new LoadTestMetrics();
    this.isRunning = false;
    this.activeRequests = 0;
    this.maxConcurrency = 50;
  }
  
  async runPhase(phaseConfig, phaseName) {
    console.log(`\n🚀 Starting phase: ${phaseName}`);
    console.log(`   Duration: ${phaseConfig.duration / 1000}s`);
    
    if (phaseConfig.rampUp) {
      console.log(`   Concurrency: ${phaseConfig.startConcurrency} → ${phaseConfig.endConcurrency}`);
    } else {
      console.log(`   Concurrency: ${phaseConfig.concurrency} requests/second`);
    }
    
    const startTime = Date.now();
    const endTime = startTime + phaseConfig.duration;
    
    while (Date.now() < endTime && this.isRunning) {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / phaseConfig.duration;
      
      let currentConcurrency;
      if (phaseConfig.rampUp) {
        currentConcurrency = Math.round(
          phaseConfig.startConcurrency + 
          (phaseConfig.endConcurrency - phaseConfig.startConcurrency) * progress
        );
      } else {
        currentConcurrency = phaseConfig.concurrency;
      }
      
      // Limit concurrency
      currentConcurrency = Math.min(currentConcurrency, this.maxConcurrency);
      
      // Execute requests for this interval
      const promises = [];
      for (let i = 0; i < currentConcurrency && this.activeRequests < this.maxConcurrency; i++) {
        promises.push(this.executeRandomScenario());
      }
      
      await Promise.all(promises);
      
      // Wait before next batch (1 second intervals)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Phase ${phaseName} completed`);
  }
  
  async executeRandomScenario() {
    // Select scenario based on weights
    const scenarios = Object.entries(TEST_SCENARIOS);
    const totalWeight = scenarios.reduce((sum, [, scenario]) => sum + scenario.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    let selectedScenario = null;
    let scenarioName = null;
    
    for (const [name, scenario] of scenarios) {
      currentWeight += scenario.weight;
      if (random <= currentWeight) {
        selectedScenario = scenario;
        scenarioName = name;
        break;
      }
    }
    
    if (!selectedScenario) {
      selectedScenario = scenarios[0][1];
      scenarioName = scenarios[0][0];
    }
    
    this.activeRequests++;
    
    try {
      const env = loadEnv();
      const headers = { ...selectedScenario.headers };
      
      // Add auth token for protected endpoints
      if (selectedScenario.endpoint.startsWith('/api/') && 
          selectedScenario.endpoint !== '/api/stripe/webhook') {
        headers.Authorization = `Bearer ${env.API_AUTH_TOKEN}`;
      }
      
      const response = await makeRequest(`${BASE_URL}${selectedScenario.endpoint}`, {
        method: selectedScenario.method,
        headers,
        body: selectedScenario.body
      });
      
      this.metrics.recordRequest(scenarioName, response);
      
      // Validate response
      if (!selectedScenario.expectedStatus.includes(response.status)) {
        console.warn(`⚠️  Unexpected status ${response.status} for ${selectedScenario.name}`);
      }
      
    } catch (error) {
      this.metrics.recordRequest(scenarioName, null, error);
      console.error(`❌ Error in ${selectedScenario.name}:`, error.message);
    } finally {
      this.activeRequests--;
    }
  }
  
  async runLoadTest() {
    console.log('🔥 Starting Comprehensive Load Test');
    console.log(`🌐 Target: ${BASE_URL}`);
    console.log('=====================================');
    
    this.isRunning = true;
    this.metrics.reset();
    
    try {
      // Run all phases
      await this.runPhase(LOAD_TEST_CONFIG.warmup, 'Warmup');
      await this.runPhase(LOAD_TEST_CONFIG.rampUp, 'Ramp Up');
      await this.runPhase(LOAD_TEST_CONFIG.sustained, 'Sustained Load');
      await this.runPhase(LOAD_TEST_CONFIG.peak, 'Peak Load');
      await this.runPhase(LOAD_TEST_CONFIG.cooldown, 'Cool Down');
      
      // Wait for remaining requests to complete
      while (this.activeRequests > 0) {
        console.log(`⏳ Waiting for ${this.activeRequests} requests to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('\n🎉 Load test completed!');
      
    } catch (error) {
      console.error('\n❌ Load test failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
  
  printResults() {
    const metrics = this.metrics.getMetrics();
    
    console.log('\n📊 LOAD TEST RESULTS');
    console.log('====================');
    
    console.log('\n📈 Summary:');
    console.log(`   Total Duration: ${metrics.summary.totalDuration}s`);
    console.log(`   Total Requests: ${metrics.summary.totalRequests}`);
    console.log(`   Successful Requests: ${metrics.summary.successfulRequests}`);
    console.log(`   Failed Requests: ${metrics.summary.totalErrors}`);
    console.log(`   Success Rate: ${metrics.summary.successRate}%`);
    console.log(`   Requests/Second: ${metrics.summary.requestsPerSecond}`);
    console.log(`   Average Response Time: ${metrics.summary.avgDuration}ms`);
    console.log(`   P50 Response Time: ${metrics.summary.p50Duration}ms`);
    console.log(`   P95 Response Time: ${metrics.summary.p95Duration}ms`);
    console.log(`   P99 Response Time: ${metrics.summary.p99Duration}ms`);
    
    console.log('\n📋 Scenario Results:');
    metrics.scenarios.forEach(scenario => {
      console.log(`   ${scenario.name}:`);
      console.log(`     Total: ${scenario.total}, Success: ${scenario.success}, Errors: ${scenario.errors}`);
      console.log(`     Success Rate: ${scenario.successRate}%, Avg Duration: ${scenario.avgDuration}ms`);
      console.log(`     Status Codes:`, scenario.statusCodes);
    });
    
    if (metrics.errors.length > 0) {
      console.log('\n❌ Recent Errors:');
      metrics.errors.forEach(error => {
        console.log(`   ${error.scenario}: ${error.error}`);
      });
    }
    
    // Performance assessment
    console.log('\n🎯 Performance Assessment:');
    if (metrics.summary.successRate >= 99) {
      console.log('   ✅ Excellent: Success rate > 99%');
    } else if (metrics.summary.successRate >= 95) {
      console.log('   ✅ Good: Success rate > 95%');
    } else if (metrics.summary.successRate >= 90) {
      console.log('   ⚠️  Fair: Success rate > 90%');
    } else {
      console.log('   ❌ Poor: Success rate < 90%');
    }
    
    if (metrics.summary.p95Duration <= 1000) {
      console.log('   ✅ Excellent: P95 response time ≤ 1s');
    } else if (metrics.summary.p95Duration <= 2000) {
      console.log('   ✅ Good: P95 response time ≤ 2s');
    } else if (metrics.summary.p95Duration <= 5000) {
      console.log('   ⚠️  Fair: P95 response time ≤ 5s');
    } else {
      console.log('   ❌ Poor: P95 response time > 5s');
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log('\n🛑 Load test stopped by user');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Load Testing Tool

Usage: node scripts/load-test.js [options]

Options:
  --quick         Run a quick 30-second test
  --stress        Run stress test with higher concurrency
  --help          Show this help message

Examples:
  node scripts/load-test.js                # Run full load test
  node scripts/load-test.js --quick        # Run quick test
  node scripts/load-test.js --stress       # Run stress test
    `);
    return;
  }
  
  const runner = new LoadTestRunner();
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    runner.stop();
    setTimeout(() => {
      runner.printResults();
      process.exit(0);
    }, 1000);
  });
  
  if (args.includes('--quick')) {
    // Quick test configuration
    LOAD_TEST_CONFIG.warmup.duration = 10000;
    LOAD_TEST_CONFIG.rampUp.duration = 20000;
    LOAD_TEST_CONFIG.sustained.duration = 30000;
    LOAD_TEST_CONFIG.peak.duration = 20000;
    LOAD_TEST_CONFIG.cooldown.duration = 10000;
  }
  
  if (args.includes('--stress')) {
    // Stress test configuration
    runner.maxConcurrency = 100;
    LOAD_TEST_CONFIG.peak.endConcurrency = 50;
  }
  
  try {
    await runner.runLoadTest();
    runner.printResults();
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  LoadTestRunner,
  LoadTestMetrics,
  TEST_SCENARIOS,
  LOAD_TEST_CONFIG
};
