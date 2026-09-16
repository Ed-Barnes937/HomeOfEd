/**
 * The working song (boop-loops ticket 14, spec §2) — the state shape the app
 * edits: 1–35 clips (order is lane order), one bpm, the clip on the grid, and
 * the 16 placements. Pure: types, conversions to and from the save format's
 * `StoredBoop`, and the mutation kinds the UI wires up (tickets 15/18). Every
 * mutation returns a new song; callers pair each one with `afterEdit`
 * (ADR 0031, as amended) so "edited" keeps its one app-wide definition.
 *
 * Defaults are the reader's job (ADR 0032): an old single-pattern boop reads
 * as a one-clip song with an empty song bar, names fall back to "Clip N" and
 * tints to the clip's position — the writer then always states them.
 */

import { blankPattern, STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'
import {
  MAX_CLIPS,
  SONG_POSITIONS,
  TINT_COUNT,
  patternToStored,
  placementsToStored,
  storedToPattern,
  storedToPlacements,
  type StoredBoop,
} from '../persistence/saveFormat.ts'

/**
 * A named, tinted pattern within the song — its own rows by 16 steps, six rows
 * by default (ADR 0042). See `CONTEXT.md`: Clip, Row, Tint.
 */
export interface Clip {
  name: string
  /**
   * Index into the fixed 10-tint list; the clip's for its whole life. Past
   * ten clips the tints repeat, so a tint names a colour, never a clip.
   */
  tint: number
  pattern: Pattern
}

/** The arrangement a boop holds (spec §2). `placements` is always 16 long. */
export interface Song {
  /** 60–180, the whole boop's one speed, driving both play modes. */
  bpm: number
  /** 1–35, ordered; order IS lane order. */
  clips: readonly Clip[]
  /** The clip on the grid — what every grid edit writes into. */
  activeClipIndex: number
  /**
   * One entry per song position: the clips that sound there, in lane order.
   * Empty means an empty slot; more than one means they sound layered together.
   */
  placements: readonly (readonly number[])[]
}

const EMPTY_PLACEMENTS: readonly (readonly number[])[] = Array.from(
  { length: SONG_POSITIONS },
  () => [] as readonly number[],
)

/** The automatic clip name for a 1-based number. */
function clipName(n: number): string {
  return `Clip ${n}`
}

/** A bare grid as a one-clip song with an empty song bar — a fresh or old boop. */
export function singleClipSong(pattern: Pattern, bpm: number): Song {
  return {
    bpm,
    clips: [{ name: clipName(1), tint: 0, pattern }],
    activeClipIndex: 0,
    placements: EMPTY_PLACEMENTS,
  }
}

/** The clip on the grid. */
export function activeClip(song: Song): Clip {
  return song.clips[song.activeClipIndex]!
}

/**
 * Is there anything in this song a child would miss if it went? A second clip,
 * a placement, a painted step, or a clip whose rows are no longer the kit's
 * default six - picking sounds is making something, even before a step is
 * painted (ADR 0042).
 *
 * `singleClipSong(blankPattern(kit), …)` is what "New boop" *makes*, so this is
 * false for exactly that song: the one thing that asks (boop-clips ticket 03)
 * therefore stays quiet about a screen with nothing on it. Deliberately not
 * "differs from a fresh boop in any way": speed and clip names are edits under
 * ADR 0031, but not worth interrupting a child over on an empty grid.
 */
export function songHasContent(kit: Kit, song: Song): boolean {
  const defaultRows = blankPattern(kit).map((row) => row.instrumentId)
  const sameRows = (pattern: Pattern) =>
    pattern.length === defaultRows.length &&
    pattern.every((row, index) => row.instrumentId === defaultRows[index])
  return (
    song.clips.length > 1 ||
    song.placements.some((clipIndices) => clipIndices.length > 0) ||
    song.clips.some(
      (clip) =>
        clip.pattern.some((row) => row.steps.includes(true)) || !sameRows(clip.pattern),
    )
  )
}

/**
 * Read a decoded `StoredBoop` as a song, applying ADR 0032's defaults: an
 * absent name reads "Clip N", an absent tint reads the clip's position, absent
 * placements read empty, an absent `gridClip` reads 0.
 *
 * The position wraps at the palette (ticket 05): there are 35 clips to a song
 * and 10 tints, so past the tenth clip the bare position is not a tint at all.
 * Every document the app writes states its tints, so only a hand-made or
 * corrupt one takes that branch - and it still has to land on a real colour,
 * or the clip would read as tint 11 and fail to decode when it was written
 * back. Under ten clips this is the position, exactly as before.
 */
export function songFromStored(kit: Kit, boop: StoredBoop): Song {
  return {
    bpm: boop.tempo,
    clips: boop.patterns.map((stored, index) => ({
      name: stored.name ?? clipName(index + 1),
      tint: stored.tint ?? index % TINT_COUNT,
      pattern: storedToPattern(kit, stored),
    })),
    activeClipIndex: boop.gridClip ?? 0,
    placements: boop.placements ? storedToPlacements(boop.placements) : EMPTY_PLACEMENTS,
  }
}

/**
 * The `StoredBoop` a song *is* — what the autosave writes, a save into
 * "My boops" appends, and a share link carries, built the one way so the
 * three can never drift. Defaults are stated, not omitted: this document has
 * already been written by a song-aware build.
 */
export function storedBoopFromSong(kit: Kit, song: Song, name: string): StoredBoop {
  return {
    name,
    kitId: kit.kitId,
    tempo: song.bpm,
    patterns: song.clips.map((clip) => ({
      ...patternToStored(clip.pattern),
      name: clip.name,
      tint: clip.tint,
    })),
    placements: placementsToStored(song.placements),
    gridClip: song.activeClipIndex,
  }
}

/** A grid edit: the engine's pattern written straight into the active clip. */
export function withActivePattern(song: Song, pattern: Pattern): Song {
  return {
    ...song,
    clips: song.clips.map((clip, index) =>
      index === song.activeClipIndex ? { ...clip, pattern } : clip,
    ),
  }
}

/** A speed change — the whole song's one bpm. */
export function withBpm(song: Song, bpm: number): Song {
  return { ...song, bpm }
}

/** Set the clips `position` holds. They are kept in lane order. */
export function withPlacement(song: Song, position: number, clipIndices: readonly number[]): Song {
  const held = [...clipIndices].sort((a, b) => a - b)
  return {
    ...song,
    placements: song.placements.map((clips, index) => (index === position ? held : clips)),
  }
}

/**
 * A lane-square tap: add `clipIndex` to `position`, or take it off again.
 * Every lane is its own toggle — a position holds as many clips as the child
 * puts there, and they sound layered (spec §2, as amended).
 */
export function togglePlacement(song: Song, clipIndex: number, position: number): Song {
  const held = song.placements[position]!
  return withPlacement(
    song,
    position,
    held.includes(clipIndex) ? held.filter((index) => index !== clipIndex) : [...held, clipIndex],
  )
}

/**
 * What a layered position sounds like: the clips' rows unioned **by
 * `instrumentId`**, a step on when any clip holding that instrument has it on
 * (spec §1, "layered placements just sound their union"). Overlaying by row
 * *index* was only safe while every pattern was one row per kit instrument in
 * kit order; since ADR 0042 a clip owns its rows, so two layered clips can
 * name entirely different instruments and a row's position says nothing about
 * which one it is.
 *
 * Row order is **first appearance in lane order**: the lowest-lane clip's rows
 * in its own order, then whatever rows the next lane adds, in theirs. Nothing
 * renders a merged pattern - it is what the conductor hands the engine and
 * what the export renders - so the order only has to be deterministic, and
 * this one leaves a single-clip position's pattern exactly as it was.
 */
export function mergePatterns(patterns: readonly Pattern[]): Pattern {
  const [first, ...rest] = patterns
  if (rest.length === 0) return first!
  const union = new Map<string, readonly boolean[]>()
  for (const pattern of patterns) {
    for (const row of pattern) {
      const held = union.get(row.instrumentId)
      union.set(
        row.instrumentId,
        held ? held.map((on, step) => on || row.steps[step] === true) : row.steps,
      )
    }
  }
  return [...union].map(([instrumentId, steps]) => ({ instrumentId, steps }))
}

/**
 * The tint a new clip takes: the **least-used** one, the lowest of them on a
 * tie (ADR 0032, as amended by boop-clips ticket 05). There are 35 clips to a
 * song and 10 tints, so past the tenth clip a tint has to be reused; counting
 * uses spreads the ten as evenly as a song of any length allows, and the
 * lowest-wins tie-break makes it the *lowest unused* tint while any tint is
 * still unused - which is the ≤10-clip rule, unchanged.
 *
 * A tint out of range (only a hand-made document can hold one, and the reader
 * wraps those) counts towards nothing rather than throwing the tally off.
 */
function leastUsedTint(clips: readonly Clip[]): number {
  const uses = Array.from(
    { length: TINT_COUNT },
    (_, tint) => clips.filter((clip) => clip.tint === tint).length,
  )
  return uses.indexOf(Math.min(...uses))
}

/**
 * Append a new clip and put it on the grid, unplaced — placing it in the song
 * is a separate tap (spec §6). A sample clip lands under its plain label via
 * `name`; without one (Blank), the name takes the lowest unused "Clip N".
 * The tint is the least-used one, so ten clips wear ten colours and the
 * eleventh starts the palette again. A no-op at the cap: the "+ New clip"
 * button is disabled there, so this is only belt-and-braces.
 */
export function addClip(song: Song, pattern: Pattern, name?: string): Song {
  if (song.clips.length >= MAX_CLIPS) return song
  const names = new Set(song.clips.map((clip) => clip.name))
  let n = 1
  while (names.has(clipName(n))) n += 1
  return {
    ...song,
    clips: [...song.clips, { name: name ?? clipName(n), tint: leastUsedTint(song.clips), pattern }],
    activeClipIndex: song.clips.length,
  }
}

/**
 * Throw a clip away: its placements empty, placements of later clips
 * renumber, and the grid lands on the previous clip if it held the deleted
 * one. A no-op at one clip — the minimum (spec §2).
 */
export function deleteClip(song: Song, index: number): Song {
  if (song.clips.length <= 1) return song
  const active =
    song.activeClipIndex === index
      ? Math.max(0, index - 1)
      : song.activeClipIndex > index
        ? song.activeClipIndex - 1
        : song.activeClipIndex
  return {
    ...song,
    clips: song.clips.filter((_, i) => i !== index),
    activeClipIndex: active,
    placements: song.placements.map((clips) =>
      clips.filter((held) => held !== index).map((held) => (held > index ? held - 1 : held)),
    ),
  }
}

/** Renaming a clip changes nothing else about it — its tint stays its own. */
export function renameClip(song: Song, index: number, name: string): Song {
  return {
    ...song,
    clips: song.clips.map((clip, i) => (i === index ? { ...clip, name } : clip)),
  }
}

/**
 * Move a lane from `from` to `to`. Placements are index-based (ADR 0032), so
 * they are rewritten in the same update; the tint and the grid both travel
 * with their clip. A refused move — nowhere to go, or out of range — is a
 * no-op, so it never marks the boop edited.
 */
export function moveClip(song: Song, from: number, to: number): Song {
  if (from === to || !song.clips[from] || !song.clips[to]) return song
  const clips = [...song.clips]
  const [moved] = clips.splice(from, 1)
  clips.splice(to, 0, moved!)
  const newIndex = new Map(song.clips.map((clip, index) => [index, clips.indexOf(clip)]))
  return {
    ...song,
    clips,
    activeClipIndex: newIndex.get(song.activeClipIndex)!,
    placements: song.placements.map((clips) =>
      clips.map((held) => newIndex.get(held)!).sort((a, b) => a - b),
    ),
  }
}

// --- The active clip's rows (ADR 0042) ---
//
// A clip owns its rows, so which instruments it holds is a mutation of the
// *song*, not a shape of the kit. The model's three rules live here rather
// than in the UI, and they are the reason nothing invalid can reach the
// engine: `setPattern` throws for an empty, duplicate-naming or unknown-id
// row set, and these are what stand between a child's finger and that throw.
// A refused mutation is a no-op — it returns the song it was given, so the
// `afterEdit` pairing (ADR 0031, as amended) marks nothing.

/** Whether the roster has an instrument by this id. */
function rosterHas(kit: Kit, instrumentId: string): boolean {
  return kit.instruments.some((instrument) => instrument.instrumentId === instrumentId)
}

/** Whether these rows already hold an instrument by this id. */
function rowsHold(rows: Pattern, instrumentId: string): boolean {
  return rows.some((row) => row.instrumentId === instrumentId)
}

/**
 * Add a row for `instrumentId` at the bottom of the active clip, nothing
 * painted ("+ Add a sound", spec §4). Refused for an instrument the clip
 * already holds or the roster does not have.
 *
 * The 1..roster row cap needs no check of its own: rows are unique ids drawn
 * from the roster, so they can never outnumber it.
 */
export function addRow(kit: Kit, song: Song, instrumentId: string): Song {
  const rows = activeClip(song).pattern
  if (!rosterHas(kit, instrumentId) || rowsHold(rows, instrumentId)) return song
  return withActivePattern(song, [
    ...rows,
    { instrumentId, steps: new Array<boolean>(STEPS_PER_PATTERN).fill(false) },
  ])
}

/**
 * Delete row `rowIndex` of the active clip, the steps painted on it and all
 * (the picker's "Remove this row", spec §4 — no confirm; re-adding is one
 * tap). Refused at one row, the floor that keeps a clip a clip, and for an
 * index the clip has no row at.
 */
export function removeRow(song: Song, rowIndex: number): Song {
  const rows = activeClip(song).pattern
  if (rows.length <= 1 || !rows[rowIndex]) return song
  return withActivePattern(
    song,
    rows.filter((_, index) => index !== rowIndex),
  )
}

/**
 * Point row `rowIndex` of the active clip at another instrument, keeping the
 * steps it has painted: same rhythm, new sound (spec §4). Refused for an
 * instrument the clip already holds — which makes a re-tap of the row's own
 * sound a no-op, as the picker's browse-by-ear needs — one the roster does not
 * have, or an index the clip has no row at.
 */
export function swapRowInstrument(
  kit: Kit,
  song: Song,
  rowIndex: number,
  instrumentId: string,
): Song {
  const rows = activeClip(song).pattern
  if (!rows[rowIndex] || !rosterHas(kit, instrumentId) || rowsHold(rows, instrumentId)) return song
  return withActivePattern(
    song,
    rows.map((row, index) => (index === rowIndex ? { instrumentId, steps: row.steps } : row)),
  )
}
