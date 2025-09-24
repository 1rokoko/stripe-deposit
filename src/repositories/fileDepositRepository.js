/**
 * Simple file-based repository for Vercel serverless environment
 * Uses JSON file in /tmp directory for persistence
 */

const fs = require('fs');
const path = require('path');

class FileDepositRepository {
  constructor(options = {}) {
    this.filePath = options.filePath || '/tmp/stripe-deposits.json';
    this.deposits = new Map();
    this.loadFromFile();
  }

  loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const depositsArray = JSON.parse(data);
        this.deposits = new Map(depositsArray.map(d => [d.id, d]));
        console.log(`📁 Loaded ${this.deposits.size} deposits from file`);
      } else {
        console.log('📁 No existing deposits file, starting fresh');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load deposits from file:', error.message);
      this.deposits = new Map();
    }
  }

  saveToFile() {
    try {
      const depositsArray = Array.from(this.deposits.values());
      fs.writeFileSync(this.filePath, JSON.stringify(depositsArray, null, 2));
      console.log(`💾 Saved ${depositsArray.length} deposits to file`);
    } catch (error) {
      console.warn('⚠️ Failed to save deposits to file:', error.message);
    }
  }

  async save(deposit) {
    this.deposits.set(deposit.id, { ...deposit });
    this.saveToFile();
    return deposit;
  }

  async findById(id) {
    return this.deposits.get(id) || null;
  }

  async findAll(filters = {}) {
    let deposits = Array.from(this.deposits.values());
    
    // Apply filters
    if (filters.status) {
      deposits = deposits.filter(d => d.status === filters.status);
    }
    if (filters.customerId) {
      deposits = deposits.filter(d => d.customerId === filters.customerId);
    }
    
    // Sort by creation date (newest first)
    deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply limit
    if (filters.limit) {
      deposits = deposits.slice(0, filters.limit);
    }
    
    return {
      deposits,
      total: deposits.length
    };
  }

  async update(id, updateFn) {
    const deposit = this.deposits.get(id);
    if (!deposit) {
      throw new Error(`Deposit not found: ${id}`);
    }
    
    const updated = updateFn(deposit);
    this.deposits.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async delete(id) {
    const deleted = this.deposits.delete(id);
    if (deleted) {
      this.saveToFile();
    }
    return deleted;
  }

  async healthCheck() {
    try {
      // Test file operations
      const testPath = path.join(path.dirname(this.filePath), 'health-test.json');
      fs.writeFileSync(testPath, '{"test": true}');
      fs.unlinkSync(testPath);
      
      return {
        healthy: true,
        type: 'FileDepositRepository',
        filePath: this.filePath,
        count: this.deposits.size
      };
    } catch (error) {
      return {
        healthy: false,
        type: 'FileDepositRepository',
        error: error.message
      };
    }
  }
}

module.exports = { FileDepositRepository };
