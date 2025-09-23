// Memory-based deposit repository for serverless environments
class MemoryDepositRepository {
  constructor({ filePath } = {}) {
    this.deposits = new Map();
    this.filePath = filePath; // For compatibility, not used
  }

  async save(deposit) {
    // Clone the deposit to avoid reference issues
    const cloned = JSON.parse(JSON.stringify(deposit));
    this.deposits.set(deposit.id, cloned);
    return cloned;
  }

  async findById(id) {
    const deposit = this.deposits.get(id);
    return deposit ? JSON.parse(JSON.stringify(deposit)) : null;
  }

  async findAll(filters = {}) {
    const deposits = Array.from(this.deposits.values());
    let filtered = deposits;

    if (filters.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }
    if (filters.customerId) {
      filtered = filtered.filter(d => d.customerId === filters.customerId);
    }
    if (filters.paymentMethodId) {
      filtered = filtered.filter(d => d.paymentMethodId === filters.paymentMethodId);
    }

    // Apply limit
    const limit = filters.limit || 100;
    const result = filtered.slice(0, limit);

    return {
      deposits: result.map(d => JSON.parse(JSON.stringify(d))),
      total: filtered.length
    };
  }

  async findByStatus(status, limit = 100) {
    return this.findAll({ status, limit });
  }

  async findByCustomerId(customerId, limit = 100) {
    return this.findAll({ customerId, limit });
  }

  async findByPaymentMethodId(paymentMethodId, limit = 100) {
    return this.findAll({ paymentMethodId, limit });
  }

  async findOlderThan(date, limit = 100) {
    const deposits = Array.from(this.deposits.values());
    const filtered = deposits.filter(d => {
      const lastAuth = new Date(d.lastAuthorizationAt || d.initialAuthorizationAt);
      return lastAuth < date;
    });

    return {
      deposits: filtered.slice(0, limit).map(d => JSON.parse(JSON.stringify(d))),
      total: filtered.length
    };
  }

  // Compatibility method for DepositService
  async list() {
    const result = await this.findAll();
    return result.deposits; // Return just the array, not the wrapper object
  }

  // For testing purposes
  clear() {
    this.deposits.clear();
  }

  size() {
    return this.deposits.size;
  }
}

module.exports = { MemoryDepositRepository };
