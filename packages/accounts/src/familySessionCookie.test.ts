import { describe, expect, it } from 'vitest'

import { FAMILY_SESSION_COOKIE, DEFAULT_FAMILY_TOKEN_TTL_MS } from './claims.ts'
import {
  clearFamilySession,
  familySessionCookieString,
  writeFamilySession,
} from './familySessionCookie.ts'
import { readFamilySession } from './readFamilySession.ts'

const NOW = new Date('2026-11-09T12:00:00.000Z')
const now = () => NOW

function token(claims: Record<string, unknown>): string {
  const json = JSON.stringify(claims)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${payload}.signature`
}

const childToken = token({
  sub: '11111111-2222-4333-8444-555555555555',
  role: 'child',
  parentId: 'p1',
  name: 'Robin',
  iat: NOW.getTime(),
  exp: NOW.getTime() + DEFAULT_FAMILY_TOKEN_TTL_MS,
})

describe('familySessionCookieString', () => {
  it('carries the production attributes the spec fixes', () => {
    const cookie = familySessionCookieString(childToken, {
      domain: '.homeofed.com',
      secure: true,
      now,
    })

    expect(cookie).not.toBeNull()
    const parts = cookie!.split('; ')
    expect(parts[0]).toBe(`${FAMILY_SESSION_COOKIE}=${childToken}`)
    expect(parts).toContain('Path=/')
    expect(parts).toContain('Domain=.homeofed.com')
    expect(parts).toContain('Secure')
    expect(parts).toContain('SameSite=Lax')
    // Deliberately not httpOnly: hub sets it client-side (ADR 0078).
    expect(cookie!.toLowerCase()).not.toContain('httponly')
  })

  it('takes its lifetime from the token rather than a second constant', () => {
    const cookie = familySessionCookieString(childToken, { now })
    expect(cookie).toContain(`Max-Age=${DEFAULT_FAMILY_TOKEN_TTL_MS / 1000}`)
  })

  it('omits Domain and Secure where they were not asked for (a local hostname)', () => {
    const cookie = familySessionCookieString(childToken, { now })
    expect(cookie).not.toContain('Domain=')
    expect(cookie).not.toContain('Secure')
  })

  it('refuses a token it cannot decode, rather than storing a cookie nothing can read', () => {
    expect(familySessionCookieString('not-a-token', { now })).toBeNull()
    expect(familySessionCookieString('', { now })).toBeNull()
  })

  it('refuses an already-expired token', () => {
    const stale = token({
      sub: 'c1',
      role: 'child',
      parentId: 'p1',
      name: 'Robin',
      iat: NOW.getTime() - 2000,
      exp: NOW.getTime() - 1000,
    })
    expect(familySessionCookieString(stale, { now })).toBeNull()
  })
})

describe('writeFamilySession / clearFamilySession', () => {
  // A jar that behaves like `document.cookie`: assignment appends one cookie,
  // reading returns the `name=value` pairs.
  function fakeJar() {
    const values = new Map<string, string>()
    return {
      get cookie(): string {
        return [...values].map(([k, v]) => `${k}=${v}`).join('; ')
      },
      set cookie(next: string) {
        const [pair = '', ...attrs] = next.split('; ')
        const eq = pair.indexOf('=')
        const name = pair.slice(0, eq)
        if (attrs.includes('Max-Age=0')) values.delete(name)
        else values.set(name, pair.slice(eq + 1))
      },
    }
  }

  it('writes a cookie readFamilySession reads back, and returns the claims', () => {
    const jar = fakeJar()

    const claims = writeFamilySession(childToken, { jar, now })

    expect(claims?.name).toBe('Robin')
    expect(claims?.role).toBe('child')
    expect(readFamilySession({ cookie: jar.cookie, now })).toEqual(claims)
  })

  it('writes nothing and returns null for a token it cannot decode', () => {
    const jar = fakeJar()
    expect(writeFamilySession('rubbish', { jar, now })).toBeNull()
    expect(jar.cookie).toBe('')
  })

  it('clearing leaves no session behind', () => {
    const jar = fakeJar()
    writeFamilySession(childToken, { jar, now })

    clearFamilySession({ jar, domain: '.homeofed.com', secure: true })

    expect(readFamilySession({ cookie: jar.cookie, now })).toBeNull()
  })
})
