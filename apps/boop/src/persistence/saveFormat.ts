/**
 * boop's save format — one versioned document holding the working grid and the
 * "My grooves" list (see `apps/boop/CONTEXT.md` for creation / pattern, and
 * [ADR 0025](../../../../docs/adr/0025-boop-save-format.md) for the shape's rationale).
 *
 * Pure: types plus encode/decode over strings. Storage lives in `storage.ts`,
 * scheduling in `autosave.ts`. Decode is total — anything unparseable, mistyped
 * or from a future version degrades to `EMPTY_DOCUMENT` rather than throwing,
 * so a child never meets an error screen (and the share codec, which reuses
 * these creation shapes, inherits the same guarantee).
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

/** One instrument's 16 cells as a bitstring, e.g. `1000100010001000`. */
export interface StoredRow {
  instrumentId: string
  steps: string
}

/**
 * One pattern. An object rather than a bare row array so V2 can add per-pattern
 * fields (repeats, a name) without another version bump.
 */
export interface StoredPattern {
  rows: readonly StoredRow[]
}

/**
 * A creation: a named thing a child made. V1 holds exactly one pattern;
 * chaining several into a song is the confirmed V2 direction, which this list
 * absorbs without a migration.
 */
export interface StoredCreation {
  name: string
  kitId: string
  tempo: number
  patterns: readonly StoredPattern[]
}

/**
 * The whole of boop's stored state. `working` is the autosaved grid — the slot
 * a reload restores — and is deliberately separate from `creations`, the
 * "My grooves" list a child saves into explicitly.
 */
export interface SaveDocument {
  version: number
  working: StoredCreation | null
  creations: readonly StoredCreation[]
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

/** The working grid is unnamed until a child saves it into "My grooves". */
export const WORKING_NAME = ''

/** A creation snapshotting `pattern` and `tempo` under `name`. */
export function creationFrom(kit: Kit, pattern: Pattern, tempo: number, name: string): StoredCreation {
  return {
    name,
    kitId: kit.kitId,
    tempo,
    patterns: [patternToStored(pattern)],
  }
}

/**
 * The creation a grid currently *is* — what the autosave writes and what a
 * share link carries, built the one way so the two can never drift.
 */
export function workingCreation(kit: Kit, pattern: Pattern, tempo: number): StoredCreation {
  return creationFrom(kit, pattern, tempo, WORKING_NAME)
}

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
      : decodeStoredCreation(parsed.working)
  if (working === undefined) return EMPTY_DOCUMENT

  if (!Array.isArray(parsed.creations)) return EMPTY_DOCUMENT
  const creations: StoredCreation[] = []
  for (const entry of parsed.creations) {
    const creation = decodeStoredCreation(entry)
    if (creation === undefined) return EMPTY_DOCUMENT
    creations.push(creation)
  }

  return { version: SAVE_FORMAT_VERSION, working, creations }
}

/**
 * `undefined` means "not a valid creation" — distinct from an absent one.
 * Exported because the share codec decodes the same creation shape out of a URL
 * fragment and must apply exactly these rules (ADR 0026).
 */
export function decodeStoredCreation(value: unknown): StoredCreation | undefined {
  if (!isRecord(value)) return undefined

  const { name, kitId, tempo, patterns } = value
  if (typeof name !== 'string' || typeof kitId !== 'string') return undefined
  if (typeof tempo !== 'number' || !Number.isFinite(tempo)) return undefined
  if (tempo < MIN_BPM || tempo > MAX_BPM) return undefined
  if (!Array.isArray(patterns) || patterns.length === 0) return undefined

  const decoded: StoredPattern[] = []
  for (const entry of patterns) {
    const pattern = decodePattern(entry)
    if (pattern === undefined) return undefined
    decoded.push(pattern)
  }

  return { name, kitId, tempo, patterns: decoded }
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

  return { rows }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
