import { describe, expect, it } from 'vitest'

import { STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'
import { patternToStored, type StoredBoop } from '../persistence/saveFormat.ts'
import { afterEdit } from '../savedState.ts'
import {
  activeClip,
  addClip,
  deleteClip,
  moveClip,
  renameClip,
  singleClipSong,
  songFromStored,
  storedBoopFromSong,
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

function row(instrumentId: string, ...onSteps: number[]) {
  const steps = new Array<boolean>(STEPS_PER_PATTERN).fill(false)
  for (const step of onSteps) steps[step] = true
  return { instrumentId, steps }
}

const kickPattern: Pattern = [row('kick', 0, 4), row('snare')]
const snarePattern: Pattern = [row('kick'), row('snare', 2, 10)]
const emptyPattern: Pattern = [row('kick'), row('snare')]

/** A two-clip song with a couple of placements — the working example throughout. */
const song: Song = {
  bpm: 120,
  clips: [
    { name: 'Clip 1', tint: 0, pattern: kickPattern },
    { name: 'Drums', tint: 3, pattern: snarePattern },
  ],
  activeClipIndex: 1,
  placements: [0, 0, 1, null, null, null, null, null, null, null, null, null, null, null, null, 1],
}

describe('singleClipSong', () => {
  it('wraps a bare grid as a one-clip song with an empty song bar', () => {
    expect(singleClipSong(kickPattern, 100)).toEqual({
      bpm: 100,
      clips: [{ name: 'Clip 1', tint: 0, pattern: kickPattern }],
      activeClipIndex: 0,
      placements: new Array(16).fill(null),
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
  it('places a clip at a position, replacing whatever held it', () => {
    expect(withPlacement(song, 2, 0).placements[2]).toBe(0)
  })

  it('removes a placement', () => {
    expect(withPlacement(song, 0, null).placements[0]).toBeNull()
  })
})

describe('togglePlacement', () => {
  it('places the clip on its empty square', () => {
    expect(togglePlacement(song, 0, 3).placements[3]).toBe(0)
  })

  it('taps a filled square off', () => {
    expect(togglePlacement(song, 0, 0).placements[0]).toBeNull()
  })

  it("replaces another clip's placement — one clip per position", () => {
    expect(togglePlacement(song, 0, 2).placements[2]).toBe(0)
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
    expect(next.placements[0]).toBeNull()
    expect(next.placements[1]).toBeNull()
    expect(next.placements[2]).toBe(0)
    expect(next.placements[15]).toBe(0)
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
    expect(next.placements[0]).toBe(1)
    expect(next.placements[2]).toBe(0)
    expect(next.placements[15]).toBe(0)
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

  const kinds: [string, (input: Song) => Song][] = [
    ['a cell toggle', (input) => withActivePattern(input, emptyPattern)],
    ['a speed change', (input) => withBpm(input, 84)],
    ['a placement change', (input) => withPlacement(input, 3, 0)],
    ['a clip add', (input) => addClip(input, emptyPattern)],
    ['a clip delete', (input) => deleteClip(input, 0)],
    ['a clip rename', (input) => renameClip(input, 0, 'Thunder')],
    ['a lane reorder', (input) => moveClip(input, 0, 1)],
  ]

  for (const [kind, mutate] of kinds) {
    it(`${kind} is a real mutation, and the transition marks it`, () => {
      expect(mutate(song)).not.toEqual(song)
      expect(apply(song, mutate)).toEqual({ ...loaded, edited: true })
    })
  }

  it('a refused no-op is not a mutation and marks nothing', () => {
    let full = song
    while (full.clips.length < 5) full = addClip(full, emptyPattern)
    const one = singleClipSong(kickPattern, 100)

    expect(apply(full, (input) => addClip(input, emptyPattern))).toBe(loaded)
    expect(apply(one, (input) => deleteClip(input, 0))).toBe(loaded)
  })
})
