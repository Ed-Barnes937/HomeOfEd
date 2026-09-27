import { describe, expect, it } from 'vitest'

import { FAMILY_SESSION_COOKIE } from './claims.ts'
import { readFamilySession } from './readFamilySession.ts'
import { mintTestToken } from './testing/mintTestToken.ts'

const now = () => new Date('2026-01-01T00:00:00Z')

describe('readFamilySession (decode-only, display use)', () => {
  it('reads claims from a cookie string without verifying', () => {
    const token = mintTestToken(
      { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
      { now },
    )
    const claims = readFamilySession({
      cookie: `theme=dark; ${FAMILY_SESSION_COOKIE}=${token}`,
      now,
    })
    expect(claims?.sub).toBe('child-1')
    expect(claims?.name).toBe('Robin')
  })

  it('does not check the signature - display only, tampering forges pixels not authz', () => {
    const token = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, { now })
    const [payload] = token.split('.')
    const badSig = `${payload ?? ''}.AAAA`
    const claims = readFamilySession({ cookie: `${FAMILY_SESSION_COOKIE}=${badSig}`, now })
    expect(claims?.sub).toBe('parent-1')
  })

  it('returns null when the cookie is absent, malformed, or expired', () => {
    expect(readFamilySession({ cookie: '', now })).toBeNull()
    expect(readFamilySession({ cookie: 'theme=dark', now })).toBeNull()
    expect(readFamilySession({ cookie: `${FAMILY_SESSION_COOKIE}=garbage`, now })).toBeNull()

    const expired = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, {
      now: () => new Date('2020-01-01T00:00:00Z'),
      ttlMs: 1000,
    })
    expect(readFamilySession({ cookie: `${FAMILY_SESSION_COOKIE}=${expired}`, now })).toBeNull()
  })

  it('returns null (not a throw) when there is no document and no cookie given', () => {
    // node test env has no `document`; the default cookie source must degrade.
    expect(readFamilySession({ now })).toBeNull()
  })
})
