const JOB_NAME = 'reauthorization';

class ReauthorizationJob {
  constructor({
    depositService,
    repository,
    clock,
    logger,
    reauthorizeAfterDays = 5,
    intervalMs = 12 * 60 * 60 * 1000,
    healthStore,
  }) {
    if (!depositService) {
      throw new Error('ReauthorizationJob requires a depositService');
    }

    if (!repository) {
      throw new Error('ReauthorizationJob requires a repository');
    }

    this.depositService = depositService;
    this.repository = repository;
    this.clock = clock || { now: () => new Date() };
    this.logger = logger || { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
    this.reauthorizeAfterDays = reauthorizeAfterDays;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.healthStore = healthStore || null;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.logger.info('Starting reauthorization job', {
      intervalMs: this.intervalMs,
      reauthorizeAfterDays: this.reauthorizeAfterDays,
    });

    this.timer = setInterval(() => {
      this.runCycle().catch((error) => {
        this.logger.error('Reauthorization job cycle failed', { error: error.message });
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('Stopped reauthorization job');
    }
  }

  async runCycle() {
    const startedAt = this.clock.now();
    const threshold = this.reauthorizeAfterDays * 24 * 60 * 60 * 1000;
    const stats = {
      scanned: 0,
      eligible: 0,
      reauthorized: 0,
      failures: 0,
    };

    let thrownError;

    try {
      const deposits = await this.repository.list();
      for (const deposit of deposits) {
        if (deposit.status !== 'authorized') {
          continue;
        }

        stats.scanned += 1;

        const lastAuthorizationAt = new Date(deposit.lastAuthorizationAt);
        if (Number.isNaN(lastAuthorizationAt.getTime())) {
          this.logger.warn('Skipping deposit with invalid lastAuthorizationAt', { depositId: deposit.id });
          continue;
        }

        const elapsed = startedAt.getTime() - lastAuthorizationAt.getTime();
        if (elapsed >= threshold) {
          stats.eligible += 1;
          try {
            await this.depositService.reauthorizeDeposit({ depositId: deposit.id });
            stats.reauthorized += 1;
            this.logger.info('Reauthorized deposit automatically', { depositId: deposit.id });
          } catch (error) {
            stats.failures += 1;
            this.logger.error('Failed to reauthorize deposit', {
              depositId: deposit.id,
              error: error.message,
            });
          }
        }
      }
    } catch (error) {
      thrownError = error;
      throw error;
    } finally {
      if (this.healthStore) {
        const finishedAt = this.clock.now();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const success = !thrownError && stats.failures === 0;
        await this.healthStore.recordRun({
          jobName: JOB_NAME,
          startedAt: startedAt.toISOString(),
          durationMs,
          success,
          stats,
          error: thrownError || (stats.failures > 0 ? { message: 'Some deposits failed to reauthorize' } : null),
          failureCount: stats.failures,
        });
      }
    }
  }
}

module.exports = { ReauthorizationJob, JOB_NAME: JOB_NAME };
