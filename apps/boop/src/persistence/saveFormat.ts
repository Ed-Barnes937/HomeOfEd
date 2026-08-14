/**
 * boop's save format — one versioned document holding the working grid and the
 * "My boops" list (see `apps/boop/CONTEXT.md` for boop / pattern, and
 * [ADR 0025](../../../../docs/adr/0025-boop-save-format.md) for the shape's rationale).
 *
 * Pure: types plus encode/decode over strings. Storage lives in `storage.ts`,
 * scheduling in `autosave.ts`. Decode is total — anything unparseable, mistyped
 * or from a future version degrades to `EMPTY_DOCUMENT` rather than throwing,
 * so a child never meets an error screen (and the share codec, which reuses
 * these boop shapes, inherits the same guarantee).
 */

import {
  MAX_BPM,
  MIN_BPM,
  STEPS_PER_PATTERN,
  type Kit,
  type Pattern,
} from '../engine/sequencerEngine.ts'

/** Bumped only for a breaking shape change; an unknown version reads as empty. */
export const SAVE_FORMAT_VERSION = 1

/** The fixed tint list has exactly this many colours; `tint` indexes into it. */
export const TINT_COUNT = 5

/** Hard cap on clips per boop — one per tint (ADR 0032, spec §2). */
export const MAX_CLIPS = TINT_COUNT

/** A song is fixed at 16 positions; `placements` is one character per position. */
export const SONG_POSITIONS = 16

/** One instrument's 16 cells as a bitstring, e.g. `1000100010001000`. */
export interface StoredRow {
  instrumentId: string
  steps: string
}

/**
 * One pattern — the storage shape of a **clip** (ADR 0032: the field keeps its
 * frozen V1 name while the domain says Clip). `name` and `tint` are optional
 * and additive: the decoder passes them through when present and adds nothing
 * when absent — defaults ("Clip N", tint = position) are the reader's job, so
 * an old document round-trips byte-honest.
 */
export interface StoredPattern {
  rows: readonly StoredRow[]
  name?: string
  /** Index into the fixed 5-tint list (0–4), unique per clip. */
  tint?: number
}

/**
 * A boop: a named thing a child made — since ADR 0032, a whole **song**.
 * `patterns` is the clip list (1–5, order is lane order). `placements` and
 * `gridClip` are optional and additive: absent on every pre-song document,
 * which therefore decodes as a one-clip song with an empty song bar.
 */
export interface StoredBoop {
  name: string
  kitId: string
  tempo: number
  patterns: readonly StoredPattern[]
  /**
   * One character per song position: `.` empty, `1`–`5` a 1-based clip index
   * (e.g. `"1112..3311......"`). Always exactly 16 characters when present.
   */
  placements?: string
  /** Which clip is on the grid (0-based index into `patterns`), default 0. */
  gridClip?: number
}

/**
 * The whole of boop's stored state. `working` is the autosaved grid — the slot
 * a reload restores — and is deliberately separate from `creations`, the
 * "My boops" list a child saves into explicitly.
 *
 * `creations` keeps that field name deliberately (ticket 35): it is part of
 * the frozen `boop:save` document shape (ADR 0025) — renaming it would break
 * every save already on disk.
 */
export interface SaveDocument {
  version: number
  working: StoredBoop | null
  creations: readonly StoredBoop[]
}

export const EMPTY_DOCUMENT: SaveDocument = {
  version: SAVE_FORMAT_VERSION,
  working: null,
  creations: [],
}

export function patternToStored(pattern: Pattern): StoredPattern {
  return {
    rows: pattern.map((row) => ({
      instrumentId: row.instrumentId,
      steps: row.steps.map((on) => (on ? '1' : '0')).join(''),
    })),
  }
}

/**
 * The working song is unnamed until a child saves it into "My boops".
 * Building a `StoredBoop` from the working song is `storedBoopFromSong`
 * (`src/song/song.ts`) — the one way, shared by the autosave, the save form
 * and the share link so the three can never drift.
 */
export const WORKING_NAME = ''

/**
 * Rebuild a full pattern for `kit` — one row per kit instrument, in kit order.
 * Rows the stored pattern omits come back empty and instruments the kit does
 * not have are dropped, so a kit that gained or lost an instrument still loads.
 */
export function storedToPattern(kit: Kit, stored: StoredPattern): Pattern {
  const byInstrument = new Map(stored.rows.map((row) => [row.instrumentId, row.steps]))
  return kit.instruments.map((instrument) => {
    const steps = byInstrument.get(instrument.instrumentId)
    return {
      instrumentId: instrument.instrumentId,
      steps: Array.from({ length: STEPS_PER_PATTERN }, (_, step) => steps?.[step] === '1'),
    }
  })
}

export function serializeSaveDocument(saveDocument: SaveDocument): string {
  return JSON.stringify(saveDocument)
}

/** Total: never throws, never returns a partially-valid document. */
export function parseSaveDocument(raw: string | null): SaveDocument {
  if (raw === null || raw === '') return EMPTY_DOCUMENT

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return EMPTY_DOCUMENT
  }
  if (!isRecord(parsed)) return EMPTY_DOCUMENT
  if (parsed.version !== SAVE_FORMAT_VERSION) return EMPTY_DOCUMENT

  const working =
    parsed.working === null || parsed.working === undefined
      ? null
      : decodeStoredBoop(parsed.working)
  if (working === undefined) return EMPTY_DOCUMENT

  if (!Array.isArray(parsed.creations)) return EMPTY_DOCUMENT
  const creations: StoredBoop[] = []
  for (const entry of parsed.creations) {
    const boop = decodeStoredBoop(entry)
    if (boop === undefined) return EMPTY_DOCUMENT
    creations.push(boop)
  }

  return { version: SAVE_FORMAT_VERSION, working, creations }
}

/**
 * `undefined` means "not a valid boop" — distinct from an absent one.
 * Exported because the share codec decodes the same boop shape out of a URL
 * fragment and must apply exactly these rules (ADR 0026).
 */
export function decodeStoredBoop(value: unknown): StoredBoop | undefined {
  if (!isRecord(value)) return undefined

  const { name, kitId, tempo, patterns } = value
  if (typeof name !== 'string' || typeof kitId !== 'string') return undefined
  if (typeof tempo !== 'number' || !Number.isFinite(tempo)) return undefined
  if (tempo < MIN_BPM || tempo > MAX_BPM) return undefined
  if (!Array.isArray(patterns) || patterns.length === 0) return undefined
  if (patterns.length > MAX_CLIPS) return undefined

  const decoded: StoredPattern[] = []
  for (const entry of patterns) {
    const pattern = decodePattern(entry)
    if (pattern === undefined) return undefined
    decoded.push(pattern)
  }

  // One tint per clip (ADR 0032 amendment). An absent tint defaults to the
  // pattern's own position, so uniqueness is checked on the effective values.
  const tints = decoded.map((pattern, index) => pattern.tint ?? index)
  if (new Set(tints).size !== tints.length) return undefined

  const boop: StoredBoop = { name, kitId, tempo, patterns: decoded }

  if (value.placements !== undefined) {
    if (typeof value.placements !== 'string') return undefined
    if (value.placements.length !== SONG_POSITIONS) return undefined
    if (!/^[.1-5]+$/.test(value.placements)) return undefined
    // A digit past the clip list is dangling — a bug or corruption, not data.
    for (const char of value.placements) {
      if (char !== '.' && Number(char) > decoded.length) return undefined
    }
    boop.placements = value.placements
  }

  if (value.gridClip !== undefined) {
    if (typeof value.gridClip !== 'number' || !Number.isInteger(value.gridClip)) return undefined
    if (value.gridClip < 0 || value.gridClip >= decoded.length) return undefined
    boop.gridClip = value.gridClip
  }

  return boop
}

function decodePattern(value: unknown): StoredPattern | undefined {
  if (!isRecord(value) || !Array.isArray(value.rows)) return undefined

  const rows: StoredRow[] = []
  for (const entry of value.rows) {
    if (!isRecord(entry)) return undefined
    const { instrumentId, steps } = entry
    if (typeof instrumentId !== 'string' || typeof steps !== 'string') return undefined
    if (steps.length !== STEPS_PER_PATTERN || !/^[01]+$/.test(steps)) return undefined
    rows.push({ instrumentId, steps })
  }

  const pattern: StoredPattern = { rows }
  if (value.name !== undefined) {
    if (typeof value.name !== 'string') return undefined
    pattern.name = value.name
  }
  if (value.tint !== undefined) {
    if (typeof value.tint !== 'number' || !Number.isInteger(value.tint)) return undefined
    if (value.tint < 0 || value.tint >= TINT_COUNT) return undefined
    pattern.tint = value.tint
  }
  return pattern
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
