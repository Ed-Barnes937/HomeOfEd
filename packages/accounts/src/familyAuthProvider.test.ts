import { describe, expect, it } from 'vitest'

import { FAMILY_SESSION_COOKIE } from './claims.ts'
import { familyAuthProvider } from './familyAuthProvider.ts'
import { mintTestToken } from './testing/mintTestToken.ts'
import { TEST_FAMILY_PUBLIC_KEY } from './testing/testKeys.ts'

const now = () => new Date('2026-01-01T00:00:00Z')

const requestWithCookie = (cookie?: string) =>
  new Request('https://boop.homeofed.com/api/trpc/x', {
    headers: cookie === undefined ? {} : { cookie },
  })

describe('familyAuthProvider', () => {
  const auth = familyAuthProvider(TEST_FAMILY_PUBLIC_KEY, now)

  it('maps a valid parent token to a FamilyUser', () => {
    const token = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, { now })
    const user = auth(requestWithCookie(`${FAMILY_SESSION_COOKIE}=${token}`)).getUser()
    expect(user).toEqual({ id: 'parent-1', role: 'parent', name: 'Ed' })
  })

  it('maps a valid child token including the owning parent', () => {
    const token = mintTestToken(
      { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
      { now },
    )
    const user = auth(
      requestWithCookie(`theme=dark; ${FAMILY_SESSION_COOKIE}=${token}; other=1`),
    ).getUser()
    expect(user).toEqual({ id: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
  })

  it('resolves to no user when the cookie is absent', () => {
    expect(auth(requestWithCookie()).getUser()).toBeNull()
    expect(auth(requestWithCookie('theme=dark')).getUser()).toBeNull()
  })

  it('resolves to no user for a tampered or expired token, never throwing', () => {
    const token = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, { now })
    const tampered = `x${token}`
    expect(auth(requestWithCookie(`${FAMILY_SESSION_COOKIE}=${tampered}`)).getUser()).toBeNull()

    const expired = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, {
      now: () => new Date('2020-01-01T00:00:00Z'),
      ttlMs: 1000,
    })
    expect(auth(requestWithCookie(`${FAMILY_SESSION_COOKIE}=${expired}`)).getUser()).toBeNull()
  })
})
