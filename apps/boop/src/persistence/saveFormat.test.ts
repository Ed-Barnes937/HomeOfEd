import { describe, expect, it } from 'vitest'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'
import {
  EMPTY_DOCUMENT,
  MAX_CLIPS,
  SAVE_FORMAT_VERSION,
  TINT_COUNT,
  parseSaveDocument,
  patternToStored,
  serializeSaveDocument,
  storedToPattern,
  type SaveDocument,
  type StoredBoop,
} from './saveFormat.ts'

function instrument(instrumentId: string) {
  return {
    instrumentId,
    name: instrumentId,
    artwork: `${instrumentId}.svg`,
    sound: `${instrumentId}.wav`,
  }
}

const kit: Kit = {
  kitId: 'launch',
  name: 'Launch kit',
  instruments: [instrument('kick'), instrument('snare')],
}

/**
 * A roster-shaped kit (ADR 0042): the classic six first, then instruments a
 * clip may pick but a pre-dynamic-rows document never named.
 */
const rosterKit: Kit = {
  ...kit,
  instruments: ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop', 'cowbell', 'bell'].map(
    instrument,
  ),
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

// Ticket 03 / ADR 0042: the stored rows ARE the clip's selection, so decode
// honours them verbatim - membership and order - rather than rebuilding one
// row per kit instrument.
describe('storedToPattern', () => {
  it('honours the stored rows verbatim', () => {
    expect(storedToPattern(kit, patternToStored(pattern))).toEqual(pattern)
  })

  it('reads the rows in stored order, not kit order', () => {
    const stored = patternToStored([row('snare', 0), row('kick', 1)])

    expect(storedToPattern(kit, stored)).toEqual([row('snare', 0), row('kick', 1)])
  })

  it('keeps an all-off row, so an instrument chosen but never painted comes back', () => {
    const chosen: Pattern = [row('snare'), row('kick', 0)]

    expect(storedToPattern(kit, patternToStored(chosen))).toEqual(chosen)
  })

  it('does not invent rows for kit instruments the clip left out', () => {
    const stored = { rows: [{ instrumentId: 'snare', steps: '1'.repeat(STEPS_PER_PATTERN) }] }

    const result = storedToPattern(kit, stored)

    expect(result.map((r) => r.instrumentId)).toEqual(['snare'])
    expect(result[0]!.steps.every((on) => on === true)).toBe(true)
  })

  it('drops an instrument the kit does not know and keeps the rest, in place', () => {
    const stored = patternToStored([row('cowbell', 0), row('snare', 4), row('kick', 8)])

    expect(storedToPattern(kit, stored)).toEqual([row('snare', 4), row('kick', 8)])
  })

  // A `Pattern` is 1..roster rows (ADR 0042) and `setPattern` throws on an
  // empty one, so an all-unknown row set degrades to a fresh grid rather than
  // handing the engine something it must refuse.
  it('falls back to the kit’s default rows when it knows none of the stored rows', () => {
    const stored = patternToStored([row('cowbell', 0), row('bell', 4)])

    expect(storedToPattern(kit, stored)).toEqual([row('kick'), row('snare')])
  })

  it('caps that fallback at the default row count on a big roster', () => {
    const stored = patternToStored([row('nothing-here', 0)])

    expect(storedToPattern(rosterKit, stored)).toEqual([
      row('kick'),
      row('snare'),
      row('hat'),
      row('tom'),
      row('marimba'),
      row('boop'),
    ])
  })
})

describe('round-trip', () => {
  // Spec §5, the "come back to clip 1" scenario at the unit level: the
  // selection was never separate state, so it needs no new field.
  it('preserves a chosen row set with nothing painted on it', () => {
    const chosen = patternToStored([row('snare'), row('kick')])
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...boop, name: '', patterns: [chosen] },
      creations: [],
    }

    const restored = reparse(saveDocument).working!

    expect(restored.patterns[0]).toEqual({
      rows: [
        { instrumentId: 'snare', steps: '0'.repeat(STEPS_PER_PATTERN) },
        { instrumentId: 'kick', steps: '0'.repeat(STEPS_PER_PATTERN) },
      ],
    })
    expect(storedToPattern(kit, restored.patterns[0]!)).toEqual([row('snare'), row('kick')])
  })

  // Ticket 03: every pre-dynamic-rows document listed exactly the launch six
  // in kit order, which is why making the rows authoritative changes nothing
  // for data already on disk.
  it('decodes a pre-dynamic-rows document byte-honest and re-encodes it identically', () => {
    const classicSix = ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']
    const legacyRaw = JSON.stringify({
      version: 1,
      working: {
        name: '',
        kitId: 'launch',
        tempo: 120,
        patterns: [
          { rows: classicSix.map((instrumentId) => ({ instrumentId, steps: '1000100010001000' })) },
        ],
      },
      creations: [],
    })

    const decoded = parseSaveDocument(legacyRaw)

    expect(serializeSaveDocument(decoded)).toBe(legacyRaw)
    // On the grown roster it still reads as the classic six, in the order the
    // old build wrote them.
    const rebuilt = storedToPattern(rosterKit, decoded.working!.patterns[0]!)
    expect(rebuilt.map((r) => r.instrumentId)).toEqual(classicSix)
  })

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

  // Ticket 04: a placements string indexes clips by single character - digits
  // `1`-`9`, then the letter `a` for clip 10. Old digit-only strings are a
  // strict subset, so nothing already on disk changes meaning.
  it('preserves a ten-clip song, clip 10 written as the letter a', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: Array.from({ length: 10 }, (_, index) => ({
        ...patternToStored(pattern),
        name: `Clip ${index + 1}`,
        tint: index,
      })),
      placements: '19a.............',
      gridClip: 9,
    }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...song, name: '' },
      creations: [song],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  it('preserves a layered position holding clip 10', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: Array.from({ length: 10 }, () => patternToStored(pattern)),
      placements: '9a,,,,,,,,,,,,,,,1',
    }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...song, name: '' },
      creations: [],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  // Ticket 05: the cap is the alphabet's own ceiling - 35 clips, the last of
  // them `z` - and tints repeat past the palette, so two clips sharing one is
  // now legal data rather than a broken document.
  it('preserves a thirty-five clip song with repeated tints, clip 35 written as z', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: Array.from({ length: MAX_CLIPS }, (_, index) => ({
        ...patternToStored(pattern),
        name: `Clip ${index + 1}`,
        tint: index % TINT_COUNT,
      })),
      placements: '1z9a............',
      gridClip: MAX_CLIPS - 1,
    }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...song, name: '' },
      creations: [song],
    }

    expect(reparse(saveDocument)).toEqual(saveDocument)
  })

  it('preserves two clips on the same tint - a duplicate tint is legal now', () => {
    const song: StoredBoop = {
      ...boop,
      patterns: [
        { ...patternToStored(pattern), tint: 2 },
        { ...patternToStored(pattern), tint: 2 },
      ],
    }
    const saveDocument: SaveDocument = {
      version: SAVE_FORMAT_VERSION,
      working: { ...song, name: '' },
      creations: [],
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
    // Ticket 03 / ADR 0042: a clip holds 1..roster rows with unique
    // instrument ids, so neither of these is data.
    ['a pattern with no rows', withWorking({ ...boop, patterns: [{ rows: [] }] })],
    [
      'a pattern naming the same instrument twice',
      withWorking({
        ...boop,
        patterns: [
          {
            rows: [
              { instrumentId: 'kick', steps: '1000100010001000' },
              { instrumentId: 'kick', steps: '0000100000000000' },
            ],
          },
        ],
      }),
    ],
    ['a non-numeric tempo', withWorking({ ...boop, tempo: 'fast' })],
    ['a tempo outside the allowed range', withWorking({ ...boop, tempo: 5000 })],
    [
      'a missing name',
      withWorking({ kitId: 'launch', tempo: 120, patterns: [patternToStored(pattern)] }),
    ],
    // Ticket 05: the cap is 35, the last clip the placement alphabet can name.
    [
      'more than 35 patterns',
      withWorking({ ...boop, patterns: new Array(36).fill(patternToStored(pattern)) }),
    ],
    ['a non-string pattern name', withWorking(withPattern({ name: 7 }))],
    ['a tint above the tint list', withWorking(withPattern({ tint: 10 }))],
    ['a negative tint', withWorking(withPattern({ tint: -1 }))],
    ['a fractional tint', withWorking(withPattern({ tint: 1.5 }))],
    [
      'a placement digit with no clip behind it',
      withWorking({ ...boop, placements: '2...............' }),
    ],
    ['a placements string of the wrong length', withWorking({ ...boop, placements: '1...' })],
    [
      'placement characters that are not . or a clip character',
      withWorking({ ...boop, placements: '0x..............' }),
    ],
    // Ticket 04: `a` is clip 10, so it is as dangling on a one-clip boop as a
    // digit past the clip list - and so is `z`, clip 35, the last character the
    // alphabet has (ticket 05).
    [
      'a placement letter with no clip behind it',
      withWorking({ ...boop, placements: 'a...............' }),
    ],
    [
      'the last placement letter with no clip behind it',
      withWorking({ ...boop, placements: 'z...............' }),
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

  // The other half of ticket 03's rule: a document from a *newer* roster must
  // not be rejected. Unknown ids are a decode-time tolerance, not a document
  // error - they drop later, at `storedToPattern`.
  it('decodes a pattern naming an instrument no kit here has', () => {
    const raw = withWorking({
      ...boop,
      patterns: [
        {
          rows: [
            { instrumentId: 'kick', steps: '1000100010001000' },
            { instrumentId: 'cowbell', steps: '0010001000100010' },
          ],
        },
      ],
    })

    const rows = parseSaveDocument(raw).working!.patterns[0]!.rows

    expect(rows.map((r) => r.instrumentId)).toEqual(['kick', 'cowbell'])
    expect(storedToPattern(kit, { rows })).toEqual([row('kick', 0, 4, 8, 12)])
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
