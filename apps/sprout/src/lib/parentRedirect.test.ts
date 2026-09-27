import { describe, expect, it } from 'vitest'

import { safeParentRedirect } from './parentRedirect.ts'

describe('safeParentRedirect', () => {
  it('keeps an internal /parent/ path with its search', () => {
    expect(safeParentRedirect('/parent/children/abc?reset=1')).toBe('/parent/children/abc?reset=1')
  })

  it('rejects an absolute external URL', () => {
    expect(safeParentRedirect('https://evil.example/parent/children')).toBeUndefined()
  })

  it('rejects a protocol-relative //host URL', () => {
    expect(safeParentRedirect('//evil.example/parent/children')).toBeUndefined()
  })

  it('rejects a backslash host trick', () => {
    expect(safeParentRedirect('/\\evil.example/parent/children')).toBeUndefined()
  })

  it('rejects an internal path outside /parent/', () => {
    expect(safeParentRedirect('/child/home')).toBeUndefined()
  })

  it('rejects a /parent/ path that traverses out of /parent/', () => {
    expect(safeParentRedirect('/parent/../child/home')).toBeUndefined()
  })

  it('rejects the login page itself', () => {
    expect(safeParentRedirect('/parent/login?redirect=/parent/children')).toBeUndefined()
  })

  it('rejects a non-string', () => {
    expect(safeParentRedirect(42)).toBeUndefined()
    expect(safeParentRedirect(undefined)).toBeUndefined()
  })
})
