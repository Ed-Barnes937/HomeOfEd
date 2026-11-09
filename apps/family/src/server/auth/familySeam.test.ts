import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import {
  mintTestToken,
  TEST_FAMILY_PRIVATE_KEY,
  TEST_FAMILY_PUBLIC_KEY,
} from '@hoe/accounts/testing'
import { describe, expect, it } from 'vitest'

import { familySeam, publicKeyFromPrivateKey } from './familySeam.ts'
import { isParentSession } from './parentSession.ts'

const now = (): Date => new Date('2026-01-01T00:00:00Z')

const seam = familySeam(TEST_FAMILY_PUBLIC_KEY, now)

const childToken = mintTestToken(
  { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
  { now },
)
const parentToken = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ada' }, { now })

function request(headers: Record<string, string>): Request {
  return new Request('https://family.homeofed.com/api/trpc/save.get', { headers })
}

const cookie = (token: string): Record<string, string> => ({
  cookie: `theme=dark; ${FAMILY_SESSION_COOKIE}=${token}`,
})

// What registerParentSessionBridge stamps once Better Auth has resolved.
const stampedSession = { 'x-family-parent': 'parent-7' }

describe('the family auth seam', () => {
  it('resolves nobody when neither credential is present', () => {
    expect(seam(request({})).getUser()).toBeNull()
  })

  it('resolves a cookie session as a parent session with no save account', () => {
    const user = seam(request(stampedSession)).getUser()

    expect(user).toEqual({ id: 'parent-7', kind: 'parent-session' })
    expect(user === null ? false : isParentSession(user)).toBe(true)
  })

  it('resolves a family token as a save account that is not a parent session', () => {
    const user = seam(request(cookie(childToken))).getUser()

    expect(user).toEqual({
      id: 'child-1',
      saveAccount: { accountId: 'child-1', role: 'child', parentId: 'parent-1' },
    })
    expect(user === null ? true : isParentSession(user)).toBe(false)
  })

  it('carries no parentId for a parent token, which owns itself', () => {
    expect(seam(request(cookie(parentToken))).getUser()).toEqual({
      id: 'parent-1',
      saveAccount: { accountId: 'parent-1', role: 'parent' },
    })
  })

  // The ordinary case once a parent has picked who is playing: the cookie says
  // parent-7 and the token says child-1, and neither may stand in for the other.
  it('keeps both credentials apart when they name different people', () => {
    const user = seam(request({ ...stampedSession, ...cookie(childToken) })).getUser()

    expect(user).toEqual({
      id: 'parent-7',
      kind: 'parent-session',
      saveAccount: { accountId: 'child-1', role: 'child', parentId: 'parent-1' },
    })
  })

  it('drops a tampered token while keeping the cookie session', () => {
    const user = seam(request({ ...stampedSession, ...cookie(`x${childToken}`) })).getUser()

    expect(user).toEqual({ id: 'parent-7', kind: 'parent-session' })
  })

  it('drops an expired token, leaving nobody at all', () => {
    const expired = mintTestToken(
      { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
      { now: () => new Date('2020-01-01T00:00:00Z'), ttlMs: 1000 },
    )

    expect(seam(request(cookie(expired))).getUser()).toBeNull()
  })
})

describe('publicKeyFromPrivateKey', () => {
  it("derives the verifying half of this service's own signing key", () => {
    const derived = publicKeyFromPrivateKey(TEST_FAMILY_PRIVATE_KEY)

    expect(derived.trim()).toBe(TEST_FAMILY_PUBLIC_KEY.trim())
  })
})
