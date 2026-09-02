// The main↔worker wire for the off-thread sim (120fps ticket 02). The world
// itself never travels: cells live in a SharedArrayBuffer both sides view, so
// the render loop and the test seam read live state with no copies and no
// choreography. Messages carry only intent (paint, run, step…), and the shared
// status block carries the one datum the render loop polls every frame — the
// revision — without a message round trip.
import { BYTES_PER_CELL, GRID_HEIGHT, GRID_WIDTH } from '../../sim/index.ts'
import type { Spawner } from '../spawners/spawners.ts'

/** Slot index of the sim's revision counter in the shared status block. */
export const STATUS_REVISION = 0
/**
 * A seqlock over the cell bytes: the sim side makes it odd before mutating
 * and even after, so a reader that saw the same even value on both sides of
 * its read knows no write overlapped it. The renderer deliberately ignores it
 * (a one-tick tear on screen is invisible — ADR 0036); `saveScene` must not
 * (a tear in a stored scene is permanent), so `WorldView.readConsistent`
 * validates against this slot.
 */
export const STATUS_WRITE_SEQ = 1
const STATUS_SLOTS = 2

/**
 * The two buffers a world lives in. Shared (worker mode) or plain (the local
 * fallback runs the same core on the main thread) — the core neither knows
 * nor cares, and `Atomics` works on both.
 */
export interface WorldBuffers {
  /** The grid's interleaved cell bytes — `Sim` runs directly over this. */
  cells: ArrayBufferLike
  /** Int32 slots the sim side publishes with `Atomics` — see `STATUS_*`. */
  status: ArrayBufferLike
}

const CELL_BYTES = GRID_WIDTH * GRID_HEIGHT * BYTES_PER_CELL
const STATUS_BYTES = STATUS_SLOTS * Int32Array.BYTES_PER_ELEMENT

export function createSharedWorld(): WorldBuffers {
  return { cells: new SharedArrayBuffer(CELL_BYTES), status: new SharedArrayBuffer(STATUS_BYTES) }
}

export function createLocalWorld(): WorldBuffers {
  return { cells: new ArrayBuffer(CELL_BYTES), status: new ArrayBuffer(STATUS_BYTES) }
}

/** The worker's first message: the buffers to run over. Everything after is `SimWorkerMessage`. */
export interface SimWorkerInit {
  type: 'init'
  world: WorldBuffers
}

export type SimWorkerMessage =
  /** Play/pause — the user's toggle. Painting works in both states. */
  | { type: 'setRunning'; running: boolean }
  /** Tab visibility — hidden pauses ticking without touching `running`,
   * matching the old main-thread loop where a backgrounded rAF stopped and
   * its debt was dropped, not repaid. */
  | { type: 'setVisible'; visible: boolean }
  /** One pointer event's whole footprint (brush × stroke steps), batched:
   * the round trip is longer than a pointer event, so per-cell messages
   * would flood the channel. Indices are `y * GRID_WIDTH + x`, pre-bounded. */
  | { type: 'paintCells'; cellIndices: number[]; species: number }
  /** The full spawner list — spawners are entities owned by the page; the
   * worker only needs them for per-tick emission (spec §7). */
  | { type: 'setSpawners'; spawners: Spawner[] }
  /** Exactly one tick, emission included — the paused-mode step button. */
  | { type: 'step' }
  | { type: 'reset' }
  /** A decoded scene's planes (scene load; the page enters paused itself). */
  | { type: 'restore'; species: Uint8Array; ra: Uint8Array; rb: Uint8Array }
