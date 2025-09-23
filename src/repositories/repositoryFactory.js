// Repository factory that handles different database types
function createDepositRepository(options = {}) {
  const { type = 'auto', ...repoOptions } = options;

  // Auto-detect based on environment
  if (type === 'auto') {
    // Check for PostgreSQL connection string
    if (process.env.DATABASE_URL) {
      try {
        const { PostgresDepositRepository } = require('./postgresDepositRepository');
        console.log('Using PostgreSQL repository');
        return new PostgresDepositRepository(repoOptions);
      } catch (error) {
        console.warn('PostgreSQL not available, falling back:', error.message);
      }
    }

    // Try SQLite
    try {
      const { SqliteDepositRepository } = require('./sqliteDepositRepository');
      console.log('Using SQLite repository');
      return new SqliteDepositRepository(repoOptions);
    } catch (error) {
      console.warn('SQLite not available, using memory repository:', error.message);
      const { MemoryDepositRepository } = require('./memoryDepositRepository');
      return new MemoryDepositRepository(repoOptions);
    }
  }

  // Explicit type selection
  switch (type) {
    case 'postgres':
    case 'postgresql':
      const { PostgresDepositRepository } = require('./postgresDepositRepository');
      return new PostgresDepositRepository(repoOptions);

    case 'sqlite':
      const { SqliteDepositRepository } = require('./sqliteDepositRepository');
      return new SqliteDepositRepository(repoOptions);

    case 'memory':
      const { MemoryDepositRepository } = require('./memoryDepositRepository');
      return new MemoryDepositRepository(repoOptions);

    default:
      throw new Error(`Unknown repository type: ${type}`);
  }
}

module.exports = { createDepositRepository };
