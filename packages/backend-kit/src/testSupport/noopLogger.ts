import type { Logger } from '../logger.ts'

/** Silent Logger for tests — keeps test output clean. */
export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  child(): Logger {
    return this
  }
}
