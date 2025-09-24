// Global repository instance for serverless environments
global.SHARED_REPOSITORY_INSTANCE = global.SHARED_REPOSITORY_INSTANCE || null;

// Repository factory that handles different database types
function createDepositRepository(options = {}) {
  const { type = 'auto', forceNew = false, ...repoOptions } = options;

  // Return existing instance if available (unless forceNew is true)
  if (!forceNew && global.SHARED_REPOSITORY_INSTANCE) {
    console.log('♻️ Reusing existing repository instance:', global.SHARED_REPOSITORY_INSTANCE.constructor.name);
    return global.SHARED_REPOSITORY_INSTANCE;
  }

  // Auto-detect based on environment
  if (type === 'auto') {
    // Check for PostgreSQL connection string
    if (process.env.DATABASE_URL) {
      try {
        const { PostgresDepositRepository } = require('./postgresDepositRepository');
        console.log('✅ Using PostgreSQL repository');
        global.SHARED_REPOSITORY_INSTANCE = new PostgresDepositRepository(repoOptions);
        return global.SHARED_REPOSITORY_INSTANCE;
      } catch (error) {
        console.warn('⚠️ PostgreSQL not available, falling back:', error.message);
      }
    }

    // Try SQLite
    try {
      const { SqliteDepositRepository } = require('./sqliteDepositRepository');
      console.log('✅ Using SQLite repository');
      global.SHARED_REPOSITORY_INSTANCE = new SqliteDepositRepository(repoOptions);
      return global.SHARED_REPOSITORY_INSTANCE;
    } catch (error) {
      console.warn('⚠️ SQLite not available, using memory repository:', error.message);
      const { MemoryDepositRepository } = require('./memoryDepositRepository');
      global.SHARED_REPOSITORY_INSTANCE = new MemoryDepositRepository(repoOptions);
      return global.SHARED_REPOSITORY_INSTANCE;
    }
  }

  // Explicit type selection
  let repository;
  switch (type) {
    case 'postgres':
    case 'postgresql':
      const { PostgresDepositRepository } = require('./postgresDepositRepository');
      repository = new PostgresDepositRepository(repoOptions);
      break;

    case 'sqlite':
      const { SqliteDepositRepository } = require('./sqliteDepositRepository');
      repository = new SqliteDepositRepository(repoOptions);
      break;

    case 'file':
      const { FileDepositRepository } = require('./fileDepositRepository');
      repository = new FileDepositRepository(repoOptions);
      break;

    case 'memory':
      const { MemoryDepositRepository } = require('./memoryDepositRepository');
      repository = new MemoryDepositRepository(repoOptions);
      break;

    default:
      throw new Error(`Unknown repository type: ${type}`);
  }

  // Store globally and return
  global.SHARED_REPOSITORY_INSTANCE = repository;
  return repository;
}

module.exports = { createDepositRepository };
