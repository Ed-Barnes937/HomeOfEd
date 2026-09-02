import { describe, expect, it } from 'vitest'

import { createSequencerEngine } from '../engine/createSequencerEngine.ts'
import {
  blankPattern,
  DEFAULT_CLIP_ROWS,
  STEPS_PER_PATTERN,
  type Kit,
  type Pattern,
} from '../engine/sequencerEngine.ts'
import { FakeAudioDriver } from '../engine/testing/fakeAudioDriver.ts'
import { patternToStored, type StoredBoop } from '../persistence/saveFormat.ts'
import { afterEdit } from '../savedState.ts'
import {
  activeClip,
  addClip,
  addRow,
  deleteClip,
  mergePatterns,
  moveClip,
  removeRow,
  renameClip,
  singleClipSong,
  songFromStored,
  storedBoopFromSong,
  swapRowInstrument,
  togglePlacement,
  withActivePattern,
  withBpm,
  withPlacement,
  type Song,
} from './song.ts'

const kit: Kit = {
  kitId: 'launch',
  name: 'Launch kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: 'k.svg', sound: 'k.wav' },
    { instrumentId: 'snare', name: 'Snare', artwork: 's.svg', sound: 's.wav' },
  ],
}

/**
 * A roster bigger than a clip's default row count, so the two can differ and
 * the row mutations have somewhere to add to and swap to (ADR 0042).
 */
const roster: Kit = {
  kitId: 'roster',
  name: 'Roster kit',
  instruments: ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop', 'clap', 'cowbell'].map((id) => ({
    instrumentId: id,
    name: id,
    artwork: `${id}.svg`,
    sound: `${id}.wav`,
  })),
}

function row(instrumentId: string, ...onSteps: number[]) {
  const steps = new Array<boolean>(STEPS_PER_PATTERN).fill(false)
  for (const step of onSteps) steps[step] = true
  return { instrumentId, steps }
}

/** A one-clip song on `roster`: the default six rows, the hat row painted. */
const rowSong: Song = singleClipSong(
  blankPattern(roster).map((r) => (r.instrumentId === 'hat' ? row('hat', 2, 6) : r)),
  100,
)

const kickPattern: Pattern = [row('kick', 0, 4), row('snare')]
const snarePattern: Pattern = [row('kick'), row('snare', 2, 10)]
const emptyPattern: Pattern = [row('kick'), row('snare')]

/** 16 columns, empty but for the given `{ position: [clip, ...] }` entries. */
function columns(entries: Record<number, readonly number[]>): readonly (readonly number[])[] {
  const placements: number[][] = Array.from({ length: 16 }, () => [])
  for (const [position, clips] of Object.entries(entries)) placements[Number(position)] = [...clips]
  return placements
}

/** A two-clip song with a couple of placements — the working example throughout. */
const song: Song = {
  bpm: 120,
  clips: [
    { name: 'Clip 1', tint: 0, pattern: kickPattern },
    { name: 'Drums', tint: 3, pattern: snarePattern },
  ],
  activeClipIndex: 1,
  placements: columns({ 0: [0], 1: [0], 2: [1], 15: [1] }),
}

describe('singleClipSong', () => {
  it('wraps a bare grid as a one-clip song with an empty song bar', () => {
    expect(singleClipSong(kickPattern, 100)).toEqual({
      bpm: 100,
      clips: [{ name: 'Clip 1', tint: 0, pattern: kickPattern }],
      activeClipIndex: 0,
      placements: columns({}),
    })
  })
})

describe('songFromStored / storedBoopFromSong', () => {
  it('round-trips clips, names, tints, placements and the active clip', () => {
    const stored = storedBoopFromSong(kit, song, 'Boop 3')

    expect(stored).toEqual({
      name: 'Boop 3',
      kitId: 'launch',
      tempo: 120,
      patterns: [
        { ...patternToStored(kickPattern), name: 'Clip 1', tint: 0 },
        { ...patternToStored(snarePattern), name: 'Drums', tint: 3 },
      ],
      placements: '112............2',
      gridClip: 1,
    })
    expect(songFromStored(kit, stored)).toEqual(song)
  })

  it('round-trips a layered position — several clips in one column', () => {
    const layered: Song = { ...song, placements: columns({ 0: [0, 1], 3: [1] }) }
    const stored = storedBoopFromSong(kit, layered, 'Layers')

    expect(stored.placements).toBe('12,,,2,,,,,,,,,,,,')
    expect(songFromStored(kit, stored)).toEqual(layered)
  })

  it('writes the pre-layering form until something is actually layered', () => {
    // A song no child has layered must stay byte-identical to what earlier
    // builds wrote, so it keeps round-tripping through them.
    expect(storedBoopFromSong(kit, song, 'Flat').placements).toBe('112............2')

    const layered: Song = { ...song, placements: columns({ 0: [0, 1] }) }
    expect(storedBoopFromSong(kit, layered, 'Layers').placements).toBe('12,,,,,,,,,,,,,,,')
  })

  it('reads a pre-layering placements string — one clip per position', () => {
    const stored: StoredBoop = {
      name: '',
      kitId: 'launch',
      tempo: 120,
      patterns: [patternToStored(kickPattern), patternToStored(snarePattern)],
      placements: '112............2',
    }

    expect(songFromStored(kit, stored).placements).toEqual(song.placements)
  })

  it('reads an old single-pattern boop as a one-clip song with an empty song bar', () => {
    const old: StoredBoop = {
      name: '',
      kitId: 'launch',
      tempo: 92,
      patterns: [patternToStored(kickPattern)],
    }

    expect(songFromStored(kit, old)).toEqual(singleClipSong(kickPattern, 92))
  })

  it('defaults an absent clip name and tint from the clip position', () => {
    const stored: StoredBoop = {
      name: '',
      kitId: 'launch',
      tempo: 100,
      patterns: [patternToStored(kickPattern), patternToStored(snarePattern)],
    }

    expect(songFromStored(kit, stored).clips.map(({ name, tint }) => ({ name, tint }))).toEqual([
      { name: 'Clip 1', tint: 0 },
      { name: 'Clip 2', tint: 1 },
    ])
  })
})

describe('activeClip', () => {
  it('is the clip on the grid', () => {
    expect(activeClip(song)).toBe(song.clips[1])
  })
})

describe('withActivePattern', () => {
  it('writes the grid straight into the active clip', () => {
    const next = withActivePattern(song, emptyPattern)

    expect(activeClip(next).pattern).toBe(emptyPattern)
    expect(next.clips[0]).toBe(song.clips[0])
  })
})

describe('withBpm', () => {
  it("sets the whole song's one speed", () => {
    expect(withBpm(song, 84).bpm).toBe(84)
  })
})

describe('withPlacement', () => {
  it('sets the clips a position holds', () => {
    expect(withPlacement(song, 2, [0, 1]).placements[2]).toEqual([0, 1])
  })

  it('empties a position', () => {
    expect(withPlacement(song, 0, []).placements[0]).toEqual([])
  })
})

describe('togglePlacement', () => {
  it('places the clip on its empty square', () => {
    expect(togglePlacement(song, 0, 3).placements[3]).toEqual([0])
  })

  it('taps a filled square off', () => {
    expect(togglePlacement(song, 0, 0).placements[0]).toEqual([])
  })

  it("layers onto another clip's placement, leaving it alone", () => {
    expect(togglePlacement(song, 0, 2).placements[2]).toEqual([0, 1])
  })

  it('keeps a layered position in lane order however it was built', () => {
    const built = togglePlacement(togglePlacement(song, 1, 4), 0, 4)

    expect(built.placements[4]).toEqual([0, 1])
  })

  it('removes just its own clip from a layered position', () => {
    const layered = withPlacement(song, 5, [0, 1])

    expect(togglePlacement(layered, 1, 5).placements[5]).toEqual([0])
  })
})

describe('mergePatterns', () => {
  it('is the one pattern itself when a position holds one clip', () => {
    expect(mergePatterns([kickPattern])).toBe(kickPattern)
  })

  it('sounds every layer: a step is on when any clip has it on', () => {
    expect(mergePatterns([kickPattern, snarePattern])).toEqual([
      row('kick', 0, 4),
      row('snare', 2, 10),
    ])
  })

  it('a step two clips share sounds once', () => {
    expect(mergePatterns([kickPattern, [row('kick', 4, 8), row('snare')]])).toEqual([
      row('kick', 0, 4, 8),
      row('snare'),
    ])
  })

  // Since ADR 0042 a clip owns its rows, so a row's position says nothing
  // about which instrument it is: two layered clips can name entirely
  // different ones, and the union has to key on `instrumentId` (spec §1).
  it('unions layered clips by instrument, never by row position', () => {
    const kicks: Pattern = [row('kick', 0, 8)]
    const withHat: Pattern = [row('hat', 2), row('kick', 4)]

    expect(mergePatterns([kicks, withHat])).toEqual([row('kick', 0, 4, 8), row('hat', 2)])
  })

  it('carries a row only one clip holds through untouched', () => {
    expect(mergePatterns([[row('kick', 0)], [row('cowbell', 5, 6)]])).toEqual([
      row('kick', 0),
      row('cowbell', 5, 6),
    ])
  })

  it('orders the union by first appearance in lane order', () => {
    const merged = mergePatterns([
      [row('boop', 1)],
      [row('kick', 2), row('boop', 3)],
      [row('hat', 4)],
    ])

    expect(merged.map((r) => r.instrumentId)).toEqual(['boop', 'kick', 'hat'])
    expect(merged[0]).toEqual(row('boop', 1, 3))
  })
})

describe('addRow', () => {
  it('appends the instrument at the bottom of the active clip, nothing painted', () => {
    const rows = activeClip(addRow(roster, rowSong, 'clap')).pattern

    expect(rows.map((r) => r.instrumentId)).toEqual([
      'kick',
      'snare',
      'hat',
      'tom',
      'marimba',
      'boop',
      'clap',
    ])
    expect(rows.at(-1)).toEqual(row('clap'))
  })

  it('adds to the clip on the grid and no other', () => {
    const two = addClip(rowSong, blankPattern(roster))
    const next = addRow(roster, two, 'clap')

    expect(activeClip(next).pattern).toHaveLength(DEFAULT_CLIP_ROWS + 1)
    expect(next.clips[0]).toBe(two.clips[0])
  })

  it('refuses an instrument the clip already holds', () => {
    expect(addRow(roster, rowSong, 'hat')).toBe(rowSong)
  })

  it('refuses an instrument the kit does not have', () => {
    expect(addRow(roster, rowSong, 'tuba')).toBe(rowSong)
  })

  it('refuses to grow past the roster', () => {
    const full = addRow(roster, addRow(roster, rowSong, 'clap'), 'cowbell')

    expect(activeClip(full).pattern).toHaveLength(roster.instruments.length)
    for (const instrument of roster.instruments) {
      expect(addRow(roster, full, instrument.instrumentId)).toBe(full)
    }
  })
})

describe('removeRow', () => {
  it('drops the row and the steps painted on it', () => {
    const rows = activeClip(removeRow(rowSong, 2)).pattern

    expect(rows.map((r) => r.instrumentId)).toEqual(['kick', 'snare', 'tom', 'marimba', 'boop'])
    expect(rows.some((r) => r.steps.some((on) => on))).toBe(false)
  })

  it('removes from the clip on the grid and no other', () => {
    const two = addClip(rowSong, blankPattern(roster))
    const next = removeRow(two, 0)

    expect(activeClip(next).pattern).toHaveLength(DEFAULT_CLIP_ROWS - 1)
    expect(next.clips[0]).toBe(two.clips[0])
  })

  it('refuses the last row — a clip is never rowless', () => {
    const one = singleClipSong([row('kick', 0)], 100)

    expect(removeRow(one, 0)).toBe(one)
  })

  it('refuses an index the clip has no row at', () => {
    expect(removeRow(rowSong, DEFAULT_CLIP_ROWS)).toBe(rowSong)
    expect(removeRow(rowSong, -1)).toBe(rowSong)
  })
})

describe('swapRowInstrument', () => {
  it("keeps the row's position and its painted steps — same rhythm, new sound", () => {
    const rows = activeClip(swapRowInstrument(roster, rowSong, 2, 'cowbell')).pattern

    expect(rows.map((r) => r.instrumentId)).toEqual([
      'kick',
      'snare',
      'cowbell',
      'tom',
      'marimba',
      'boop',
    ])
    expect(rows[2]).toEqual(row('cowbell', 2, 6))
  })

  it('swaps on the clip on the grid and no other', () => {
    const two = addClip(rowSong, blankPattern(roster))
    const next = swapRowInstrument(roster, two, 0, 'clap')

    expect(activeClip(next).pattern[0]!.instrumentId).toBe('clap')
    expect(next.clips[0]).toBe(two.clips[0])
  })

  it("refuses an instrument the clip already holds, the row's own included", () => {
    expect(swapRowInstrument(roster, rowSong, 2, 'boop')).toBe(rowSong)
    expect(swapRowInstrument(roster, rowSong, 2, 'hat')).toBe(rowSong)
  })

  it('refuses an instrument the kit does not have', () => {
    expect(swapRowInstrument(roster, rowSong, 2, 'tuba')).toBe(rowSong)
  })

  it('refuses an index the clip has no row at', () => {
    expect(swapRowInstrument(roster, rowSong, DEFAULT_CLIP_ROWS, 'clap')).toBe(rowSong)
    expect(swapRowInstrument(roster, rowSong, -1, 'clap')).toBe(rowSong)
  })
})

/**
 * Spec §5 at the state level: a clip's instrument selection *is* its pattern's
 * row list, so it needs no state of its own to survive a trip to another clip.
 * This exercises the seam the app actually switches clips over — `setPattern`
 * out, `getPattern` back. The `.iwft` version lands with the picker (ticket 05).
 */
describe('a clip switch carries each clip’s own rows through the engine', () => {
  it('gives clip 1 its rows back after a clip 2 with nothing painted', async () => {
    const engine = await createSequencerEngine({ kit: roster, driver: new FakeAudioDriver() })

    // Clip 1: swap a row and add one, painting nothing new.
    let current = addRow(roster, swapRowInstrument(roster, rowSong, 2, 'cowbell'), 'clap')
    const chosen = activeClip(current).pattern.map((r) => r.instrumentId)
    engine.setPattern(activeClip(current).pattern)

    // Clip 2: a blank clip on the grid, its own default rows, nothing painted.
    current = addClip(current, blankPattern(roster))
    engine.setPattern(activeClip(current).pattern)
    expect(engine.getPattern()).toHaveLength(DEFAULT_CLIP_ROWS)

    // Back to clip 1, the way `selectClip` does it.
    current = { ...current, activeClipIndex: 0 }
    engine.setPattern(activeClip(current).pattern)

    expect(engine.getPattern().map((r) => r.instrumentId)).toEqual(chosen)
    // And the steps travelled with the row the swap re-pointed.
    expect(engine.getPattern()[2]).toEqual(row('cowbell', 2, 6))
  })
})

describe('addClip', () => {
  it('appends a clip on the lowest unused tint and puts it on the grid, unplaced', () => {
    const next = addClip(song, emptyPattern)

    expect(next.clips).toHaveLength(3)
    expect(next.clips[2]).toEqual({ name: 'Clip 2', tint: 1, pattern: emptyPattern })
    expect(next.activeClipIndex).toBe(2)
    expect(next.placements).toEqual(song.placements)
  })

  it('names the clip with the lowest unused number, like its tint', () => {
    const twice = addClip(addClip(song, emptyPattern), emptyPattern)

    expect(twice.clips.map((clip) => clip.name)).toEqual(['Clip 1', 'Drums', 'Clip 2', 'Clip 3'])
    expect(twice.clips.map((clip) => clip.tint)).toEqual([0, 3, 1, 2])
  })

  it('refuses to grow past the clip cap', () => {
    let full = song
    while (full.clips.length < 5) full = addClip(full, emptyPattern)

    expect(addClip(full, emptyPattern)).toBe(full)
  })

  it("takes a sample clip's label as the name, still on the lowest unused tint", () => {
    const next = addClip(song, emptyPattern, 'Boom clap')

    expect(next.clips[2]).toEqual({ name: 'Boom clap', tint: 1, pattern: emptyPattern })
    expect(next.activeClipIndex).toBe(2)
  })

  it('leaves the automatic "Clip N" numbering alone for a named add', () => {
    const named = addClip(song, emptyPattern, 'Boom clap')
    const blankAfter = addClip(named, emptyPattern)

    expect(blankAfter.clips.map((clip) => clip.name)).toEqual([
      'Clip 1',
      'Drums',
      'Boom clap',
      'Clip 2',
    ])
  })
})

describe('deleteClip', () => {
  it('drops the clip, its placements, and renumbers placements above it', () => {
    const next = deleteClip(song, 0)

    expect(next.clips).toEqual([song.clips[1]])
    expect(next.placements[0]).toEqual([])
    expect(next.placements[1]).toEqual([])
    expect(next.placements[2]).toEqual([0])
    expect(next.placements[15]).toEqual([0])
  })

  it('leaves the other layers of a position it shared', () => {
    const next = deleteClip(withPlacement(song, 4, [0, 1]), 0)

    expect(next.placements[4]).toEqual([0])
  })

  it('keeps the grid on the same clip when one above it goes', () => {
    expect(deleteClip(song, 0).activeClipIndex).toBe(0)
  })

  it('moves the grid to the previous clip when the active clip itself goes', () => {
    expect(deleteClip(song, 1).activeClipIndex).toBe(0)
  })

  it('refuses to delete the last clip', () => {
    const one = singleClipSong(kickPattern, 100)

    expect(deleteClip(one, 0)).toBe(one)
  })
})

describe('renameClip', () => {
  it('renames the clip and nothing else', () => {
    const next = renameClip(song, 1, 'Thunder')

    expect(next.clips[1]!.name).toBe('Thunder')
    expect(next.clips[1]!.tint).toBe(3)
    expect(next.clips[0]).toBe(song.clips[0])
  })
})

describe('moveClip', () => {
  it('reorders the lanes and rewrites placements atomically (ADR 0032)', () => {
    const next = moveClip(song, 0, 1)

    expect(next.clips).toEqual([song.clips[1], song.clips[0]])
    expect(next.placements[0]).toEqual([1])
    expect(next.placements[2]).toEqual([0])
    expect(next.placements[15]).toEqual([0])
  })

  it('re-sorts a layered position into the new lane order', () => {
    const next = moveClip(withPlacement(song, 4, [0, 1]), 0, 1)

    expect(next.placements[4]).toEqual([0, 1])
  })

  it('keeps the grid on the clip it was on', () => {
    expect(activeClip(moveClip(song, 0, 1))).toBe(song.clips[1])
  })

  it('tints travel with their clips', () => {
    expect(moveClip(song, 0, 1).clips.map((clip) => clip.tint)).toEqual([3, 0])
  })

  it('refuses a move to where the clip already is', () => {
    expect(moveClip(song, 1, 1)).toBe(song)
  })

  it('refuses an out-of-range move', () => {
    expect(moveClip(song, 0, 2)).toBe(song)
    expect(moveClip(song, 0, -1)).toBe(song)
    expect(moveClip(song, 2, 0)).toBe(song)
  })
})

/**
 * The grown "edited" definition (ADR 0031, as amended): any mutation of the
 * song drops the saved indicator. `apply` below is `HomePage`'s `updateSong`
 * contract in miniature — a mutation that changed the song goes through
 * `afterEdit`, a refused no-op does not.
 */
describe('every song mutation kind marks the loaded boop edited', () => {
  const loaded = { index: 0, name: 'Boop 3', edited: false }

  function apply(input: Song, mutate: (input: Song) => Song) {
    return mutate(input) === input ? loaded : afterEdit(loaded)
  }

  /** The song each kind is applied to; the two-clip `song` unless it needs a roster. */
  const kinds: [string, (input: Song) => Song, Song?][] = [
    ['a cell toggle', (input) => withActivePattern(input, emptyPattern)],
    ['a speed change', (input) => withBpm(input, 84)],
    ['a placement change', (input) => withPlacement(input, 3, [0])],
    ['a clip add', (input) => addClip(input, emptyPattern)],
    ['a clip delete', (input) => deleteClip(input, 0)],
    ['a clip rename', (input) => renameClip(input, 0, 'Thunder')],
    ['a lane reorder', (input) => moveClip(input, 0, 1)],
    ['a row add', (input) => addRow(roster, input, 'clap'), rowSong],
    ['a row remove', (input) => removeRow(input, 2), rowSong],
    ['an instrument swap', (input) => swapRowInstrument(roster, input, 2, 'clap'), rowSong],
  ]

  for (const [kind, mutate, on = song] of kinds) {
    it(`${kind} is a real mutation, and the transition marks it`, () => {
      expect(mutate(on)).not.toEqual(on)
      expect(apply(on, mutate)).toEqual({ ...loaded, edited: true })
    })
  }

  it('a refused no-op is not a mutation and marks nothing', () => {
    let full = song
    while (full.clips.length < 5) full = addClip(full, emptyPattern)
    const one = singleClipSong(kickPattern, 100)
    const oneRow = singleClipSong([row('kick', 0)], 100)

    expect(apply(full, (input) => addClip(input, emptyPattern))).toBe(loaded)
    expect(apply(one, (input) => deleteClip(input, 0))).toBe(loaded)
    expect(apply(rowSong, (input) => addRow(roster, input, 'hat'))).toBe(loaded)
    expect(apply(oneRow, (input) => removeRow(input, 0))).toBe(loaded)
    expect(apply(rowSong, (input) => swapRowInstrument(roster, input, 2, 'hat'))).toBe(loaded)
  })
})
