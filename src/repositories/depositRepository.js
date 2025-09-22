const fs = require('fs/promises');
const path = require('path');

class FileDepositRepository {
  constructor({ filePath }) {
    if (!filePath) {
      throw new Error('filePath is required for FileDepositRepository');
    }

    this.filePath = filePath;
    this.initialized = false;
  }

  async #ensureFile() {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch (error) {
      await fs.writeFile(this.filePath, JSON.stringify([]), 'utf8');
    }

    this.initialized = true;
  }

  async #readAll() {
    await this.#ensureFile();
    const content = await fs.readFile(this.filePath, 'utf8');
    if (!content) {
      return [];
    }

    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      throw new Error(`Failed to parse deposit storage file: ${error.message}`);
    }
  }

  async #writeAll(deposits) {
    await this.#ensureFile();
    await fs.writeFile(this.filePath, JSON.stringify(deposits, null, 2), 'utf8');
  }

  async list() {
    const deposits = await this.#readAll();
    return deposits.map((deposit) => ({ ...deposit }));
  }

  async findById(id) {
    const deposits = await this.#readAll();
    const found = deposits.find((item) => item.id === id);
    return found ? { ...found } : undefined;
  }

  async create(deposit) {
    const deposits = await this.#readAll();
    if (deposits.some((item) => item.id === deposit.id)) {
      throw new Error(`Deposit with id ${deposit.id} already exists`);
    }

    deposits.push({ ...deposit });
    await this.#writeAll(deposits);
    return { ...deposit };
  }

  async update(id, updater) {
    const deposits = await this.#readAll();
    const index = deposits.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Deposit with id ${id} not found`);
    }

    const updated = updater({ ...deposits[index] });
    deposits[index] = { ...updated };
    await this.#writeAll(deposits);
    return { ...deposits[index] };
  }
}

class InMemoryDepositRepository {
  constructor(initialDeposits = []) {
    this.map = new Map();
    initialDeposits.forEach((deposit) => {
      this.map.set(deposit.id, { ...deposit });
    });
  }

  async list() {
    return Array.from(this.map.values()).map((item) => ({ ...item }));
  }

  async findById(id) {
    const found = this.map.get(id);
    return found ? { ...found } : undefined;
  }

  async create(deposit) {
    if (this.map.has(deposit.id)) {
      throw new Error(`Deposit with id ${deposit.id} already exists`);
    }

    this.map.set(deposit.id, { ...deposit });
    return { ...deposit };
  }

  async update(id, updater) {
    const existing = this.map.get(id);
    if (!existing) {
      throw new Error(`Deposit with id ${id} not found`);
    }

    const updated = updater({ ...existing });
    this.map.set(id, { ...updated });
    return { ...updated };
  }
}

module.exports = { FileDepositRepository, InMemoryDepositRepository };
