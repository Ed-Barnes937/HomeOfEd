/** Minimal logging shape. Frozen here; @hoe/logger (T2.3) implements it. */
export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void
  info(message: string, fields?: Record<string, unknown>): void
  warn(message: string, fields?: Record<string, unknown>): void
  error(message: string, fields?: Record<string, unknown>): void
  child(bindings: Record<string, unknown>): Logger
}

/** Throwaway console stand-in until @hoe/logger lands (T2.3). */
export class ConsoleLogger implements Logger {
  private readonly bindings: Record<string, unknown>

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = bindings
  }

  private log(level: string, message: string, fields?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level, message, ...this.bindings, ...fields }))
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log('debug', message, fields)
  }
  info(message: string, fields?: Record<string, unknown>): void {
    this.log('info', message, fields)
  }
  warn(message: string, fields?: Record<string, unknown>): void {
    this.log('warn', message, fields)
  }
  error(message: string, fields?: Record<string, unknown>): void {
    this.log('error', message, fields)
  }
  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings })
  }
}
