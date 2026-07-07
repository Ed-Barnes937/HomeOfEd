import { describe, expect, it } from 'vitest'

import { mintChildToken, verifyChildToken } from './childToken.ts'

const SECRET = 'test-child-secret'

describe('child-session token', () => {
  it('round-trips a valid token back to its claims', () => {
    const now = () => new Date('2026-01-01T00:00:00Z')
    const token = mintChildToken({ childId: 'kid-1', parentId: 'parent-1' }, SECRET, { now })

    const claims = verifyChildToken(token, SECRET, now)
    expect(claims).not.toBeNull()
    expect(claims?.childId).toBe('kid-1')
    expect(claims?.parentId).toBe('parent-1')
    expect(claims?.exp).toBeGreaterThan(claims!.iat)
  })

  it('rejects a token whose payload was tampered with', () => {
    const token = mintChildToken({ childId: 'kid-1', parentId: 'parent-1' }, SECRET)
    const [, signature] = token.split('.')
    // Re-encode a forged payload (different childId) but keep the old signature.
    const forgedPayload = Buffer.from(
      JSON.stringify({ childId: 'kid-attacker', parentId: 'parent-1', iat: 0, exp: 9e15 }),
      'utf8',
    ).toString('base64url')
    const forged = `${forgedPayload}.${signature ?? ''}`

    expect(verifyChildToken(forged, SECRET)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = mintChildToken({ childId: 'kid-1', parentId: 'parent-1' }, SECRET)
    expect(verifyChildToken(token, 'wrong-secret')).toBeNull()
  })

  it('rejects an expired token', () => {
    const issued = () => new Date('2026-01-01T00:00:00Z')
    const token = mintChildToken({ childId: 'kid-1', parentId: 'parent-1' }, SECRET, {
      now: issued,
      ttlMs: 1000,
    })
    // 2 seconds later — past the 1s TTL.
    const later = () => new Date('2026-01-01T00:00:02Z')
    expect(verifyChildToken(token, SECRET, later)).toBeNull()
    // Still valid within the window.
    const within = () => new Date('2026-01-01T00:00:00.500Z')
    expect(verifyChildToken(token, SECRET, within)).not.toBeNull()
  })

  it('rejects malformed tokens without throwing', () => {
    expect(verifyChildToken('', SECRET)).toBeNull()
    expect(verifyChildToken('not-a-token', SECRET)).toBeNull()
    expect(verifyChildToken('a.b.c', SECRET)).toBeNull()
    expect(verifyChildToken('.sig', SECRET)).toBeNull()
  })
})
