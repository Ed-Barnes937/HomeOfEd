import type { Logger } from '@hoe/backend-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { createLogger, requestLogger } from './index.ts'

/** Capture emitted lines instead of writing to stdout. */
function capture(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = []
  return { lines, write: (line) => lines.push(line) }
}

function parsed(lines: string[]): Record<string, unknown>[] {
  return lines.map((l) => JSON.parse(l) as Record<string, unknown>)
}

afterEach(() => {
  delete process.env.LOG_LEVEL
})

describe('createLogger', () => {
  it('conforms to the frozen @hoe/backend-kit Logger interface', () => {
    const logger: Logger = createLogger()
    expect(logger).toBeDefined()
  })

  it('emits one valid JSON line with level, msg and ISO time', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write })

    logger.info('hello')

    expect(lines).toHaveLength(1)
    const [line] = parsed(lines)
    expect(line?.level).toBe('info')
    expect(line?.msg).toBe('hello')
    expect(typeof line?.time).toBe('string')
    expect(new Date(line?.time as string).toISOString()).toBe(line?.time)
  })

  it('merges per-call fields into the line', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write })

    logger.warn('slow query', { durationMs: 132, table: 'users' })

    const [line] = parsed(lines)
    expect(line?.durationMs).toBe(132)
    expect(line?.table).toBe('users')
  })

  it('filters lines below the minimum level', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'warn', write })

    logger.debug('drop me')
    logger.info('drop me too')
    logger.warn('keep me')
    logger.error('keep me too')

    expect(parsed(lines).map((l) => l.level)).toEqual(['warn', 'error'])
  })

  it('reads the default level from LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'error'
    const { lines, write } = capture()
    const logger = createLogger({ write })

    logger.warn('dropped')
    logger.error('kept')

    expect(parsed(lines).map((l) => l.level)).toEqual(['error'])
  })

  it('falls back to info when LOG_LEVEL is invalid', () => {
    process.env.LOG_LEVEL = 'verbose'
    const { lines, write } = capture()
    const logger = createLogger({ write })

    logger.debug('dropped')
    logger.info('kept')

    expect(parsed(lines).map((l) => l.level)).toEqual(['info'])
  })
})

describe('child bindings', () => {
  it('merges bindings into every line, composing child-of-child', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write })
    const requestScoped = logger.child({ requestId: 'r-1' })
    const userScoped = requestScoped.child({ userId: 'u-1' })

    userScoped.info('did thing', { step: 2 })

    const [line] = parsed(lines)
    expect(line?.requestId).toBe('r-1')
    expect(line?.userId).toBe('u-1')
    expect(line?.step).toBe(2)
  })

  it('lets per-call fields override bindings, and reserved keys win over both', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write }).child({ source: 'binding' })

    logger.info('msg', { source: 'call', level: 'spoofed', msg: 'spoofed', time: 'spoofed' })

    const [line] = parsed(lines)
    expect(line?.source).toBe('call')
    expect(line?.level).toBe('info')
    expect(line?.msg).toBe('msg')
    expect(line?.time).not.toBe('spoofed')
  })
})

describe('redaction', () => {
  it('redacts sensitive top-level keys, case-insensitively', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write })

    logger.info('login', { password: 'hunter2', AUTHORIZATION: 'Bearer x', user: 'ed' })

    const [line] = parsed(lines)
    expect(line?.password).toBe('[REDACTED]')
    expect(line?.AUTHORIZATION).toBe('[REDACTED]')
    expect(line?.user).toBe('ed')
  })

  it('redacts keys that merely contain a sensitive word', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write })

    logger.info('oauth', { accessToken: 'abc', clientSecret: 'def', setCookie: 'ghi' })

    const [line] = parsed(lines)
    expect(line?.accessToken).toBe('[REDACTED]')
    expect(line?.clientSecret).toBe('[REDACTED]')
    expect(line?.setCookie).toBe('[REDACTED]')
  })

  it('redacts nested objects, arrays and bindings', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write }).child({ token: 'bound-secret' })

    logger.info('req', {
      headers: { cookie: 'session=1', accept: 'application/json' },
      users: [{ password: 'p1', name: 'a' }],
    })

    const [line] = parsed(lines)
    expect(line?.token).toBe('[REDACTED]')
    expect((line?.headers as Record<string, unknown>).cookie).toBe('[REDACTED]')
    expect((line?.headers as Record<string, unknown>).accept).toBe('application/json')
    const [user] = line?.users as Record<string, unknown>[]
    expect(user?.password).toBe('[REDACTED]')
    expect(user?.name).toBe('a')
  })

  it('survives circular field objects', () => {
    const { lines, write } = capture()
    const logger = createLogger({ level: 'debug', write })
    const loop: Record<string, unknown> = { name: 'a' }
    loop.self = loop

    logger.info('circular', { loop })

    const [line] = parsed(lines)
    expect((line?.loop as Record<string, unknown>).name).toBe('a')
    expect((line?.loop as Record<string, unknown>).self).toBe('[Circular]')
  })
})

describe('requestLogger', () => {
  it('binds the x-request-id header when present', () => {
    const { lines, write } = capture()
    const base = createLogger({ level: 'debug', write })
    const req = new Request('http://localhost/api', {
      headers: { 'x-request-id': 'req-42' },
    })

    requestLogger(base, req).info('handled')

    const [line] = parsed(lines)
    expect(line?.requestId).toBe('req-42')
  })

  it('generates a request id when none is supplied', () => {
    const { lines, write } = capture()
    const base = createLogger({ level: 'debug', write })

    requestLogger(base).info('handled')

    const [line] = parsed(lines)
    expect(typeof line?.requestId).toBe('string')
    expect((line?.requestId as string).length).toBeGreaterThan(0)
  })
})
