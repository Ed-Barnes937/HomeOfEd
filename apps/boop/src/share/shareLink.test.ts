import { describe, expect, it } from 'vitest'

import type { StoredBoop } from '../persistence/saveFormat.ts'
import {
  buildShareUrl,
  clearShareHash,
  decodeShare,
  decodeShareHash,
  encodeShare,
  SHARE_FORMAT_VERSION,
  SHARE_HASH_PREFIX,
} from './shareLink.ts'

const boop: StoredBoop = {
  name: 'Boom bap',
  kitId: 'launch',
  tempo: 110,
  patterns: [
    {
      rows: [
        { instrumentId: 'kick', steps: '1000100010001000' },
        { instrumentId: 'snare', steps: '0000100000001000' },
      ],
    },
  ],
}

describe('encodeShare / decodeShare', () => {
  it('round-trips a creation', () => {
    expect(decodeShare(encodeShare(boop))).toEqual(boop)
  })

  it('round-trips a name with non-latin characters', () => {
    const named = { ...boop, name: 'ドラム 🥁' }
    expect(decodeShare(encodeShare(named))).toEqual(named)
  })

  it('produces a URL-safe token — no +, /, = or percent-escaping needed', () => {
    const token = encodeShare(boop)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(token)).toBe(token)
  })

  it('carries the share format version, so a future scheme can be told apart', () => {
    const token = encodeShare(boop)
    const decoded = JSON.parse(
      Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { version: number }
    expect(decoded.version).toBe(SHARE_FORMAT_VERSION)
  })
})

describe('decodeShare is total', () => {
  it.each([
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['not base64url', 'not base64!!'],
    ['base64 of nonsense', Buffer.from('hello there').toString('base64url')],
    ['base64 of a JSON array', Buffer.from('[1,2,3]').toString('base64url')],
    ['truncated token', encodeShare(boop).slice(0, 20)],
  ])('returns null for %s', (_label, token) => {
    expect(decodeShare(token)).toBeNull()
  })

  it('returns null for a future version', () => {
    const future = Buffer.from(
      JSON.stringify({ version: SHARE_FORMAT_VERSION + 1, creation: boop }),
    ).toString('base64url')
    expect(decodeShare(future)).toBeNull()
  })

  it('returns null for a payload whose creation is malformed', () => {
    const bad = Buffer.from(
      JSON.stringify({
        version: SHARE_FORMAT_VERSION,
        creation: { ...boop, patterns: [{ rows: [{ instrumentId: 'kick', steps: '10' }] }] },
      }),
    ).toString('base64url')
    expect(decodeShare(bad)).toBeNull()
  })

  it('returns null for a tempo outside the engine range', () => {
    const bad = Buffer.from(
      JSON.stringify({ version: SHARE_FORMAT_VERSION, creation: { ...boop, tempo: 9_000 } }),
    ).toString('base64url')
    expect(decodeShare(bad)).toBeNull()
  })

  it('never throws, whatever it is handed', () => {
    for (const token of ['%%%', ' ', 'A', 'AAAA', '~'.repeat(500)]) {
      expect(() => decodeShare(token)).not.toThrow()
    }
  })
})

describe('buildShareUrl', () => {
  it('puts the whole creation in the fragment of the current page URL', () => {
    const url = buildShareUrl({ origin: 'https://boop.homeofed.com', pathname: '/' }, boop)
    expect(url.startsWith(`https://boop.homeofed.com/${SHARE_HASH_PREFIX}`)).toBe(true)
    expect(decodeShareHash(new URL(url).hash)).toEqual(boop)
  })

  it('keeps the path so a shared link opens the same route', () => {
    const url = buildShareUrl({ origin: 'https://boop.homeofed.com', pathname: '/room' }, boop)
    expect(new URL(url).pathname).toBe('/room')
  })
})

describe('decodeShareHash', () => {
  it('reads a boop out of a location hash', () => {
    const hash = `${SHARE_HASH_PREFIX}${encodeShare(boop)}`
    expect(decodeShareHash(hash)).toEqual(boop)
  })

  it.each([
    ['no hash', ''],
    ['bare hash', '#'],
    ['a different fragment', '#about'],
    ['our key with junk', `${SHARE_HASH_PREFIX}!!!!`],
  ])('returns null for %s', (_label, hash) => {
    expect(decodeShareHash(hash)).toBeNull()
  })
})

// Ticket 35: the "groove" → "boop" rename touches types and identifiers only.
// The `#g=` prefix and the payload's `{ version, creation }` shape are frozen
// (ADR 0026) — a link built before the rename must still load afterwards.
describe('pre-rename compatibility (ticket 35)', () => {
  it('loads a share link built before the rename', () => {
    const preRenameToken = Buffer.from(JSON.stringify({ version: SHARE_FORMAT_VERSION, creation: boop })).toString(
      'base64url',
    )
    const hash = `${SHARE_HASH_PREFIX}${preRenameToken}`

    expect(decodeShareHash(hash)).toEqual(boop)
  })
})

describe('clearShareHash', () => {
  it('replaces the entry with the same page, minus the fragment', () => {
    const calls: string[] = []
    clearShareHash(
      { pathname: '/', search: '?a=1' },
      { replaceState: (_s, _t, url) => calls.push(String(url)) },
    )
    expect(calls).toEqual(['/?a=1'])
  })
})
