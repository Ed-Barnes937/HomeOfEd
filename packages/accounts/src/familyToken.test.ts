import { generateKeyPairSync, sign } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { mintFamilyToken, verifyFamilyToken } from './familyToken.ts'
import { TEST_FAMILY_PRIVATE_KEY, TEST_FAMILY_PUBLIC_KEY } from './testing/testKeys.ts'

const now = () => new Date('2026-01-01T00:00:00Z')

const mintParent = (opts: { now?: () => Date; ttlMs?: number } = {}) =>
  mintFamilyToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, TEST_FAMILY_PRIVATE_KEY, {
    now,
    ...opts,
  })

/** Properly signed token over arbitrary claims - for shape-rejection tests only. */
function signTestClaims(claims: unknown): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const sig = sign(null, Buffer.from(payload, 'utf8'), TEST_FAMILY_PRIVATE_KEY).toString(
    'base64url',
  )
  return `${payload}.${sig}`
}

describe('family session token', () => {
  it('round-trips parent claims', () => {
    const claims = verifyFamilyToken(mintParent(), TEST_FAMILY_PUBLIC_KEY, now)
    expect(claims).toEqual({
      sub: 'parent-1',
      role: 'parent',
      name: 'Ed',
      iat: now().getTime(),
      exp: now().getTime() + 30 * 24 * 60 * 60 * 1000,
    })
  })

  it('round-trips child claims with the owning parent', () => {
    const token = mintFamilyToken(
      { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
      TEST_FAMILY_PRIVATE_KEY,
      { now },
    )
    const claims = verifyFamilyToken(token, TEST_FAMILY_PUBLIC_KEY, now)
    expect(claims?.sub).toBe('child-1')
    expect(claims?.role).toBe('child')
    expect(claims?.parentId).toBe('parent-1')
    expect(claims?.name).toBe('Robin')
  })

  it('rejects a token whose payload was tampered with', () => {
    const [, signature] = mintParent().split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'attacker',
        role: 'parent',
        name: 'Ed',
        iat: now().getTime(),
        exp: 9e15,
      }),
      'utf8',
    ).toString('base64url')
    expect(
      verifyFamilyToken(`${forgedPayload}.${signature ?? ''}`, TEST_FAMILY_PUBLIC_KEY, now),
    ).toBeNull()
  })

  it('rejects a token signed with a different private key', () => {
    const other = generateKeyPairSync('ed25519')
    const otherPem = other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const token = mintFamilyToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, otherPem, {
      now,
    })
    expect(verifyFamilyToken(token, TEST_FAMILY_PUBLIC_KEY, now)).toBeNull()
  })

  it('rejects an expired token but accepts one inside the window', () => {
    const token = mintParent({ ttlMs: 1000 })
    const later = () => new Date(now().getTime() + 2000)
    const within = () => new Date(now().getTime() + 500)
    expect(verifyFamilyToken(token, TEST_FAMILY_PUBLIC_KEY, later)).toBeNull()
    expect(verifyFamilyToken(token, TEST_FAMILY_PUBLIC_KEY, within)).not.toBeNull()
  })

  it('rejects malformed tokens without throwing', () => {
    for (const bad of ['', 'not-a-token', 'a.b.c', '.sig', 'payload.', '!!.!!', 'aGk=.aGk=']) {
      expect(verifyFamilyToken(bad, TEST_FAMILY_PUBLIC_KEY, now)).toBeNull()
    }
  })

  it('rejects correctly signed tokens with the wrong claim shape', () => {
    const base = { iat: now().getTime(), exp: now().getTime() + 1000 }
    const wrongShapes: unknown[] = [
      { ...base, sub: 'x', role: 'admin', name: 'Ed' }, // unknown role
      { ...base, sub: 'x', role: 'child', name: 'Robin' }, // child missing parentId
      { ...base, sub: 'x', role: 'parent', parentId: 'p', name: 'Ed' }, // parent with parentId
      { ...base, sub: 'x', role: 'parent' }, // missing name
      { ...base, role: 'parent', name: 'Ed' }, // missing sub
      { sub: 'x', role: 'parent', name: 'Ed' }, // missing iat/exp
      'just-a-string',
      null,
      42,
    ]
    for (const claims of wrongShapes) {
      expect(verifyFamilyToken(signTestClaims(claims), TEST_FAMILY_PUBLIC_KEY, now)).toBeNull()
    }
  })

  it('mint refuses a child without a parentId and an empty key', () => {
    expect(() =>
      mintFamilyToken({ sub: 'c', role: 'child', name: 'R' }, TEST_FAMILY_PRIVATE_KEY),
    ).toThrow()
    expect(() => mintFamilyToken({ sub: 'p', role: 'parent', name: 'Ed' }, '')).toThrow()
  })
})
