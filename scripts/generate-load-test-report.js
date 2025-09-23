#!/usr/bin/env node

/**
 * Load Test Report Generator
 * Runs all load tests and generates comprehensive report
 */

const fs = require('fs').promises;
const path = require('path');
const { LoadTestRunner } = require('./load-test');
const { WebhookLoadTestRunner } = require('./test-webhook-load');
const { DatabaseLoadTestRunner } = require('./test-database-load');

/**
 * Report generator class
 */
class LoadTestReportGenerator {
  constructor() {
    this.results = {};
    this.startTime = Date.now();
  }
  
  async runAllTests() {
    console.log('🔥 Starting Comprehensive Load Testing Suite');
    console.log('============================================');
    
    try {
      // Run API load test
      console.log('\n1️⃣ Running API Load Test...');
      await this.runAPILoadTest();
      
      // Run webhook load test
      console.log('\n2️⃣ Running Webhook Load Test...');
      await this.runWebhookLoadTest();
      
      // Run database load test
      console.log('\n3️⃣ Running Database Load Test...');
      await this.runDatabaseLoadTest();
      
      console.log('\n✅ All load tests completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Load testing suite failed:', error.message);
      throw error;
    }
  }
  
  async runAPILoadTest() {
    const runner = new LoadTestRunner();
    
    // Configure for quick test
    const QUICK_CONFIG = {
      warmup: { duration: 10000, concurrency: 1, rampUp: false },
      rampUp: { duration: 20000, startConcurrency: 1, endConcurrency: 5, rampUp: true },
      sustained: { duration: 30000, concurrency: 5, rampUp: false },
      peak: { duration: 20000, startConcurrency: 5, endConcurrency: 10, rampUp: true },
      cooldown: { duration: 10000, startConcurrency: 10, endConcurrency: 1, rampUp: true }
    };
    
    // Override config
    Object.assign(require('./load-test').LOAD_TEST_CONFIG, QUICK_CONFIG);
    
    await runner.runLoadTest();
    
    const metrics = runner.metrics.getMetrics();
    this.results.api = {
      type: 'API Load Test',
      duration: metrics.summary.totalDuration,
      totalRequests: metrics.summary.totalRequests,
      successRate: parseFloat(metrics.summary.successRate),
      requestsPerSecond: parseFloat(metrics.summary.requestsPerSecond),
      avgResponseTime: metrics.summary.avgDuration,
      p95ResponseTime: metrics.summary.p95Duration,
      p99ResponseTime: metrics.summary.p99Duration,
      scenarios: metrics.scenarios,
      errors: metrics.errors.length,
      status: this.getTestStatus(parseFloat(metrics.summary.successRate), metrics.summary.p95Duration)
    };
  }
  
  async runWebhookLoadTest() {
    const runner = new WebhookLoadTestRunner();
    
    await runner.runLoadTest({
      duration: 30000,  // 30 seconds
      concurrency: 5    // 5 webhooks per second
    });
    
    const metrics = runner.metrics.getMetrics();
    this.results.webhook = {
      type: 'Webhook Load Test',
      duration: metrics.summary.totalDuration,
      totalWebhooks: metrics.summary.totalRequests,
      successRate: parseFloat(metrics.summary.successRate),
      webhooksPerSecond: parseFloat(metrics.summary.requestsPerSecond),
      avgResponseTime: metrics.summary.avgDuration,
      p95ResponseTime: metrics.summary.p95Duration,
      eventTypes: metrics.eventTypes,
      errors: metrics.recentErrors.length,
      status: this.getTestStatus(parseFloat(metrics.summary.successRate), metrics.summary.p95Duration, 'webhook')
    };
  }
  
  async runDatabaseLoadTest() {
    const runner = new DatabaseLoadTestRunner();
    
    await runner.initialize();
    
    await runner.runLoadTest({
      createCount: 50,
      readCount: 100,
      updateCount: 25,
      listCount: 15,
      countCount: 10,
      mixedWorkloadDuration: 30000, // 30 seconds
      runMixed: true
    });
    
    const metrics = runner.metrics.getMetrics();
    this.results.database = {
      type: 'Database Load Test',
      duration: metrics.summary.totalDuration,
      totalOperations: metrics.summary.totalOperations,
      successRate: parseFloat(metrics.summary.successRate),
      operationsPerSecond: parseFloat(metrics.summary.operationsPerSecond),
      avgResponseTime: metrics.summary.avgDuration,
      p95ResponseTime: metrics.summary.p95Duration,
      p99ResponseTime: metrics.summary.p99Duration,
      operationTypes: metrics.operationTypes,
      errors: metrics.recentErrors.length,
      status: this.getTestStatus(parseFloat(metrics.summary.successRate), metrics.summary.p95Duration, 'database')
    };
    
    // Cleanup
    await runner.cleanup();
  }
  
  getTestStatus(successRate, p95Duration, type = 'api') {
    const thresholds = {
      api: { successRate: 95, p95Duration: 2000 },
      webhook: { successRate: 95, p95Duration: 1000 },
      database: { successRate: 99, p95Duration: 100 }
    };
    
    const threshold = thresholds[type] || thresholds.api;
    
    if (successRate >= threshold.successRate && p95Duration <= threshold.p95Duration) {
      return 'EXCELLENT';
    } else if (successRate >= threshold.successRate - 5 && p95Duration <= threshold.p95Duration * 2) {
      return 'GOOD';
    } else if (successRate >= threshold.successRate - 10) {
      return 'FAIR';
    } else {
      return 'POOR';
    }
  }
  
  generateSummaryReport() {
    const totalDuration = Date.now() - this.startTime;
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalDuration: Math.round(totalDuration / 1000),
      testResults: this.results,
      overallStatus: this.calculateOverallStatus(),
      recommendations: this.generateRecommendations()
    };
    
    return summary;
  }
  
  calculateOverallStatus() {
    const statuses = Object.values(this.results).map(r => r.status);
    
    if (statuses.every(s => s === 'EXCELLENT')) {
      return 'EXCELLENT';
    } else if (statuses.every(s => ['EXCELLENT', 'GOOD'].includes(s))) {
      return 'GOOD';
    } else if (statuses.some(s => s === 'POOR')) {
      return 'POOR';
    } else {
      return 'FAIR';
    }
  }
  
  generateRecommendations() {
    const recommendations = [];
    
    Object.entries(this.results).forEach(([testType, result]) => {
      if (result.status === 'POOR') {
        recommendations.push(`❌ ${testType.toUpperCase()}: Critical performance issues detected. Immediate optimization required.`);
      } else if (result.status === 'FAIR') {
        recommendations.push(`⚠️  ${testType.toUpperCase()}: Performance below optimal. Consider optimization.`);
      } else if (result.status === 'GOOD') {
        recommendations.push(`✅ ${testType.toUpperCase()}: Good performance. Minor optimizations possible.`);
      } else {
        recommendations.push(`🎉 ${testType.toUpperCase()}: Excellent performance. No immediate action needed.`);
      }
      
      // Specific recommendations
      if (testType === 'api' && result.p95ResponseTime > 1000) {
        recommendations.push(`   • Consider API response caching and optimization`);
      }
      
      if (testType === 'webhook' && result.successRate < 99) {
        recommendations.push(`   • Review webhook error handling and retry logic`);
      }
      
      if (testType === 'database' && result.operationsPerSecond < 50) {
        recommendations.push(`   • Consider database indexing and query optimization`);
      }
    });
    
    return recommendations;
  }
  
  printReport() {
    const summary = this.generateSummaryReport();
    
    console.log('\n📊 COMPREHENSIVE LOAD TEST REPORT');
    console.log('==================================');
    
    console.log(`\n🕐 Test Duration: ${summary.totalDuration}s`);
    console.log(`📅 Timestamp: ${summary.timestamp}`);
    console.log(`🎯 Overall Status: ${summary.overallStatus}`);
    
    console.log('\n📈 Test Results Summary:');
    Object.entries(summary.testResults).forEach(([testType, result]) => {
      console.log(`\n${this.getStatusIcon(result.status)} ${result.type}:`);
      console.log(`   Duration: ${result.duration}s`);
      console.log(`   Success Rate: ${result.successRate}%`);
      
      if (result.totalRequests) {
        console.log(`   Total Requests: ${result.totalRequests}`);
        console.log(`   Requests/Second: ${result.requestsPerSecond}`);
      }
      
      if (result.totalWebhooks) {
        console.log(`   Total Webhooks: ${result.totalWebhooks}`);
        console.log(`   Webhooks/Second: ${result.webhooksPerSecond}`);
      }
      
      if (result.totalOperations) {
        console.log(`   Total Operations: ${result.totalOperations}`);
        console.log(`   Operations/Second: ${result.operationsPerSecond}`);
      }
      
      console.log(`   Avg Response Time: ${result.avgResponseTime}ms`);
      console.log(`   P95 Response Time: ${result.p95ResponseTime}ms`);
      
      if (result.p99ResponseTime) {
        console.log(`   P99 Response Time: ${result.p99ResponseTime}ms`);
      }
      
      console.log(`   Errors: ${result.errors}`);
      console.log(`   Status: ${result.status}`);
    });
    
    console.log('\n💡 Recommendations:');
    summary.recommendations.forEach(rec => {
      console.log(`${rec}`);
    });
    
    console.log('\n🎯 Performance Benchmarks:');
    console.log('• API Success Rate: ≥95% (Excellent), ≥90% (Good), ≥85% (Fair)');
    console.log('• API P95 Response Time: ≤2s (Excellent), ≤4s (Good), ≤8s (Fair)');
    console.log('• Webhook Success Rate: ≥95% (Excellent), ≥90% (Good), ≥85% (Fair)');
    console.log('• Webhook P95 Response Time: ≤1s (Excellent), ≤2s (Good), ≤4s (Fair)');
    console.log('• Database Success Rate: ≥99% (Excellent), ≥95% (Good), ≥90% (Fair)');
    console.log('• Database P95 Response Time: ≤100ms (Excellent), ≤200ms (Good), ≤500ms (Fair)');
    
    return summary;
  }
  
  getStatusIcon(status) {
    const icons = {
      'EXCELLENT': '🎉',
      'GOOD': '✅',
      'FAIR': '⚠️',
      'POOR': '❌'
    };
    return icons[status] || '❓';
  }
  
  async saveReport(summary) {
    const reportDir = path.join(__dirname, '..', 'reports');
    
    try {
      await fs.mkdir(reportDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `load-test-report-${timestamp}.json`);
    
    await fs.writeFile(reportFile, JSON.stringify(summary, null, 2));
    
    console.log(`\n💾 Report saved to: ${reportFile}`);
    
    return reportFile;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Load Test Report Generator

Usage: node scripts/generate-load-test-report.js [options]

Options:
  --save          Save report to file
  --help          Show this help message

Examples:
  node scripts/generate-load-test-report.js                # Run tests and show report
  node scripts/generate-load-test-report.js --save         # Run tests and save report
    `);
    return;
  }
  
  const generator = new LoadTestReportGenerator();
  
  try {
    await generator.runAllTests();
    const summary = generator.printReport();
    
    if (args.includes('--save')) {
      await generator.saveReport(summary);
    }
    
    // Exit with appropriate code based on overall status
    const exitCode = summary.overallStatus === 'POOR' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('Load test report generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  LoadTestReportGenerator
};
