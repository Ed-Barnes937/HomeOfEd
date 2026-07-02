import type { Logger } from '@hoe/backend-kit'

export type { Logger }

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/** A field key is redacted when its lowercased name contains any of these. */
const REDACTED_KEY_PARTS = ['password', 'token', 'secret', 'authorization', 'cookie']

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return REDACTED_KEY_PARTS.some((part) => lower.includes(part))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Deep-copy plain objects/arrays, replacing sensitive values and cycles. */
function redact(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
    return value.map((item) => redact(item, seen))
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : redact(item, seen)
    }
    return out
  }
  return value
}

function parseLevel(raw: string | undefined): LogLevel | undefined {
  return raw !== undefined && raw in LEVEL_WEIGHT ? (raw as LogLevel) : undefined
}

export interface CreateLoggerOptions {
  /** Minimum level to emit. Defaults to LOG_LEVEL env var, else 'info'. */
  level?: LogLevel
  /** Sink for finished lines (no trailing newline). Defaults to stdout. */
  write?: (line: string) => void
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? parseLevel(process.env.LOG_LEVEL) ?? 'info'
  const write =
    options.write ??
    ((line: string) => {
      process.stdout.write(line + '\n')
    })
  const threshold = LEVEL_WEIGHT[level]

  function make(bindings: Record<string, unknown>): Logger {
    const emit = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>): void => {
      if (LEVEL_WEIGHT[lvl] < threshold) return
      const merged = redact({ ...bindings, ...fields }, new WeakSet()) as Record<string, unknown>
      delete merged['level']
      delete merged['msg']
      delete merged['time']
      write(JSON.stringify({ level: lvl, msg, time: new Date().toISOString(), ...merged }))
    }
    return {
      debug: (msg, fields) => emit('debug', msg, fields),
      info: (msg, fields) => emit('info', msg, fields),
      warn: (msg, fields) => emit('warn', msg, fields),
      error: (msg, fields) => emit('error', msg, fields),
      child: (childBindings) => make({ ...bindings, ...childBindings }),
    }
  }

  return make({})
}

/**
 * Derive a per-request child logger: binds `requestId` from the request's
 * `x-request-id` header, generating a UUID when absent. Pass the result as the
 * `logger` seen by handlers for that request.
 */
export function requestLogger(
  base: Logger,
  req?: { headers: { get(name: string): string | null } },
): Logger {
  const requestId = req?.headers.get('x-request-id') ?? crypto.randomUUID()
  return base.child({ requestId })
}
