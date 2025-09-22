const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

function clone(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

class WebhookRetryQueue {
  constructor({ filePath, deadLetterPath, logger }) {
    if (!filePath) {
      throw new Error('WebhookRetryQueue requires filePath');
    }

    this.filePath = filePath;
    this.directory = path.dirname(filePath);
    this.deadLetterPath = deadLetterPath || path.join(this.directory, 'webhook-dead-letter.json');
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    this.initialized = false;
    this.deadLetterInitialized = false;
  }

  async #ensureQueueFile() {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(this.directory, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch (error) {
      await fs.writeFile(this.filePath, '[]', 'utf8');
    }

    this.initialized = true;
  }

  async #ensureDeadLetterFile() {
    if (this.deadLetterInitialized) {
      return;
    }

    await fs.mkdir(path.dirname(this.deadLetterPath), { recursive: true });
    try {
      await fs.access(this.deadLetterPath);
    } catch (error) {
      await fs.writeFile(this.deadLetterPath, '[]', 'utf8');
    }

    this.deadLetterInitialized = true;
  }

  async #readQueue() {
    await this.#ensureQueueFile();
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      if (!content) {
        return [];
      }
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to read webhook retry queue', { error: error.message });
      return [];
    }
  }

  async #writeQueue(entries) {
    await this.#ensureQueueFile();
    const payload = JSON.stringify(entries, null, 2);
    await fs.writeFile(this.filePath, payload, 'utf8');
  }

  async #appendDeadLetter(entry) {
    await this.#ensureDeadLetterFile();
    try {
      const content = await fs.readFile(this.deadLetterPath, 'utf8');
      const records = content ? JSON.parse(content) : [];
      records.push(entry);
      await fs.writeFile(this.deadLetterPath, JSON.stringify(records, null, 2), 'utf8');
    } catch (error) {
      this.logger.error('Failed to persist webhook dead-letter record', { error: error.message });
    }
  }

  async enqueue(event, metadata = {}) {
    if (!event) {
      throw new Error('Cannot enqueue empty webhook event');
    }

    const entries = await this.#readQueue();
    const record = {
      id: randomUUID(),
      event,
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
      lastAttemptAt: null,
      lastError: null,
      metadata,
    };
    entries.push(record);
    await this.#writeQueue(entries);
    this.logger.info('Webhook added to retry queue', { id: record.id, type: event.type });
    return record;
  }

  async drain(limit) {
    const entries = await this.#readQueue();
    if (!entries.length) {
      return [];
    }

    const batch = entries.slice(0, limit);
    const remainder = entries.slice(limit);
    await this.#writeQueue(remainder);
    return batch.map((item) => ({
      ...item,
      event: clone(item.event),
      metadata: clone(item.metadata),
    }));
  }

  async requeue(entry, error) {
    const updated = {
      ...entry,
      event: clone(entry.event),
      metadata: clone(entry.metadata),
      attempts: entry.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
      lastError: error ? error.message || String(error) : entry.lastError,
    };
    const entries = await this.#readQueue();
    entries.push(updated);
    await this.#writeQueue(entries);
    this.logger.warn('Webhook requeued for retry', { id: updated.id, attempts: updated.attempts });
  }

  async deadLetter(entry, reason) {
    const record = {
      ...entry,
      event: clone(entry.event),
      metadata: clone(entry.metadata),
      deadLetteredAt: new Date().toISOString(),
      reason: reason || entry.lastError,
    };
    await this.#appendDeadLetter(record);
    this.logger.error('Webhook moved to dead-letter queue', { id: entry.id, attempts: entry.attempts, reason: record.reason });
  }

  async count() {
    const entries = await this.#readQueue();
    return entries.length;
  }

  async peek(limit) {
    const entries = await this.#readQueue();
    return entries.slice(0, limit).map((item) => ({
      ...item,
      event: clone(item.event),
      metadata: clone(item.metadata),
    }));
  }
}

module.exports = { WebhookRetryQueue };
