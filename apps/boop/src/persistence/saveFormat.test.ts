import { describe, expect, it } from 'vitest'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'
import {
  EMPTY_DOCUMENT,
  SAVE_FORMAT_VERSION,
  parseSaveDocument,
  patternToStored,
  serializeSaveDocument,
  storedToPattern,
  type SaveDocument,
  type StoredBoop,
} from './saveFormat.ts'

const kit: Kit = {
  kitId: 'launch',
  name: 'Launch kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: 'k.svg', sound: 'k.wav' },
    { instrumentId: 'snare', name: 'Snare', artwork: 's.svg', sound: 's.wav' },
  ],
}

function row(instrumentId: string, ...onSteps: number[]) {
  const steps = new Array<boolean>(STEPS_PER_PATTERN).fill(false)
  for (const step of onSteps) steps[step] = true
  return { instrumentId, steps }
}

const pattern: Pattern = [row('kick', 0, 4), row('snare', 4)]

const boop: StoredBoop = {
  name: 'Boop 3',
  kitId: 'launch',
  tempo: 120,
  patterns: [patternToStored(pattern)],
}

/** Reading a document back is only meaningful through the string form. */
function reparse(document: SaveDocument): SaveDocument {
  return parseSaveDocument(serializeSaveDocument(document))
}

describe('patternToStored', () => {
  it('writes one 16-character bitstring per row, in pattern order', () => {
    expect(patternToStored(pattern)).toEqual({
      rows: [
        { instrumentId: 'kick', steps: '1000100000000000' },
        { instrumentId: 'snare', steps: '0000100000000000' },
      ],
    })
  })
})

describe('storedToPattern', () => {
  it('rebuilds a full pattern for the kit, in kit order', () => {
    expect(storedToPattern(kit, patternToStored(pattern))).toEqual(pattern)
  })

  it('leaves rows the stored pattern does not mention switched off', () => {
    const stored = { rows: [{ instrumentId: 'snare', steps: '1'.repeat(STEPS_PER_PATTERN) }] }
    const result = storedToPattern(kit, stored)

    expect(result.map((r) => r.instrumentId)).toEqual(['kick', 'snare'])
    expect(result[0]!.steps.every((on) => on === false)).toBe(true)
    expect(result[1]!.steps.every((on) => on === true)).toBe(true)
  })

  it('ignores instruments that are not in the kit', () => {
    const stored = { rows: [{ instrumentId: 'cowbell', steps: '1'.repeat(STEPS_PER_PATTERN) }] }

    expect(storedToPattern(kit, stored)).toEqual([row('kick'), row('snare')])
  })
})

describe('round-trip', () => {
  it('preserves a pattern name and tint (ADR 0032)', () => {
    const named = { ...patternToStored(pattern), name: 'Drums', tint: 3 }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: null,
      creations: [{ ...boop, patterns: [named] }],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  it('preserves placements and gridClip on working and saved rows alike (ADR 0032)', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: [patternToStored(pattern), patternToStored(pattern)],
      placements: '1112..2211......',
      gridClip: 1,
    }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...song, name: '' },
      creations: [song],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  it('preserves a layered placements string — several clips in one position', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: [patternToStored(pattern), patternToStored(pattern)],
      placements: '12,2,,,,,,,,,,,,,,1',
      gridClip: 0,
    }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...song, name: '' },
      creations: [song],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  it('preserves the working boop and the saved list', () => {
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...boop, name: '' },
      creations: [boop],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  it('decodes a V1 document with no song fields byte-identically (ADR 0032)', () => {
    // Exactly what a pre-song build wrote: no name/tint on the pattern, no
    // placements/gridClip on the boop. The decoder must add nothing.
    const v1Raw = JSON.stringify({
      version: 1,
      working: { name: '', kitId: 'launch', tempo: 120, patterns: [patternToStored(pattern)] },
      creations: [
        { name: 'Boop 1', kitId: 'launch', tempo: 90, patterns: [patternToStored(pattern)] },
      ],
    })

    const decoded = parseSaveDocument(v1Raw)

    // The real guarantee: no song fields materialise on old data…
    expect('placements' in decoded.working!).toBe(false)
    expect('gridClip' in decoded.working!).toBe(false)
    expect('name' in decoded.working!.patterns[0]!).toBe(false)
    expect('tint' in decoded.working!.patterns[0]!).toBe(false)
    // …which for an app-written document (single writer, canonical key
    // order) makes the round-trip byte-identical.
    expect(serializeSaveDocument(decoded)).toBe(v1Raw)
  })

  it('survives a full trip back onto the grid', () => {
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...boop, name: '' },
      creations: [],
    }
    const restored = reparse(saveDocument).working!

    expect(restored.tempo).toBe(120)
    expect(storedToPattern(kit, restored.patterns[0]!)).toEqual(pattern)
  })
})

describe('parseSaveDocument (defensive decode)', () => {
  const empty = EMPTY_DOCUMENT

  it('degrades to an empty document when nothing is stored', () => {
    expect(parseSaveDocument(null)).toEqual(empty)
  })

  it('degrades to an empty document on unparseable JSON', () => {
    expect(parseSaveDocument('{not json')).toEqual(empty)
  })

  it('degrades to an empty document on a future version', () => {
    const raw = JSON.stringify({ version: SAVE_FORMAT_VERSION + 1, working: null, creations: [] })

    expect(parseSaveDocument(raw)).toEqual(empty)
  })

  it('degrades to an empty document on a missing version', () => {
    expect(parseSaveDocument(JSON.stringify({ working: null, creations: [] }))).toEqual(empty)
  })

  it.each([
    ['a non-object payload', JSON.stringify('nope')],
    ['a boop with no patterns', withWorking({ ...boop, patterns: [] })],
    [
      'a step string of the wrong length',
      withWorking({ ...boop, patterns: [{ rows: [{ instrumentId: 'kick', steps: '101' }] }] }),
    ],
    [
      'step characters that are not 0 or 1',
      withWorking({
        ...boop,
        patterns: [{ rows: [{ instrumentId: 'kick', steps: 'x'.repeat(STEPS_PER_PATTERN) }] }],
      }),
    ],
    ['a non-numeric tempo', withWorking({ ...boop, tempo: 'fast' })],
    ['a tempo outside the allowed range', withWorking({ ...boop, tempo: 5000 })],
    [
      'a missing name',
      withWorking({ kitId: 'launch', tempo: 120, patterns: [patternToStored(pattern)] }),
    ],
    [
      'more than 5 patterns',
      withWorking({ ...boop, patterns: new Array(6).fill(patternToStored(pattern)) }),
    ],
    ['a non-string pattern name', withWorking(withPattern({ name: 7 }))],
    ['a tint above the tint list', withWorking(withPattern({ tint: 5 }))],
    ['a negative tint', withWorking(withPattern({ tint: -1 }))],
    ['a fractional tint', withWorking(withPattern({ tint: 1.5 }))],
    [
      'a duplicate tint across two patterns',
      withWorking({
        ...boop,
        patterns: [
          { ...patternToStored(pattern), tint: 2 },
          { ...patternToStored(pattern), tint: 2 },
        ],
      }),
    ],
    [
      'a tint colliding with another pattern’s defaulted tint',
      withWorking({
        ...boop,
        patterns: [patternToStored(pattern), { ...patternToStored(pattern), tint: 0 }],
      }),
    ],
    [
      'a placement digit with no clip behind it',
      withWorking({ ...boop, placements: '2...............' }),
    ],
    ['a placements string of the wrong length', withWorking({ ...boop, placements: '1...' })],
    [
      'placement characters that are not . or 1-5',
      withWorking({ ...boop, placements: '0x..............' }),
    ],
    ['a non-string placements', withWorking({ ...boop, placements: 16 })],
    [
      'a layered placements string with the wrong number of positions',
      withWorking({ ...boop, placements: '1,1,,' }),
    ],
    [
      'a layered position naming the same clip twice',
      withWorking({ ...boop, placements: '11,,,,,,,,,,,,,,,' }),
    ],
    [
      'a layered position with a . in it — the two forms never mix',
      withWorking({ ...boop, placements: '1,.,,,,,,,,,,,,,,' }),
    ],
    ['a gridClip past the clip list', withWorking({ ...boop, gridClip: 1 })],
    ['a negative gridClip', withWorking({ ...boop, gridClip: -1 })],
    ['a fractional gridClip', withWorking({ ...boop, gridClip: 0.5 })],
  ])('degrades to an empty document on %s', (_label, raw) => {
    expect(parseSaveDocument(raw)).toEqual(empty)
  })

  it('discards the whole document when one saved boop breaks a song rule', () => {
    const raw = JSON.stringify({
      version: SAVE_FORMAT_VERSION,
      working: null,
      creations: [boop, { ...boop, gridClip: 1 }],
    })

    expect(parseSaveDocument(raw)).toEqual(empty)
  })

  it('never throws, whatever it is handed', () => {
    for (const raw of ['', '[]', 'null', '{"version":1}', '{"version":1,"creations":{}}']) {
      expect(() => parseSaveDocument(raw)).not.toThrow()
    }
  })
})

/** A serialized document whose `working` slot is the (possibly invalid) value under test. */
function withWorking(working: unknown): string {
  return JSON.stringify({ version: SAVE_FORMAT_VERSION, working, creations: [] })
}

/** The valid boop with its one pattern carrying the (possibly invalid) extra fields. */
function withPattern(extra: Record<string, unknown>): unknown {
  return { ...boop, patterns: [{ ...patternToStored(pattern), ...extra }] }
}

// Ticket 35: the "groove" → "boop" rename touches types and identifiers only.
// `boop:save`'s document shape (`version`/`working`/`creations`, and each
// entry's `name`/`kitId`/`tempo`/`patterns`) is frozen (ADR 0025) — a document
// written before the rename must still decode to its boops afterwards.
describe('pre-rename compatibility (ticket 35)', () => {
  it('decodes a save document written before the rename, "Groove N" names and all', () => {
    const preRenameRaw = JSON.stringify({
      version: 1,
      working: null,
      creations: [
        {
          name: 'Groove 1',
          kitId: 'launch',
          tempo: 120,
          patterns: [patternToStored(pattern)],
        },
      ],
    })

    const decoded = parseSaveDocument(preRenameRaw)

    expect(decoded.creations).toHaveLength(1)
    expect(decoded.creations[0]!.name).toBe('Groove 1')
    expect(storedToPattern(kit, decoded.creations[0]!.patterns[0]!)).toEqual(pattern)
  })
})
