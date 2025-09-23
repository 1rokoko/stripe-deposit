#!/usr/bin/env node

/**
 * Database Migration Tool
 * Migrates data between SQLite and PostgreSQL repositories
 */

const { loadEnv } = require('../src/config');
const { SqliteDepositRepository } = require('../src/repositories/sqliteDepositRepository');
const { PostgresDepositRepository } = require('../src/repositories/postgresDepositRepository');
const { MemoryDepositRepository } = require('../src/repositories/memoryDepositRepository');

async function migrateData(sourceRepo, targetRepo, options = {}) {
  const { dryRun = false, batchSize = 100 } = options;
  
  console.log(`\n🔄 Starting migration (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
  
  try {
    // Get all deposits from source
    console.log('📊 Fetching deposits from source repository...');
    const deposits = await sourceRepo.list();
    console.log(`📄 Found ${deposits.length} deposits to migrate`);
    
    if (deposits.length === 0) {
      console.log('✅ No deposits to migrate');
      return { migrated: 0, errors: [] };
    }
    
    // Check for existing deposits in target
    console.log('🔍 Checking for existing deposits in target repository...');
    const existingDeposits = await targetRepo.list();
    const existingIds = new Set(existingDeposits.map(d => d.id));
    
    const depositsToMigrate = deposits.filter(d => !existingIds.has(d.id));
    const skippedCount = deposits.length - depositsToMigrate.length;
    
    if (skippedCount > 0) {
      console.log(`⚠️  Skipping ${skippedCount} deposits that already exist in target`);
    }
    
    console.log(`📦 Migrating ${depositsToMigrate.length} new deposits...`);
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN - Would migrate:');
      depositsToMigrate.forEach((deposit, index) => {
        console.log(`  ${index + 1}. ${deposit.id} (${deposit.status}, $${deposit.holdAmount/100})`);
      });
      return { migrated: depositsToMigrate.length, errors: [], dryRun: true };
    }
    
    // Migrate in batches
    const errors = [];
    let migrated = 0;
    
    for (let i = 0; i < depositsToMigrate.length; i += batchSize) {
      const batch = depositsToMigrate.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(depositsToMigrate.length/batchSize)} (${batch.length} deposits)...`);
      
      for (const deposit of batch) {
        try {
          await targetRepo.create(deposit);
          migrated++;
          console.log(`  ✅ Migrated: ${deposit.id}`);
        } catch (error) {
          errors.push({ depositId: deposit.id, error: error.message });
          console.log(`  ❌ Failed: ${deposit.id} - ${error.message}`);
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < depositsToMigrate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`   Migrated: ${migrated} deposits`);
    console.log(`   Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Migration errors:');
      errors.forEach(({ depositId, error }) => {
        console.log(`   ${depositId}: ${error}`);
      });
    }
    
    return { migrated, errors };
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function validateMigration(sourceRepo, targetRepo) {
  console.log('\n🔍 Validating migration...');
  
  try {
    const sourceDeposits = await sourceRepo.list();
    const targetDeposits = await targetRepo.list();
    
    console.log(`📊 Source: ${sourceDeposits.length} deposits`);
    console.log(`📊 Target: ${targetDeposits.length} deposits`);
    
    const sourceIds = new Set(sourceDeposits.map(d => d.id));
    const targetIds = new Set(targetDeposits.map(d => d.id));
    
    const missing = sourceDeposits.filter(d => !targetIds.has(d.id));
    const extra = targetDeposits.filter(d => !sourceIds.has(d.id));
    
    if (missing.length > 0) {
      console.log(`⚠️  Missing in target: ${missing.length} deposits`);
      missing.forEach(d => console.log(`   - ${d.id}`));
    }
    
    if (extra.length > 0) {
      console.log(`ℹ️  Extra in target: ${extra.length} deposits`);
      extra.forEach(d => console.log(`   + ${d.id}`));
    }
    
    // Validate data integrity for common deposits
    const commonIds = sourceDeposits.filter(d => targetIds.has(d.id));
    let dataErrors = 0;
    
    for (const sourceDeposit of commonIds.slice(0, 10)) { // Sample first 10
      const targetDeposit = targetDeposits.find(d => d.id === sourceDeposit.id);
      
      if (sourceDeposit.status !== targetDeposit.status) {
        console.log(`⚠️  Status mismatch for ${sourceDeposit.id}: ${sourceDeposit.status} vs ${targetDeposit.status}`);
        dataErrors++;
      }
      
      if (sourceDeposit.holdAmount !== targetDeposit.holdAmount) {
        console.log(`⚠️  Amount mismatch for ${sourceDeposit.id}: ${sourceDeposit.holdAmount} vs ${targetDeposit.holdAmount}`);
        dataErrors++;
      }
    }
    
    if (dataErrors === 0 && missing.length === 0) {
      console.log('✅ Migration validation passed!');
      return true;
    } else {
      console.log(`❌ Migration validation failed: ${missing.length} missing, ${dataErrors} data errors`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return false;
  }
}

async function createRepository(type, options = {}) {
  switch (type) {
    case 'sqlite':
      return new SqliteDepositRepository({
        filePath: options.filePath || process.env.DATABASE_FILE || './data/deposits.sqlite'
      });
    
    case 'postgres':
      return new PostgresDepositRepository({
        connectionString: options.connectionString || process.env.DATABASE_URL
      });
    
    case 'memory':
      return new MemoryDepositRepository();
    
    default:
      throw new Error(`Unknown repository type: ${type}`);
  }
}

async function main() {
  console.log('🗄️  Database Migration Tool');
  
  const env = loadEnv();
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const sourceType = args[0] || 'sqlite';
  const targetType = args[1] || 'postgres';
  const dryRun = args.includes('--dry-run');
  const validate = args.includes('--validate');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 100;
  
  if (args.includes('--help')) {
    console.log(`
Usage: node scripts/migrate-database.js [source] [target] [options]

Arguments:
  source    Source repository type (sqlite, postgres, memory) [default: sqlite]
  target    Target repository type (sqlite, postgres, memory) [default: postgres]

Options:
  --dry-run           Show what would be migrated without actually doing it
  --validate          Validate migration after completion
  --batch-size=N      Process N deposits at a time [default: 100]
  --help              Show this help message

Environment Variables:
  DATABASE_FILE       SQLite database file path
  DATABASE_URL        PostgreSQL connection string

Examples:
  node scripts/migrate-database.js sqlite postgres --dry-run
  node scripts/migrate-database.js sqlite postgres --validate
  node scripts/migrate-database.js memory postgres --batch-size=50
    `);
    return;
  }
  
  console.log(`📊 Migration: ${sourceType} → ${targetType}`);
  console.log(`🔧 Options: ${dryRun ? 'DRY RUN' : 'LIVE'}, batch size: ${batchSize}`);
  
  try {
    // Create repositories
    console.log('\n🔌 Connecting to repositories...');
    const sourceRepo = await createRepository(sourceType);
    const targetRepo = await createRepository(targetType);
    
    // Test connections
    if (sourceRepo.healthCheck) {
      const sourceHealth = await sourceRepo.healthCheck();
      console.log(`📊 Source health: ${sourceHealth.healthy ? '✅' : '❌'} (${sourceHealth.database})`);
      if (!sourceHealth.healthy) {
        throw new Error(`Source repository unhealthy: ${sourceHealth.error}`);
      }
    }
    
    if (targetRepo.healthCheck) {
      const targetHealth = await targetRepo.healthCheck();
      console.log(`📊 Target health: ${targetHealth.healthy ? '✅' : '❌'} (${targetHealth.database})`);
      if (!targetHealth.healthy) {
        throw new Error(`Target repository unhealthy: ${targetHealth.error}`);
      }
    }
    
    // Perform migration
    const result = await migrateData(sourceRepo, targetRepo, { dryRun, batchSize });
    
    // Validate if requested
    if (validate && !dryRun) {
      await validateMigration(sourceRepo, targetRepo);
    }
    
    // Cleanup
    if (sourceRepo.close) await sourceRepo.close();
    if (targetRepo.close) await targetRepo.close();
    
    console.log('\n🎉 Migration tool completed successfully!');
    
    if (!dryRun) {
      console.log('\n💡 Next steps:');
      console.log('   • Update environment variables to use new database');
      console.log('   • Test application with new database');
      console.log('   • Backup old database before removing');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateData,
  validateMigration,
  createRepository
};
