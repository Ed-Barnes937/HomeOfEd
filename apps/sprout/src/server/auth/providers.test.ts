import { describe, expect, it } from 'vitest'

import { mintChildToken } from './childToken.ts'
import {
  CHILD_SESSION_COOKIE,
  childAuthProvider,
  fixedAuthProvider,
  readChildToken,
  resolveParentUser,
  type SessionResolver,
} from './providers.ts'

const SECRET = 'test-child-secret'

const reqWithCookie = (cookie: string): Request =>
  new Request('http://localhost/api/trpc/x', { headers: { cookie } })

describe('readChildToken', () => {
  it('extracts the child-session cookie among others', () => {
    const req = reqWithCookie(`other=1; ${CHILD_SESSION_COOKIE}=abc.def; another=2`)
    expect(readChildToken(req)).toBe('abc.def')
  })

  it('returns null when the cookie is absent', () => {
    expect(readChildToken(reqWithCookie('other=1'))).toBeNull()
    expect(readChildToken(new Request('http://localhost/'))).toBeNull()
  })
})

describe('childAuthProvider', () => {
  it('resolves a valid signed token to a child user with parentId', () => {
    const now = () => new Date('2026-01-01T00:00:00Z')
    const token = mintChildToken({ childId: 'kid-1', parentId: 'parent-1' }, SECRET, { now })
    const provider = childAuthProvider(SECRET, now)(
      reqWithCookie(`${CHILD_SESSION_COOKIE}=${token}`),
    )
    expect(provider.getUser()).toEqual({ id: 'kid-1', role: 'child', parentId: 'parent-1' })
  })

  it('resolves to null when there is no token', () => {
    const provider = childAuthProvider(SECRET)(new Request('http://localhost/'))
    expect(provider.getUser()).toBeNull()
  })

  it('resolves to null for a tampered / wrong-secret token', () => {
    const token = mintChildToken({ childId: 'kid-1', parentId: 'parent-1' }, 'other-secret')
    const provider = childAuthProvider(SECRET)(reqWithCookie(`${CHILD_SESSION_COOKIE}=${token}`))
    expect(provider.getUser()).toBeNull()
  })
})

describe('resolveParentUser', () => {
  it('maps a Better Auth session to a parent user', async () => {
    const auth: SessionResolver = {
      api: { getSession: () => Promise.resolve({ user: { id: 'parent-9' } }) },
    }
    const user = await resolveParentUser(auth, new Request('http://localhost/'))
    expect(user).toEqual({ id: 'parent-9', role: 'parent' })
  })

  it('returns null when there is no session', async () => {
    const auth: SessionResolver = { api: { getSession: () => Promise.resolve(null) } }
    expect(await resolveParentUser(auth, new Request('http://localhost/'))).toBeNull()
  })
})

describe('fixedAuthProvider', () => {
  it('wraps a resolved user (used for the parent provider after async resolve)', () => {
    expect(fixedAuthProvider({ id: 'p', role: 'parent' }).getUser()).toEqual({
      id: 'p',
      role: 'parent',
    })
    expect(fixedAuthProvider(null).getUser()).toBeNull()
  })
})
