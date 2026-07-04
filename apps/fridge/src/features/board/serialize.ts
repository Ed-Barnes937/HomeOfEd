import { snapRotation } from '@hoe/magnet-kit'

import { storedBoardSchema, type StoredBoard } from '../../server/boardSchema.ts'
import { type Finish, type Magnet, sizeFor, type Wall } from './model.ts'

export type { StoredBoard, StoredMagnet } from '../../server/boardSchema.ts'

const STORAGE_KEY = 'fridge:v1'

/** Minimal read/write surface — the caller passes `window.localStorage`. */
type BoardStorage = Pick<Storage, 'getItem' | 'setItem'>

interface StoredState {
  v: 1
  current: StoredBoard
  saved: StoredBoard[]
}

/** Normalise a rotation to [0,360) without reimplementing the engine's maths. */
const normalizeRot = (rot: number): number => snapRotation(rot, 0)

/**
 * The reference's first-ever-load seed (plan §6), minus the dropped word
 * tile: HELLO in palette-cycled letters, a green 3, and two fraction discs.
 * These are the F4 static-scene positions/rotations, now sourced from here
 * instead of hardcoded in FridgePage.
 */
export const SEED_BOARD: StoredBoard = {
  name: '',
  finish: 'mint',
  wall: 'warm',
  magnets: [
    { type: 'letter', label: 'H', color: 'red', deg: 0, x: 285, y: 40, rot: normalizeRot(-4) },
    { type: 'letter', label: 'E', color: 'blue', deg: 0, x: 341, y: 40, rot: normalizeRot(3) },
    { type: 'letter', label: 'L', color: 'green', deg: 0, x: 397, y: 40, rot: normalizeRot(-2) },
    { type: 'letter', label: 'L', color: 'yellow', deg: 0, x: 453, y: 40, rot: normalizeRot(4) },
    { type: 'letter', label: 'O', color: 'orange', deg: 0, x: 509, y: 40, rot: normalizeRot(-3) },
    { type: 'number', label: '3', color: 'green', deg: 0, x: 250, y: 120, rot: normalizeRot(5) },
    { type: 'fraction', label: '', color: 'yellow', deg: 120, x: 505, y: 112, rot: 0 },
    { type: 'fraction', label: '', color: 'blue', deg: 270, x: 580, y: 112, rot: 0 },
  ],
}

/**
 * Runtime → stored. Drops the derived `id`/`w`/`h`/`z` fields, rounds x/y to
 * ints, and normalises rot to [0,360). Sorted by z first, so `fromStoredBoard`
 * reconstructing z from array order preserves the stacking order across a
 * save/load round-trip.
 */
export function toStoredBoard(
  name: string,
  magnets: Magnet[],
  finish: Finish,
  wall: Wall,
): StoredBoard {
  return {
    name,
    finish,
    wall,
    magnets: magnets
      .slice()
      .sort((a, b) => a.z - b.z)
      .map((m) => ({
        type: m.type,
        label: m.label,
        deg: m.deg,
        color: m.color,
        x: Math.round(m.x),
        y: Math.round(m.y),
        rot: normalizeRot(m.rot),
      })),
  }
}

/**
 * Stored → runtime. `w`/`h` are recomputed from `sizeFor` (never trusted from
 * storage); `id`/`z` are recomputed from array order — a malformed/hostile
 * payload can't create absurd boxes or stacking.
 */
export function fromStoredBoard(board: StoredBoard): {
  magnets: Magnet[]
  finish: Finish
  wall: Wall
} {
  const magnets: Magnet[] = board.magnets.map((sm, i) => {
    const { w, h } = sizeFor(sm.type)
    return {
      id: i + 1,
      z: i + 1,
      type: sm.type,
      label: sm.label,
      deg: sm.deg,
      color: sm.color,
      x: sm.x,
      y: sm.y,
      w,
      h,
      rot: sm.rot,
    }
  })
  return { magnets, finish: board.finish, wall: board.wall }
}

/**
 * Reads `fridge:v1`. Unparseable JSON, a wrong/missing version, or a
 * `current` board that fails {@link storedBoardSchema} all fall back to the
 * seed board — this never throws. Invalid entries in `saved` are dropped
 * individually rather than discarding the whole list.
 */
export function loadState(storage: BoardStorage): { current: StoredBoard; saved: StoredBoard[] } {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return { current: SEED_BOARD, saved: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { current: SEED_BOARD, saved: [] }
  }

  if (typeof parsed !== 'object' || parsed === null || (parsed as { v?: unknown }).v !== 1) {
    return { current: SEED_BOARD, saved: [] }
  }

  const record = parsed as { current?: unknown; saved?: unknown }
  const current = storedBoardSchema.safeParse(record.current)
  const savedRaw = Array.isArray(record.saved) ? record.saved : []
  const saved = savedRaw
    .map((b) => storedBoardSchema.safeParse(b))
    .filter((r): r is { success: true; data: StoredBoard } => r.success)
    .map((r) => r.data)

  return { current: current.success ? current.data : SEED_BOARD, saved }
}

export function saveState(storage: BoardStorage, current: StoredBoard, saved: StoredBoard[]): void {
  const state: StoredState = { v: 1, current, saved }
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}
