/**
 * The working song (boop-loops ticket 14, spec §2) — the state shape the app
 * edits: 1–5 clips (order is lane order), one bpm, the clip on the grid, and
 * the 16 placements. Pure: types, conversions to and from the save format's
 * `StoredBoop`, and the mutation kinds the UI wires up (tickets 15/18). Every
 * mutation returns a new song; callers pair each one with `afterEdit`
 * (ADR 0031, as amended) so "edited" keeps its one app-wide definition.
 *
 * Defaults are the reader's job (ADR 0032): an old single-pattern boop reads
 * as a one-clip song with an empty song bar, names fall back to "Clip N" and
 * tints to the clip's position — the writer then always states them.
 */

import type { Kit, Pattern } from '../engine/sequencerEngine.ts'
import {
  MAX_CLIPS,
  SONG_POSITIONS,
  TINT_COUNT,
  patternToStored,
  storedToPattern,
  type StoredBoop,
} from '../persistence/saveFormat.ts'

/** A named, tinted 6×16 pattern within the song. See `CONTEXT.md`: Clip, Tint. */
export interface Clip {
  name: string
  /** Index into the fixed 5-tint list; the clip's for its whole life. */
  tint: number
  pattern: Pattern
}

/** The arrangement a boop holds (spec §2). `placements` is always 16 long. */
export interface Song {
  /** 60–180, the whole boop's one speed, driving both play modes. */
  bpm: number
  /** 1–5, ordered; order IS lane order. */
  clips: readonly Clip[]
  /** The clip on the grid — what every grid edit writes into. */
  activeClipIndex: number
  /** One entry per song position: a clip index, or `null` for an empty slot. */
  placements: readonly (number | null)[]
}

const EMPTY_PLACEMENTS: readonly (number | null)[] = new Array<number | null>(SONG_POSITIONS).fill(
  null,
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
 * Read a decoded `StoredBoop` as a song, applying ADR 0032's defaults: an
 * absent name reads "Clip N", an absent tint reads the clip's position, absent
 * placements read empty, an absent `gridClip` reads 0.
 */
export function songFromStored(kit: Kit, boop: StoredBoop): Song {
  return {
    bpm: boop.tempo,
    clips: boop.patterns.map((stored, index) => ({
      name: stored.name ?? clipName(index + 1),
      tint: stored.tint ?? index,
      pattern: storedToPattern(kit, stored),
    })),
    activeClipIndex: boop.gridClip ?? 0,
    placements: boop.placements
      ? Array.from(boop.placements, (char) => (char === '.' ? null : Number(char) - 1))
      : EMPTY_PLACEMENTS,
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
    placements: song.placements.map((clip) => (clip === null ? '.' : String(clip + 1))).join(''),
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

/** Place `clipIndex` at `position` (replacing whatever held it), or `null` to empty it. */
export function withPlacement(song: Song, position: number, clipIndex: number | null): Song {
  return {
    ...song,
    placements: song.placements.map((held, index) => (index === position ? clipIndex : held)),
  }
}

/**
 * Append a new clip and put it on the grid, unplaced — placing it in the song
 * is a separate tap (spec §6). Name and tint both take the lowest unused
 * value, which keeps one-tint-per-clip after deletes. A no-op at the cap:
 * the "+ New clip" button is disabled there, so this is only belt-and-braces.
 */
export function addClip(song: Song, pattern: Pattern): Song {
  if (song.clips.length >= MAX_CLIPS) return song
  const names = new Set(song.clips.map((clip) => clip.name))
  const tints = new Set(song.clips.map((clip) => clip.tint))
  let n = 1
  while (names.has(clipName(n))) n += 1
  let tint = 0
  while (tint < TINT_COUNT && tints.has(tint)) tint += 1
  return {
    ...song,
    clips: [...song.clips, { name: clipName(n), tint, pattern }],
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
    placements: song.placements.map((held) =>
      held === null || held === index ? null : held > index ? held - 1 : held,
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
 * with their clip.
 */
export function moveClip(song: Song, from: number, to: number): Song {
  const clips = [...song.clips]
  const [moved] = clips.splice(from, 1)
  clips.splice(to, 0, moved!)
  const newIndex = new Map(song.clips.map((clip, index) => [index, clips.indexOf(clip)]))
  return {
    ...song,
    clips,
    activeClipIndex: newIndex.get(song.activeClipIndex)!,
    placements: song.placements.map((held) => (held === null ? null : newIndex.get(held)!)),
  }
}
