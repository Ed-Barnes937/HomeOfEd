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

  // Ticket 13 / ADR 0032: the share codec inherits the save format's decoder,
  // so a whole song travels in a link with no SHARE_FORMAT_VERSION bump.
  it('round-trips a whole song — clips, names, tints, placements, gridClip', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: [
        { ...boop.patterns[0]!, name: 'Drums', tint: 4 },
        { ...boop.patterns[0]!, name: 'More drums', tint: 0 },
      ],
      placements: '1112..2211......',
      gridClip: 1,
    }
    expect(decodeShare(encodeShare(song))).toEqual(song)
  })

  // Ticket 03 / ADR 0042: a clip owns its rows, so two clips of one song may
  // hold different instruments in different orders. The link carries that with
  // no SHARE_FORMAT_VERSION bump, because it is still just `StoredPattern.rows`.
  it('round-trips a mixed-row song - different instruments, different orders', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: [
        {
          rows: [
            { instrumentId: 'cowbell', steps: '0010001000100010' },
            { instrumentId: 'kick', steps: '1000000010000000' },
          ],
          name: 'Cowbell',
          tint: 0,
        },
        {
          rows: [{ instrumentId: 'bell', steps: '0000000000000000' }],
          name: 'Bell, unpainted',
          tint: 1,
        },
      ],
      placements: '12..............',
      gridClip: 1,
    }

    expect(decodeShare(encodeShare(song))).toEqual(song)
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

  it('returns null for a song whose placements point past its clips', () => {
    const bad = Buffer.from(
      JSON.stringify({
        version: SHARE_FORMAT_VERSION,
        creation: { ...boop, placements: '2...............' },
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
    const preRenameToken = Buffer.from(
      JSON.stringify({ version: SHARE_FORMAT_VERSION, creation: boop }),
    ).toString('base64url')
    const hash = `${SHARE_HASH_PREFIX}${preRenameToken}`

    expect(decodeShareHash(hash)).toEqual(boop)
  })
})

// Ticket 13 / ADR 0032: old links must open as a one-clip song with an empty
// song bar — the decoder adds nothing the child didn't make.
describe('pre-song compatibility (ticket 13)', () => {
  it('decodes an old link as a one-clip song with no song fields added', () => {
    const oldToken = Buffer.from(
      JSON.stringify({ version: SHARE_FORMAT_VERSION, creation: boop }),
    ).toString('base64url')

    const decoded = decodeShare(oldToken)!

    expect(decoded.patterns).toHaveLength(1)
    expect('placements' in decoded).toBe(false)
    expect('gridClip' in decoded).toBe(false)
    expect('name' in decoded.patterns[0]!).toBe(false)
    expect('tint' in decoded.patterns[0]!).toBe(false)
  })
})

// Ticket 03 / ADR 0042: making the stored rows authoritative changes what a
// pattern means, so pin a token that was actually in the world before it - the
// launch six in kit order, written by hand rather than by today's encoder.
describe('pre-dynamic-rows compatibility (ticket 03)', () => {
  const preDynamicRowsToken =
    'eyJ2ZXJzaW9uIjoxLCJjcmVhdGlvbiI6eyJuYW1lIjoiT2xkIHNpeCIsImtpdElkIjoibGF1bmNoIiwidGVtcG8iOjExMCwi' +
    'cGF0dGVybnMiOlt7InJvd3MiOlt7Imluc3RydW1lbnRJZCI6ImtpY2siLCJzdGVwcyI6IjEwMDAxMDAwMTAwMDEwMDAifSx7' +
    'Imluc3RydW1lbnRJZCI6InNuYXJlIiwic3RlcHMiOiIxMDAwMTAwMDEwMDAxMDAwIn0seyJpbnN0cnVtZW50SWQiOiJoYXQi' +
    'LCJzdGVwcyI6IjEwMDAxMDAwMTAwMDEwMDAifSx7Imluc3RydW1lbnRJZCI6InRvbSIsInN0ZXBzIjoiMTAwMDEwMDAxMDAw' +
    'MTAwMCJ9LHsiaW5zdHJ1bWVudElkIjoibWFyaW1iYSIsInN0ZXBzIjoiMTAwMDEwMDAxMDAwMTAwMCJ9LHsiaW5zdHJ1bWVu' +
    'dElkIjoiYm9vcCIsInN0ZXBzIjoiMTAwMDEwMDAxMDAwMTAwMCJ9XX1dfX0'

  it('still opens an old #g= link, its six rows in the order they were sent', () => {
    const decoded = decodeShareHash(`${SHARE_HASH_PREFIX}${preDynamicRowsToken}`)!

    expect(decoded.name).toBe('Old six')
    expect(decoded.tempo).toBe(110)
    expect(decoded.patterns).toHaveLength(1)
    expect(decoded.patterns[0]!.rows.map((r) => r.instrumentId)).toEqual([
      'kick',
      'snare',
      'hat',
      'tom',
      'marimba',
      'boop',
    ])
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
