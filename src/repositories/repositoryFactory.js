// Repository factory that handles SQLite compatibility issues
function createDepositRepository(options = {}) {
  try {
    // Try to load SQLite repository
    const { SqliteDepositRepository } = require('./sqliteDepositRepository');
    return new SqliteDepositRepository(options);
  } catch (error) {
    // Fallback to memory repository if SQLite fails
    console.warn('SQLite not available, using memory repository:', error.message);
    const { MemoryDepositRepository } = require('./memoryDepositRepository');
    return new MemoryDepositRepository(options);
  }
}

module.exports = { createDepositRepository };
