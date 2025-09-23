#!/usr/bin/env node

/**
 * SQLite Performance Testing
 * Quick test of current SQLite implementation
 */

const { loadEnv } = require('../src/config');
const { SqliteDepositRepository } = require('../src/repositories/sqliteDepositRepository');
const path = require('path');
const fs = require('fs');

function generateTestDeposit(index) {
  const now = new Date().toISOString();
  return {
    id: `dep_perf_test_${index}_${Date.now()}`,
    customerId: `cus_test_${index % 10}`,
    paymentMethodId: `pm_test_${index % 5}`,
    currency: 'usd',
    holdAmount: (100 + (index % 200)) * 100,
    status: ['pending', 'authorized', 'captured'][index % 3],
    verificationPaymentIntentId: `pi_verification_${index}`,
    activePaymentIntentId: `pi_active_${index}`,
    capturePaymentIntentId: index % 2 === 0 ? `pi_capture_${index}` : null,
    capturedAmount: index % 2 === 0 ? (50 + (index % 100)) * 100 : null,
    releasedAmount: null,
    createdAt: now,
    initialAuthorizationAt: now,
    lastAuthorizationAt: now,
    capturedAt: index % 2 === 0 ? now : null,
    releasedAt: null,
    metadata: {
      testData: true,
      index,
      category: `category_${index % 5}`
    },
    captureHistory: index % 2 === 0 ? [
      { amount: 5000, timestamp: now, success: true }
    ] : [],
    authorizationHistory: [
      { amount: (100 + (index % 200)) * 100, timestamp: now, success: true }
    ],
    lastError: index % 5 === 0 ? { message: 'Test error', code: 'test_error' } : undefined,
    actionRequired: index % 10 === 0 ? { type: 'authentication', details: 'Test auth' } : undefined
  };
}

async function testSQLitePerformance() {
  console.log('🗄️  SQLite Performance Test');
  
  const env = loadEnv();
  const testDbPath = path.join(__dirname, '..', 'data', 'test-performance.sqlite');
  
  // Clean up any existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  try {
    const repo = new SqliteDepositRepository({ filePath: testDbPath });
    
    console.log('📊 Testing SQLite repository performance...');
    
    const testCounts = {
      create: 50,
      read: 25,
      update: 10
    };
    
    const results = {
      create: [],
      read: [],
      update: [],
      list: 0
    };
    
    const createdIds = [];
    
    // Test CREATE operations
    console.log(`\n📝 Testing ${testCounts.create} CREATE operations...`);
    const createStart = Date.now();
    
    for (let i = 0; i < testCounts.create; i++) {
      const deposit = generateTestDeposit(i);
      const opStart = Date.now();
      await repo.create(deposit);
      const opEnd = Date.now();
      
      results.create.push(opEnd - opStart);
      createdIds.push(deposit.id);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  Created ${i + 1}/${testCounts.create} deposits...`);
      }
    }
    
    const createEnd = Date.now();
    const createTotal = createEnd - createStart;
    const createAvg = results.create.reduce((a, b) => a + b, 0) / results.create.length;
    
    console.log(`✅ CREATE: ${createTotal}ms total, ${createAvg.toFixed(2)}ms average`);
    
    // Test READ operations
    console.log(`\n📖 Testing ${testCounts.read} READ operations...`);
    const readStart = Date.now();
    
    for (let i = 0; i < testCounts.read; i++) {
      const randomId = createdIds[Math.floor(Math.random() * createdIds.length)];
      const opStart = Date.now();
      await repo.findById(randomId);
      const opEnd = Date.now();
      
      results.read.push(opEnd - opStart);
    }
    
    const readEnd = Date.now();
    const readTotal = readEnd - readStart;
    const readAvg = results.read.reduce((a, b) => a + b, 0) / results.read.length;
    
    console.log(`✅ READ: ${readTotal}ms total, ${readAvg.toFixed(2)}ms average`);
    
    // Test UPDATE operations
    console.log(`\n✏️  Testing ${testCounts.update} UPDATE operations...`);
    const updateStart = Date.now();
    
    for (let i = 0; i < testCounts.update; i++) {
      const randomId = createdIds[Math.floor(Math.random() * createdIds.length)];
      const opStart = Date.now();
      await repo.update(randomId, (deposit) => ({
        ...deposit,
        status: 'updated',
        metadata: { ...deposit.metadata, updated: true, updateIndex: i }
      }));
      const opEnd = Date.now();
      
      results.update.push(opEnd - opStart);
    }
    
    const updateEnd = Date.now();
    const updateTotal = updateEnd - updateStart;
    const updateAvg = results.update.reduce((a, b) => a + b, 0) / results.update.length;
    
    console.log(`✅ UPDATE: ${updateTotal}ms total, ${updateAvg.toFixed(2)}ms average`);
    
    // Test LIST operation
    console.log('\n📋 Testing LIST operation...');
    const listStart = Date.now();
    const allDeposits = await repo.list();
    const listEnd = Date.now();
    results.list = listEnd - listStart;
    
    console.log(`✅ LIST: ${results.list}ms (${allDeposits.length} deposits)`);
    
    // Test QUERY operations if available
    if (repo.findByStatus) {
      console.log('\n🔍 Testing QUERY operations...');
      
      const queryStart = Date.now();
      const authorizedDeposits = await repo.findByStatus('authorized', 20);
      const queryEnd = Date.now();
      
      console.log(`✅ QUERY by status: ${queryEnd - queryStart}ms (${authorizedDeposits.length} results)`);
    }
    
    // Performance summary
    console.log('\n📈 SQLite Performance Summary:');
    console.log('==============================');
    console.log(`CREATE: ${createAvg.toFixed(2)}ms avg (${testCounts.create} ops)`);
    console.log(`READ:   ${readAvg.toFixed(2)}ms avg (${testCounts.read} ops)`);
    console.log(`UPDATE: ${updateAvg.toFixed(2)}ms avg (${testCounts.update} ops)`);
    console.log(`LIST:   ${results.list}ms (${allDeposits.length} records)`);
    
    // Calculate throughput
    const totalOps = testCounts.create + testCounts.read + testCounts.update;
    const totalTime = createTotal + readTotal + updateTotal;
    const throughput = (totalOps / totalTime) * 1000;
    
    console.log(`\n🚀 Throughput: ${throughput.toFixed(2)} operations/second`);
    
    // Database file size
    const stats = fs.statSync(testDbPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`💾 Database size: ${fileSizeKB} KB`);
    
    // Performance assessment
    console.log('\n🎯 Performance Assessment:');
    if (createAvg < 10) {
      console.log('✅ CREATE performance: Excellent (<10ms)');
    } else if (createAvg < 50) {
      console.log('✅ CREATE performance: Good (<50ms)');
    } else {
      console.log('⚠️  CREATE performance: Needs optimization (>50ms)');
    }
    
    if (readAvg < 5) {
      console.log('✅ READ performance: Excellent (<5ms)');
    } else if (readAvg < 20) {
      console.log('✅ READ performance: Good (<20ms)');
    } else {
      console.log('⚠️  READ performance: Needs optimization (>20ms)');
    }
    
    if (throughput > 100) {
      console.log('✅ Overall throughput: Excellent (>100 ops/sec)');
    } else if (throughput > 50) {
      console.log('✅ Overall throughput: Good (>50 ops/sec)');
    } else {
      console.log('⚠️  Overall throughput: Needs optimization (<50 ops/sec)');
    }
    
    console.log('\n💡 Recommendations:');
    console.log('• SQLite is suitable for development and small-scale production');
    console.log('• For high-traffic production, consider PostgreSQL');
    console.log('• Current performance is adequate for typical deposit workflows');
    console.log('• Database file size grows linearly with deposit count');
    
    return {
      createAvg,
      readAvg,
      updateAvg,
      listTime: results.list,
      throughput,
      fileSizeKB: parseFloat(fileSizeKB),
      totalDeposits: allDeposits.length
    };
    
  } catch (error) {
    console.error('❌ SQLite performance test failed:', error.message);
    throw error;
  } finally {
    // Cleanup test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('\n🧹 Cleaned up test database');
    }
  }
}

async function main() {
  console.log('⚡ SQLite Performance Testing Tool');
  
  try {
    const results = await testSQLitePerformance();
    
    console.log('\n✅ SQLite performance testing completed!');
    console.log('\n📊 Results Summary:');
    console.log(`   CREATE: ${results.createAvg.toFixed(2)}ms avg`);
    console.log(`   READ:   ${results.readAvg.toFixed(2)}ms avg`);
    console.log(`   UPDATE: ${results.updateAvg.toFixed(2)}ms avg`);
    console.log(`   LIST:   ${results.listTime}ms`);
    console.log(`   Throughput: ${results.throughput.toFixed(2)} ops/sec`);
    console.log(`   File size: ${results.fileSizeKB} KB for ${results.totalDeposits} deposits`);
    
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
  testSQLitePerformance,
  generateTestDeposit
};
