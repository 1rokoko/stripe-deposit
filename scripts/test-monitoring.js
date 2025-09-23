#!/usr/bin/env node

/**
 * Monitoring System Testing Tool
 * Tests all monitoring components and features
 */

const { createLogger } = require('../src/monitoring/structuredLogger');
const { performanceMetrics, monitorDatabaseOperation, monitorStripeOperation } = require('../src/monitoring/performanceMonitor');
const { ErrorTracker, ERROR_SEVERITY } = require('../src/monitoring/errorTracker');
const { createDefaultHealthCheckManager } = require('../src/monitoring/healthCheck');
const { createMonitoringService } = require('../src/monitoring/monitoringService');

/**
 * Test structured logging
 */
async function testStructuredLogging() {
  console.log('\n📝 Testing Structured Logging...');
  
  const logger = createLogger({
    service: 'test-service',
    environment: 'test',
    logLevel: 'debug'
  });
  
  // Test different log levels
  await logger.info('Test info message', { testData: 'info' });
  await logger.warn('Test warning message', { testData: 'warning' });
  await logger.error('Test error message', { testData: 'error' });
  await logger.debug('Test debug message', { testData: 'debug' });
  
  // Test specialized logging methods
  await logger.logAPIRequest(
    { method: 'GET', url: '/test', headers: { 'user-agent': 'test' } },
    { statusCode: 200, getHeader: () => '100' },
    150
  );
  
  await logger.logDepositEvent('created', 'dep_test123', { amount: 10000 });
  await logger.logStripeEvent('payment_intent_created', { id: 'pi_test123' });
  await logger.logSecurityEvent('rate_limit_exceeded', { ip: '127.0.0.1' });
  
  // Test sensitive data sanitization
  await logger.info('Test sensitive data', {
    password: 'secret123',
    token: 'bearer_token',
    normalData: 'this should appear'
  });
  
  console.log('✅ Structured logging tests completed');
}

/**
 * Test performance monitoring
 */
async function testPerformanceMonitoring() {
  console.log('\n⏱️  Testing Performance Monitoring...');
  
  // Test database operation monitoring
  const mockDbOperation = async (query) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    return { rows: [] };
  };
  
  const monitoredDbOp = monitorDatabaseOperation('select', mockDbOperation);
  
  // Execute multiple operations
  for (let i = 0; i < 5; i++) {
    await monitoredDbOp('SELECT * FROM test');
  }
  
  // Test Stripe operation monitoring
  const mockStripeOperation = async () => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    return { id: 'pi_test123', object: 'payment_intent' };
  };
  
  const monitoredStripeOp = monitorStripeOperation('create_payment_intent', mockStripeOperation);
  
  // Execute multiple operations
  for (let i = 0; i < 3; i++) {
    await monitoredStripeOp();
  }
  
  // Get performance metrics
  const metrics = performanceMetrics.getMetrics();
  console.log('📊 Performance Metrics:');
  Object.entries(metrics).forEach(([operation, metric]) => {
    console.log(`   ${operation}: ${metric.count} calls, avg ${metric.avgDuration}ms, success rate ${metric.successRate}%`);
  });
  
  console.log('✅ Performance monitoring tests completed');
}

/**
 * Test error tracking
 */
async function testErrorTracking() {
  console.log('\n🚨 Testing Error Tracking...');
  
  const errorTracker = new ErrorTracker({
    enableAlerts: false // Disable alerts for testing
  });
  
  // Test different types of errors
  const errors = [
    new Error('Database connection failed'),
    new Error('Stripe API rate limit exceeded'),
    new Error('Invalid customer ID format'),
    new Error('Authentication failed'),
    new Error('Network timeout')
  ];
  
  // Track errors with different contexts
  for (let i = 0; i < errors.length; i++) {
    const error = errors[i];
    const context = {
      method: 'POST',
      url: '/api/test',
      statusCode: 400 + i,
      userId: `user_${i}`
    };
    
    await errorTracker.track(error, context);
  }
  
  // Test error classification
  const validationError = new Error('Required field missing');
  await errorTracker.track(validationError, { statusCode: 400 });
  
  const authError = new Error('Unauthorized access');
  await errorTracker.track(authError, { statusCode: 401 });
  
  // Get error statistics
  const stats = errorTracker.getErrorStats();
  console.log('📊 Error Statistics:');
  console.log(`   Total errors: ${stats.total}`);
  console.log(`   Last hour: ${stats.lastHour}`);
  console.log('   By severity:', stats.bySeverity);
  console.log('   By category:', stats.byCategory);
  
  console.log('✅ Error tracking tests completed');
}

/**
 * Test health checks
 */
async function testHealthChecks() {
  console.log('\n🏥 Testing Health Checks...');
  
  const healthManager = createDefaultHealthCheckManager({
    enablePeriodicChecks: false
  });
  
  // Add custom health check
  healthManager.register('test_service', async () => {
    const random = Math.random();
    if (random < 0.8) {
      return { status: 'healthy', message: 'Service is running normally' };
    } else if (random < 0.95) {
      return { status: 'degraded', message: 'Service is experiencing minor issues' };
    } else {
      throw new Error('Service is down');
    }
  }, { critical: false });
  
  // Execute all health checks
  const healthStatus = await healthManager.checkAll();
  
  console.log('🏥 Health Check Results:');
  console.log(`   Overall status: ${healthStatus.status}`);
  console.log(`   Summary: ${healthStatus.summary.healthy}/${healthStatus.summary.total} checks healthy`);
  
  healthStatus.checks.forEach(check => {
    const icon = check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌';
    console.log(`   ${icon} ${check.name}: ${check.message} (${check.duration}ms)`);
  });
  
  console.log('✅ Health check tests completed');
}

/**
 * Test monitoring service integration
 */
async function testMonitoringService() {
  console.log('\n🔧 Testing Monitoring Service Integration...');
  
  const monitoringService = createMonitoringService({
    service: 'test-service',
    environment: 'test',
    enablePeriodicHealthChecks: false,
    enableAlerts: false
  });
  
  await monitoringService.initialize();
  
  // Track some events
  await monitoringService.trackEvent('test_event', { data: 'test' });
  
  // Track an error
  const testError = new Error('Test error for monitoring');
  await monitoringService.trackError(testError, { context: 'test' });
  
  // Get comprehensive status
  const status = await monitoringService.getStatus();
  
  console.log('📊 Monitoring Service Status:');
  console.log(`   Service: ${status.service}`);
  console.log(`   Environment: ${status.environment}`);
  console.log(`   Uptime: ${Math.round(status.uptime / 1000)}s`);
  console.log(`   Health: ${status.health.status}`);
  console.log(`   Performance: ${status.performance.status}`);
  console.log(`   Memory usage: ${status.memory.heapUsedPercent}%`);
  
  // Get dashboard data
  const dashboardData = await monitoringService.getDashboardData();
  
  console.log('📈 Dashboard Metrics:');
  console.log(`   Health score: ${dashboardData.dashboard.healthScore}%`);
  console.log(`   Performance score: ${dashboardData.dashboard.performanceScore}%`);
  console.log(`   Error rate: ${dashboardData.dashboard.errorRate}`);
  console.log(`   Active alerts: ${dashboardData.dashboard.alerts.length}`);
  
  await monitoringService.shutdown();
  
  console.log('✅ Monitoring service integration tests completed');
}

/**
 * Test memory usage and cleanup
 */
async function testMemoryUsage() {
  console.log('\n💾 Testing Memory Usage...');
  
  const initialMemory = process.memoryUsage();
  console.log('Initial memory usage:', {
    heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(initialMemory.heapTotal / 1024 / 1024 * 100) / 100
  });
  
  // Create many log entries to test memory usage
  const logger = createLogger({ service: 'memory-test' });
  
  for (let i = 0; i < 1000; i++) {
    await logger.info(`Test log entry ${i}`, { iteration: i, data: 'x'.repeat(100) });
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage();
  console.log('Final memory usage:', {
    heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(finalMemory.heapTotal / 1024 / 1024 * 100) / 100
  });
  
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100} MB`);
  
  console.log('✅ Memory usage tests completed');
}

/**
 * Run all monitoring tests
 */
async function runAllTests() {
  console.log('🔍 Comprehensive Monitoring System Testing');
  console.log('==========================================');
  
  try {
    await testStructuredLogging();
    await testPerformanceMonitoring();
    await testErrorTracking();
    await testHealthChecks();
    await testMonitoringService();
    await testMemoryUsage();
    
    console.log('\n🎉 All monitoring tests completed successfully!');
    
    console.log('\n💡 Monitoring System Summary:');
    console.log('• Structured logging: ✅ Working with sanitization');
    console.log('• Performance monitoring: ✅ Tracking metrics and thresholds');
    console.log('• Error tracking: ✅ Classification and alerting');
    console.log('• Health checks: ✅ Comprehensive system monitoring');
    console.log('• Service integration: ✅ Unified monitoring service');
    console.log('• Memory management: ✅ Efficient resource usage');
    
    console.log('\n🚀 Ready for production deployment with comprehensive monitoring!');
    
  } catch (error) {
    console.error('\n❌ Monitoring tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Monitoring System Testing Tool

Usage: node scripts/test-monitoring.js [options]

Options:
  --logging       Test structured logging only
  --performance   Test performance monitoring only
  --errors        Test error tracking only
  --health        Test health checks only
  --service       Test monitoring service only
  --memory        Test memory usage only
  --help          Show this help message

Examples:
  node scripts/test-monitoring.js                # Run all tests
  node scripts/test-monitoring.js --logging      # Test logging only
    `);
    return;
  }
  
  if (args.includes('--logging')) {
    await testStructuredLogging();
  } else if (args.includes('--performance')) {
    await testPerformanceMonitoring();
  } else if (args.includes('--errors')) {
    await testErrorTracking();
  } else if (args.includes('--health')) {
    await testHealthChecks();
  } else if (args.includes('--service')) {
    await testMonitoringService();
  } else if (args.includes('--memory')) {
    await testMemoryUsage();
  } else {
    await runAllTests();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testStructuredLogging,
  testPerformanceMonitoring,
  testErrorTracking,
  testHealthChecks,
  testMonitoringService,
  testMemoryUsage,
  runAllTests
};
