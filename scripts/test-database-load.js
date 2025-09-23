#!/usr/bin/env node

/**
 * Database Load Testing Tool
 * Tests database performance under various load conditions
 */

const { loadEnv } = require('../src/config');
const { createDepositRepository } = require('../src/repositories/repositoryFactory');

/**
 * Database load test metrics
 */
class DatabaseLoadTestMetrics {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.startTime = Date.now();
    this.operations = [];
    this.errors = [];
    this.operationTypes = {};
  }
  
  recordOperation(operationType, duration, success = true, error = null) {
    const record = {
      timestamp: Date.now(),
      operationType,
      duration,
      success,
      error: error?.message || null
    };
    
    this.operations.push(record);
    
    if (!success) {
      this.errors.push(record);
    }
    
    // Update operation type metrics
    if (!this.operationTypes[operationType]) {
      this.operationTypes[operationType] = {
        total: 0,
        success: 0,
        errors: 0,
        durations: []
      };
    }
    
    const opMetrics = this.operationTypes[operationType];
    opMetrics.total++;
    
    if (success) {
      opMetrics.success++;
      opMetrics.durations.push(duration);
    } else {
      opMetrics.errors++;
    }
  }
  
  getMetrics() {
    const now = Date.now();
    const totalDuration = now - this.startTime;
    const totalOperations = this.operations.length;
    const totalErrors = this.errors.length;
    const successfulOperations = totalOperations - totalErrors;
    
    // Calculate overall statistics
    const durations = this.operations
      .filter(op => op.success)
      .map(op => op.duration);
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    const sortedDurations = durations.sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedDurations, 50);
    const p95 = this.calculatePercentile(sortedDurations, 95);
    const p99 = this.calculatePercentile(sortedDurations, 99);
    
    return {
      summary: {
        totalDuration: Math.round(totalDuration / 1000),
        totalOperations,
        successfulOperations,
        totalErrors,
        successRate: totalOperations > 0 ? (successfulOperations / totalOperations * 100).toFixed(2) : 0,
        operationsPerSecond: (totalOperations / (totalDuration / 1000)).toFixed(2),
        avgDuration: Math.round(avgDuration * 100) / 100,
        p50Duration: Math.round(p50 * 100) / 100,
        p95Duration: Math.round(p95 * 100) / 100,
        p99Duration: Math.round(p99 * 100) / 100
      },
      operationTypes: Object.entries(this.operationTypes).map(([type, metrics]) => {
        const avgDuration = metrics.durations.length > 0 
          ? metrics.durations.reduce((sum, d) => sum + d, 0) / metrics.durations.length 
          : 0;
        
        const sortedDurations = metrics.durations.sort((a, b) => a - b);
        const p95 = this.calculatePercentile(sortedDurations, 95);
        
        return {
          type,
          total: metrics.total,
          success: metrics.success,
          errors: metrics.errors,
          successRate: metrics.total > 0 ? (metrics.success / metrics.total * 100).toFixed(2) : 0,
          avgDuration: Math.round(avgDuration * 100) / 100,
          p95Duration: Math.round(p95 * 100) / 100
        };
      }),
      recentErrors: this.errors.slice(-5)
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
 * Database load test runner
 */
class DatabaseLoadTestRunner {
  constructor() {
    this.metrics = new DatabaseLoadTestMetrics();
    this.repository = null;
    this.isRunning = false;
    this.testData = [];
  }
  
  async initialize() {
    const env = loadEnv();
    this.repository = createDepositRepository({ type: 'auto' });
    
    console.log('🔧 Database Load Test Initialization');
    console.log(`📊 Database Type: ${env.DATABASE_TYPE || 'sqlite'}`);
    
    // Test connection
    try {
      // Try different methods to test connection
      if (this.repository.count) {
        await this.repository.count();
      } else if (this.repository.findAll) {
        await this.repository.findAll({ limit: 1 });
      } else if (this.repository.size) {
        this.repository.size();
      }
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }
  
  generateTestDeposit() {
    const id = Math.random().toString(36).substr(2, 9);
    return {
      stripePaymentIntentId: `pi_test_${id}`,
      customerId: `cus_test_${id}`,
      paymentMethodId: `pm_test_${id}`,
      amount: Math.floor(Math.random() * 10000) + 1000,
      currency: 'usd',
      status: 'pending',
      metadata: {
        testData: true,
        loadTest: true,
        timestamp: Date.now()
      }
    };
  }
  
  async executeOperation(operationType, operation) {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.metrics.recordOperation(operationType, duration, true);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordOperation(operationType, duration, false, error);
      throw error;
    }
  }
  
  async runCreateOperations(count) {
    console.log(`📝 Running ${count} CREATE operations...`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      const testDeposit = this.generateTestDeposit();
      
      promises.push(
        this.executeOperation('CREATE', async () => {
          // Use save method for memory repository, create for others
          const deposit = this.repository.save
            ? await this.repository.save({ ...testDeposit, id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` })
            : await this.repository.create(testDeposit);
          this.testData.push(deposit);
          return deposit;
        }).catch(error => {
          console.error(`❌ CREATE error:`, error.message);
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  async runReadOperations(count) {
    console.log(`📖 Running ${count} READ operations...`);
    
    if (this.testData.length === 0) {
      console.log('⚠️  No test data available for READ operations');
      return;
    }
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      const randomDeposit = this.testData[Math.floor(Math.random() * this.testData.length)];
      
      promises.push(
        this.executeOperation('READ', async () => {
          return await this.repository.findById(randomDeposit.id);
        }).catch(error => {
          console.error(`❌ READ error:`, error.message);
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  async runUpdateOperations(count) {
    console.log(`✏️  Running ${count} UPDATE operations...`);
    
    if (this.testData.length === 0) {
      console.log('⚠️  No test data available for UPDATE operations');
      return;
    }
    
    const statuses = ['pending', 'captured', 'released', 'failed'];
    const promises = [];
    
    for (let i = 0; i < count; i++) {
      const randomDeposit = this.testData[Math.floor(Math.random() * this.testData.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      promises.push(
        this.executeOperation('UPDATE', async () => {
          // Update the deposit status
          if (this.repository.updateStatus) {
            return await this.repository.updateStatus(randomDeposit.id, randomStatus);
          } else if (this.repository.save) {
            // For memory repository, update and save
            randomDeposit.status = randomStatus;
            return await this.repository.save(randomDeposit);
          }
          return randomDeposit;
        }).catch(error => {
          console.error(`❌ UPDATE error:`, error.message);
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  async runListOperations(count) {
    console.log(`📋 Running ${count} LIST operations...`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      const limit = Math.floor(Math.random() * 50) + 10; // 10-60 records
      const offset = Math.floor(Math.random() * 100);
      
      promises.push(
        this.executeOperation('LIST', async () => {
          return await this.repository.findAll({ limit, offset });
        }).catch(error => {
          console.error(`❌ LIST error:`, error.message);
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  async runCountOperations(count) {
    console.log(`🔢 Running ${count} COUNT operations...`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        this.executeOperation('COUNT', async () => {
          // Use appropriate count method
          if (this.repository.count) {
            return await this.repository.count();
          } else if (this.repository.size) {
            return this.repository.size();
          } else {
            const result = await this.repository.findAll();
            return result.total || result.length || 0;
          }
        }).catch(error => {
          console.error(`❌ COUNT error:`, error.message);
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  async runMixedWorkload(duration) {
    console.log(`🔄 Running mixed workload for ${duration / 1000}s...`);
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    while (Date.now() < endTime && this.isRunning) {
      const operations = [];
      
      // Mixed workload: 40% reads, 30% creates, 20% updates, 10% lists
      const workload = [
        { type: 'READ', weight: 40 },
        { type: 'CREATE', weight: 30 },
        { type: 'UPDATE', weight: 20 },
        { type: 'LIST', weight: 10 }
      ];
      
      for (let i = 0; i < 10; i++) { // 10 operations per batch
        const random = Math.random() * 100;
        let currentWeight = 0;
        let selectedOperation = 'READ';
        
        for (const op of workload) {
          currentWeight += op.weight;
          if (random <= currentWeight) {
            selectedOperation = op.type;
            break;
          }
        }
        
        switch (selectedOperation) {
          case 'CREATE':
            operations.push(this.runCreateOperations(1));
            break;
          case 'READ':
            if (this.testData.length > 0) {
              operations.push(this.runReadOperations(1));
            }
            break;
          case 'UPDATE':
            if (this.testData.length > 0) {
              operations.push(this.runUpdateOperations(1));
            }
            break;
          case 'LIST':
            operations.push(this.runListOperations(1));
            break;
        }
      }
      
      await Promise.all(operations);
      
      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  async runLoadTest(options = {}) {
    const {
      createCount = 100,
      readCount = 200,
      updateCount = 50,
      listCount = 30,
      countCount = 20,
      mixedWorkloadDuration = 60000, // 1 minute
      runMixed = true
    } = options;
    
    console.log('🔥 Starting Database Load Test');
    console.log('==============================');
    
    this.isRunning = true;
    this.metrics.reset();
    
    try {
      // Sequential operations
      await this.runCreateOperations(createCount);
      await this.runReadOperations(readCount);
      await this.runUpdateOperations(updateCount);
      await this.runListOperations(listCount);
      await this.runCountOperations(countCount);
      
      // Mixed workload
      if (runMixed) {
        await this.runMixedWorkload(mixedWorkloadDuration);
      }
      
      console.log('\n🎉 Database load test completed!');
      
    } catch (error) {
      console.error('\n❌ Database load test failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
  
  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete test data
      for (const deposit of this.testData) {
        try {
          if (this.repository.delete) {
            await this.repository.delete(deposit.id);
          } else if (this.repository.clear) {
            // For memory repository, just clear all
            this.repository.clear();
            break; // No need to continue loop
          }
        } catch (error) {
          // Ignore delete errors
        }
      }
      
      console.log(`✅ Cleaned up ${this.testData.length} test records`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }
  
  printResults() {
    const metrics = this.metrics.getMetrics();
    
    console.log('\n📊 DATABASE LOAD TEST RESULTS');
    console.log('=============================');
    
    console.log('\n📈 Summary:');
    console.log(`   Total Duration: ${metrics.summary.totalDuration}s`);
    console.log(`   Total Operations: ${metrics.summary.totalOperations}`);
    console.log(`   Successful Operations: ${metrics.summary.successfulOperations}`);
    console.log(`   Failed Operations: ${metrics.summary.totalErrors}`);
    console.log(`   Success Rate: ${metrics.summary.successRate}%`);
    console.log(`   Operations/Second: ${metrics.summary.operationsPerSecond}`);
    console.log(`   Average Duration: ${metrics.summary.avgDuration}ms`);
    console.log(`   P50 Duration: ${metrics.summary.p50Duration}ms`);
    console.log(`   P95 Duration: ${metrics.summary.p95Duration}ms`);
    console.log(`   P99 Duration: ${metrics.summary.p99Duration}ms`);
    
    console.log('\n📋 Operation Type Results:');
    metrics.operationTypes.forEach(opType => {
      console.log(`   ${opType.type}:`);
      console.log(`     Total: ${opType.total}, Success: ${opType.success}, Errors: ${opType.errors}`);
      console.log(`     Success Rate: ${opType.successRate}%, Avg: ${opType.avgDuration}ms, P95: ${opType.p95Duration}ms`);
    });
    
    if (metrics.recentErrors.length > 0) {
      console.log('\n❌ Recent Errors:');
      metrics.recentErrors.forEach(error => {
        console.log(`   ${error.operationType}: ${error.error}`);
      });
    }
    
    // Performance assessment
    console.log('\n🎯 Database Performance Assessment:');
    if (metrics.summary.successRate >= 99) {
      console.log('   ✅ Excellent: Success rate > 99%');
    } else if (metrics.summary.successRate >= 95) {
      console.log('   ✅ Good: Success rate > 95%');
    } else {
      console.log('   ❌ Poor: Success rate < 95%');
    }
    
    if (metrics.summary.p95Duration <= 100) {
      console.log('   ✅ Excellent: P95 duration ≤ 100ms');
    } else if (metrics.summary.p95Duration <= 500) {
      console.log('   ✅ Good: P95 duration ≤ 500ms');
    } else {
      console.log('   ❌ Poor: P95 duration > 500ms');
    }
    
    const opsPerSecond = parseFloat(metrics.summary.operationsPerSecond);
    if (opsPerSecond >= 100) {
      console.log('   ✅ Excellent: Throughput ≥ 100 ops/sec');
    } else if (opsPerSecond >= 50) {
      console.log('   ✅ Good: Throughput ≥ 50 ops/sec');
    } else {
      console.log('   ❌ Poor: Throughput < 50 ops/sec');
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log('\n🛑 Database load test stopped by user');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Database Load Testing Tool

Usage: node scripts/test-database-load.js [options]

Options:
  --quick         Run a quick test with reduced operations
  --stress        Run stress test with more operations
  --no-mixed      Skip mixed workload test
  --no-cleanup    Skip cleanup of test data
  --help          Show this help message

Examples:
  node scripts/test-database-load.js                # Standard test
  node scripts/test-database-load.js --quick        # Quick test
  node scripts/test-database-load.js --stress       # Stress test
    `);
    return;
  }
  
  const runner = new DatabaseLoadTestRunner();
  
  // Parse options
  const options = {};
  
  if (args.includes('--quick')) {
    options.createCount = 50;
    options.readCount = 100;
    options.updateCount = 25;
    options.listCount = 15;
    options.countCount = 10;
    options.mixedWorkloadDuration = 30000; // 30 seconds
  }
  
  if (args.includes('--stress')) {
    options.createCount = 500;
    options.readCount = 1000;
    options.updateCount = 250;
    options.listCount = 100;
    options.countCount = 50;
    options.mixedWorkloadDuration = 120000; // 2 minutes
  }
  
  if (args.includes('--no-mixed')) {
    options.runMixed = false;
  }
  
  const skipCleanup = args.includes('--no-cleanup');
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    runner.stop();
    setTimeout(async () => {
      runner.printResults();
      if (!skipCleanup) {
        await runner.cleanup();
      }
      process.exit(0);
    }, 1000);
  });
  
  try {
    await runner.initialize();
    await runner.runLoadTest(options);
    runner.printResults();
    
    if (!skipCleanup) {
      await runner.cleanup();
    }
    
  } catch (error) {
    console.error('Database load test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  DatabaseLoadTestRunner,
  DatabaseLoadTestMetrics
};
