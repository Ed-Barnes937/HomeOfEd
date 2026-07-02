import { describe, expect, it } from 'vitest'

import { loadDbEnv } from './env.ts'

describe('loadDbEnv', () => {
  it('parses a valid DATABASE_URL', () => {
    const env = loadDbEnv({ DATABASE_URL: 'postgres://app:secret@db.internal:5432/hub' })
    expect(env).toEqual({ DATABASE_URL: 'postgres://app:secret@db.internal:5432/hub' })
  })

  it('ignores unrelated variables', () => {
    const env = loadDbEnv({
      DATABASE_URL: 'postgres://app:secret@db.internal:5432/hub',
      PATH: '/usr/bin',
    })
    expect(env).toEqual({ DATABASE_URL: 'postgres://app:secret@db.internal:5432/hub' })
  })

  it('throws a readable error when DATABASE_URL is missing', () => {
    expect(() => loadDbEnv({})).toThrow(/DATABASE_URL/)
  })

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() => loadDbEnv({ DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/)
    expect(() => loadDbEnv({ DATABASE_URL: 'https://example.com' })).toThrow(/DATABASE_URL/)
  })
})
