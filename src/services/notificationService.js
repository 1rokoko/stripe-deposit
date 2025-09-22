const fs = require('fs/promises');
const path = require('path');

class NotificationService {
  constructor({ filePath, logger, maxSizeBytes, maxBackups, externalWebhookUrl, fetch, externalTimeoutMs }) {
    if (!filePath) {
      throw new Error('NotificationService requires a filePath');
    }

    this.filePath = filePath;
    this.logger = logger || { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
    this.directory = path.dirname(filePath);
    this.initialized = false;
    this.maxSizeBytes = Number.isFinite(maxSizeBytes) && maxSizeBytes > 0 ? maxSizeBytes : null;
    this.maxBackups = Number.isInteger(maxBackups) && maxBackups >= 0 ? maxBackups : 0;
    this.externalWebhookUrl = externalWebhookUrl || null;
    this.fetch = fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    this.externalTimeoutMs = Number.isFinite(externalTimeoutMs) && externalTimeoutMs > 0 ? externalTimeoutMs : 5_000;
  }

  async #ensureFile() {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(this.directory, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch (error) {
      await fs.writeFile(this.filePath, '', 'utf8');
    }

    this.initialized = true;
  }

  async #rotateIfNeeded(expectedAppendBytes) {
    if (!this.maxSizeBytes) {
      return;
    }

    try {
      const stats = await fs.stat(this.filePath);
      if (stats.size + expectedAppendBytes <= this.maxSizeBytes) {
        return;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      this.logger.error('Failed to stat notifications log', { error: error.message });
      return;
    }

    await this.#performRotation();
  }

  async #performRotation() {
    if (!this.maxSizeBytes) {
      return;
    }

    if (!this.maxBackups) {
      await fs.writeFile(this.filePath, '', 'utf8');
      return;
    }

    for (let index = this.maxBackups - 1; index >= 0; index -= 1) {
      const source = index === 0 ? this.filePath : `${this.filePath}.${index}`;
      const target = `${this.filePath}.${index + 1}`;

      try {
        await fs.rm(target, { force: true });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.warn('Failed to remove rotated notifications log', {
            error: error.message,
            target,
          });
        }
      }

      try {
        await fs.rename(source, target);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.error('Failed to rotate notifications log', {
            error: error.message,
            source,
            target,
          });
        }
      }
    }

    await fs.writeFile(this.filePath, '', 'utf8');
  }

  async notify({ type, depositId, status, message, payload }) {
    if (!type) {
      throw new Error('Notification type is required');
    }

    await this.#ensureFile();
    const record = {
      timestamp: new Date().toISOString(),
      type,
      depositId,
      status,
      message,
      payload,
    };

    const line = `${JSON.stringify(record)}\n`;
    try {
      await this.#rotateIfNeeded(Buffer.byteLength(line, 'utf8'));
      await fs.appendFile(this.filePath, line, 'utf8');
      this.logger.info('Notification emitted', { type, depositId, status });
      await this.#dispatchExternal(record);
    } catch (error) {
      this.logger.error('Failed to write notification', { error: error.message, type, depositId });
    }
  }

  async #dispatchExternal(record) {
    if (!this.externalWebhookUrl || !this.fetch) {
      return;
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), this.externalTimeoutMs)
      : setTimeout(() => {}, this.externalTimeoutMs);

    try {
      const response = await this.fetch(this.externalWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
        signal: controller?.signal,
      });

      if (!response || response.ok !== true) {
        const status = response ? response.status : 'no-response';
        this.logger.warn('External notification returned non-success status', {
          status,
          webhookUrl: this.externalWebhookUrl,
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        this.logger.error('External notification timed out', {
          webhookUrl: this.externalWebhookUrl,
          timeoutMs: this.externalTimeoutMs,
        });
      } else {
        this.logger.error('External notification failed', {
          error: error.message,
          webhookUrl: this.externalWebhookUrl,
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { NotificationService };
