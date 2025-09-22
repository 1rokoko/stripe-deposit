class Logger {
  constructor(prefix = 'app') {
    this.prefix = prefix;
  }

  info(message, extra = {}) {
    this.#log('info', message, extra);
  }

  warn(message, extra = {}) {
    this.#log('warn', message, extra);
  }

  error(message, extra = {}) {
    this.#log('error', message, extra);
  }

  debug(message, extra = {}) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.#log('debug', message, extra);
    }
  }

  #log(level, message, extra) {
    const timestamp = new Date().toISOString();
    const payload = { level, message, timestamp, prefix: this.prefix, ...extra };
    console[level] ? console[level](JSON.stringify(payload)) : console.log(JSON.stringify(payload));
  }
}

function buildLogger(prefix) {
  return new Logger(prefix);
}

module.exports = { Logger, buildLogger };
