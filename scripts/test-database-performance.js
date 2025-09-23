#!/usr/bin/env node

/**
 * Database Performance Testing Tool
 * Tests performance of different repository implementations
 */

const { loadEnv } = require('../src/config');
const { createRepository } = require('./migrate-database');

// Generate test deposit data
function generateTestDeposit(index) {
  const now = new Date().toISOString();
  return {
    id: `dep_test_${index}_${Date.now()}`,
    customerId: `cus_test_${index % 100}`, // 100 different customers
    paymentMethodId: `pm_test_${index % 50}`, // 50 different payment methods
    currency: 'usd',
    holdAmount: (100 + (index % 500)) * 100, // $100-$600 in cents
    status: ['pending', 'authorized', 'captured', 'released'][index % 4],
    verificationPaymentIntentId: `pi_verification_${index}`,
    activePaymentIntentId: `pi_active_${index}`,
    capturePaymentIntentId: index % 3 === 0 ? `pi_capture_${index}` : null,
    capturedAmount: index % 3 === 0 ? (50 + (index % 200)) * 100 : null,
    releasedAmount: null,
    createdAt: now,
    initialAuthorizationAt: now,
    lastAuthorizationAt: now,
    capturedAt: index % 3 === 0 ? now : null,
    releasedAt: null,
    metadata: {
      testData: true,
      index,
      category: `category_${index % 10}`,
      priority: index % 3 === 0 ? 'high' : 'normal'
    },
    captureHistory: index % 3 === 0 ? [
      { amount: 5000, timestamp: now, success: true }
    ] : [],
    authorizationHistory: [
      { amount: (100 + (index % 500)) * 100, timestamp: now, success: true }
    ],
    lastError: index % 10 === 0 ? { message: 'Test error', code: 'test_error' } : undefined,
    actionRequired: index % 20 === 0 ? { type: 'authentication', details: 'Test auth' } : undefined
  };
}

async function measureTime(name, operation) {
  const start = process.hrtime.bigint();
  const result = await operation();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  
  console.log(`  ${name}: ${duration.toFixed(2)}ms`);
  return { result, duration };
}

async function testRepositoryPerformance(repo, testName, options = {}) {
  const { 
    createCount = 100, 
    readCount = 50, 
    updateCount = 25,
    cleanup = true 
  } = options;
  
  console.log(`\n🧪 Testing ${testName} Performance`);
  console.log(`📊 Create: ${createCount}, Read: ${readCount}, Update: ${updateCount}`);
  
  const results = {
    create: { total: 0, average: 0, operations: createCount },
    read: { total: 0, average: 0, operations: readCount },
    update: { total: 0, average: 0, operations: updateCount },
    list: { total: 0, average: 0, operations: 1 },
    findByStatus: { total: 0, average: 0, operations: 1 },
    findByCustomerId: { total: 0, average: 0, operations: 1 }
  };
  
  const createdIds = [];
  
  try {
    // Test CREATE operations
    console.log('\n📝 Testing CREATE operations...');
    const createStart = process.hrtime.bigint();
    
    for (let i = 0; i < createCount; i++) {
      const deposit = generateTestDeposit(i);
      await repo.create(deposit);
      createdIds.push(deposit.id);
      
      if ((i + 1) % 25 === 0) {
        console.log(`  Created ${i + 1}/${createCount} deposits...`);
      }
    }
    
    const createEnd = process.hrtime.bigint();
    results.create.total = Number(createEnd - createStart) / 1_000_000;
    results.create.average = results.create.total / createCount;
    
    console.log(`✅ Created ${createCount} deposits in ${results.create.total.toFixed(2)}ms`);
    console.log(`📊 Average: ${results.create.average.toFixed(2)}ms per create`);
    
    // Test READ operations
    console.log('\n📖 Testing READ operations...');
    const readStart = process.hrtime.bigint();
    
    for (let i = 0; i < readCount; i++) {
      const randomId = createdIds[Math.floor(Math.random() * createdIds.length)];
      await repo.findById(randomId);
    }
    
    const readEnd = process.hrtime.bigint();
    results.read.total = Number(readEnd - readStart) / 1_000_000;
    results.read.average = results.read.total / readCount;
    
    console.log(`✅ Read ${readCount} deposits in ${results.read.total.toFixed(2)}ms`);
    console.log(`📊 Average: ${results.read.average.toFixed(2)}ms per read`);
    
    // Test UPDATE operations
    console.log('\n✏️  Testing UPDATE operations...');
    const updateStart = process.hrtime.bigint();
    
    for (let i = 0; i < updateCount; i++) {
      const randomId = createdIds[Math.floor(Math.random() * createdIds.length)];
      await repo.update(randomId, (deposit) => ({
        ...deposit,
        status: 'updated',
        metadata: { ...deposit.metadata, updated: true, updateIndex: i }
      }));
    }
    
    const updateEnd = process.hrtime.bigint();
    results.update.total = Number(updateEnd - updateStart) / 1_000_000;
    results.update.average = results.update.total / updateCount;
    
    console.log(`✅ Updated ${updateCount} deposits in ${results.update.total.toFixed(2)}ms`);
    console.log(`📊 Average: ${results.update.average.toFixed(2)}ms per update`);
    
    // Test LIST operation
    console.log('\n📋 Testing LIST operation...');
    const { duration: listDuration } = await measureTime('List all deposits', () => repo.list());
    results.list.total = listDuration;
    results.list.average = listDuration;
    
    // Test QUERY operations
    console.log('\n🔍 Testing QUERY operations...');
    if (repo.findByStatus) {
      const { duration: statusDuration } = await measureTime('Find by status', () => 
        repo.findByStatus('authorized', 50)
      );
      results.findByStatus.total = statusDuration;
      results.findByStatus.average = statusDuration;
    }
    
    if (repo.findByCustomerId) {
      const { duration: customerDuration } = await measureTime('Find by customer', () => 
        repo.findByCustomerId('cus_test_1', 50)
      );
      results.findByCustomerId.total = customerDuration;
      results.findByCustomerId.average = customerDuration;
    }
    
    // Performance summary
    console.log('\n📈 Performance Summary:');
    console.log('========================');
    Object.entries(results).forEach(([operation, stats]) => {
      if (stats.total > 0) {
        console.log(`${operation.padEnd(15)}: ${stats.total.toFixed(2)}ms total, ${stats.average.toFixed(2)}ms avg (${stats.operations} ops)`);
      }
    });
    
    // Calculate throughput
    const totalTime = results.create.total + results.read.total + results.update.total;
    const totalOps = createCount + readCount + updateCount;
    const throughput = (totalOps / totalTime) * 1000; // ops per second
    
    console.log(`\n🚀 Throughput: ${throughput.toFixed(2)} operations/second`);
    
    return results;
    
  } finally {
    // Cleanup test data
    if (cleanup && createdIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdIds.length} test deposits...`);
      // Note: This would require a delete method in repositories
      // For now, just log the cleanup intent
      console.log('⚠️  Manual cleanup required - delete test deposits with IDs starting with "dep_test_"');
    }
  }
}

async function compareRepositories() {
  console.log('\n🏁 Repository Performance Comparison');
  console.log('=====================================');
  
  const repositories = [];
  
  // Test SQLite if available
  try {
    const sqliteRepo = await createRepository('sqlite');
    repositories.push({ name: 'SQLite', repo: sqliteRepo });
  } catch (error) {
    console.log('⚠️  SQLite not available:', error.message);
  }
  
  // Test PostgreSQL if available
  try {
    const postgresRepo = await createRepository('postgres');
    repositories.push({ name: 'PostgreSQL', repo: postgresRepo });
  } catch (error) {
    console.log('⚠️  PostgreSQL not available:', error.message);
  }
  
  // Test Memory (always available)
  const memoryRepo = await createRepository('memory');
  repositories.push({ name: 'Memory', repo: memoryRepo });
  
  if (repositories.length === 0) {
    throw new Error('No repositories available for testing');
  }
  
  const results = {};
  
  for (const { name, repo } of repositories) {
    try {
      results[name] = await testRepositoryPerformance(repo, name, {
        createCount: 50, // Smaller test for comparison
        readCount: 25,
        updateCount: 10,
        cleanup: false
      });
      
      // Close repository if possible
      if (repo.close) {
        await repo.close();
      }
      
    } catch (error) {
      console.error(`❌ ${name} test failed:`, error.message);
      results[name] = { error: error.message };
    }
  }
  
  // Comparison summary
  console.log('\n🏆 Performance Comparison Summary:');
  console.log('===================================');
  
  const operations = ['create', 'read', 'update', 'list'];
  
  operations.forEach(op => {
    console.log(`\n${op.toUpperCase()} Performance:`);
    Object.entries(results).forEach(([repoName, repoResults]) => {
      if (repoResults.error) {
        console.log(`  ${repoName.padEnd(12)}: ERROR - ${repoResults.error}`);
      } else if (repoResults[op]) {
        console.log(`  ${repoName.padEnd(12)}: ${repoResults[op].average.toFixed(2)}ms avg`);
      }
    });
  });
  
  return results;
}

async function main() {
  console.log('⚡ Database Performance Testing Tool');
  
  const env = loadEnv();
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Usage: node scripts/test-database-performance.js [options]

Options:
  --compare           Compare all available repositories
  --sqlite            Test SQLite repository only
  --postgres          Test PostgreSQL repository only
  --memory            Test Memory repository only
  --create=N          Number of create operations [default: 100]
  --read=N            Number of read operations [default: 50]
  --update=N          Number of update operations [default: 25]
  --no-cleanup        Don't attempt to cleanup test data
  --help              Show this help message

Environment Variables:
  DATABASE_FILE       SQLite database file path
  DATABASE_URL        PostgreSQL connection string
    `);
    return;
  }
  
  try {
    if (args.includes('--compare')) {
      await compareRepositories();
    } else {
      // Test specific repository
      let repoType = 'auto';
      if (args.includes('--sqlite')) repoType = 'sqlite';
      if (args.includes('--postgres')) repoType = 'postgres';
      if (args.includes('--memory')) repoType = 'memory';
      
      const createCount = parseInt(args.find(arg => arg.startsWith('--create='))?.split('=')[1]) || 100;
      const readCount = parseInt(args.find(arg => arg.startsWith('--read='))?.split('=')[1]) || 50;
      const updateCount = parseInt(args.find(arg => arg.startsWith('--update='))?.split('=')[1]) || 25;
      const cleanup = !args.includes('--no-cleanup');
      
      const repo = await createRepository(repoType);
      await testRepositoryPerformance(repo, repoType, {
        createCount,
        readCount,
        updateCount,
        cleanup
      });
      
      if (repo.close) {
        await repo.close();
      }
    }
    
    console.log('\n✅ Performance testing completed!');
    
  } catch (error) {
    console.error('\n❌ Performance testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testRepositoryPerformance,
  compareRepositories,
  generateTestDeposit
};
