const fs = require('fs/promises');
const path = require('path');

class JobHealthStore {
  constructor({ filePath, logger }) {
    if (!filePath) {
      throw new Error('JobHealthStore requires filePath');
    }

    this.filePath = filePath;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    this.directory = path.dirname(filePath);
    this.initialized = false;
  }

  async #ensureFile() {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(this.directory, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch (error) {
      await fs.writeFile(this.filePath, '{}', 'utf8');
    }

    this.initialized = true;
  }

  async #readAll() {
    await this.#ensureFile();
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      if (!content) {
        return {};
      }
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to read job health store', { error: error.message });
      return {};
    }
  }

  async #writeAll(data) {
    await this.#ensureFile();
    const payload = JSON.stringify(data, null, 2);
    await fs.writeFile(this.filePath, payload, 'utf8');
  }

  async readAll() {
    return this.#readAll();
  }

  async readJob(jobName) {
    const all = await this.#readAll();
    return all[jobName];
  }

  async recordRun({ jobName, startedAt, durationMs, success, stats, error, failureCount }) {
    if (!jobName) {
      throw new Error('jobName is required to record health');
    }

    const all = await this.#readAll();
    const nowIso = new Date().toISOString();
    const entry = all[jobName] || {
      jobName,
      totalRuns: 0,
      totalFailures: 0,
    };

    entry.totalRuns += 1;
    entry.lastRunAt = startedAt || nowIso;
    entry.lastDurationMs = durationMs ?? null;
    entry.lastStats = stats || null;

    if (success) {
      entry.lastSuccessAt = nowIso;
      entry.lastError = null;
    } else {
      entry.totalFailures += 1;
      entry.lastError = {
        message: error && error.message ? error.message : error || 'Job run failed',
        occurredAt: nowIso,
        failureCount: failureCount ?? 1,
      };
    }

    all[jobName] = entry;

    try {
      await this.#writeAll(all);
    } catch (writeError) {
      this.logger.error('Failed to persist job health', { error: writeError.message, jobName });
    }
  }
}

module.exports = { JobHealthStore };
