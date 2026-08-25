import { EMPTY, type Sim } from '../../sim/index.ts'

/**
 * A continuous emitter (spec §7): an entity living outside the cell grid,
 * never encoded as a cell, so scene persistence (ticket 09) can serialise it
 * directly as `{x, y, element}`.
 */
export interface Spawner {
  x: number
  y: number
  element: number
}

/**
 * Emits each spawner's element into its cell. Called once per running tick
 * (spec §7 — emission stops while paused); skips a cell that isn't empty so
 * a spawner never stomps out material that hasn't moved off the source cell
 * yet.
 */
export function emitSpawners(sim: Sim, spawners: readonly Spawner[]): void {
  for (const spawner of spawners) {
    if (sim.speciesAt(spawner.x, spawner.y) === EMPTY) {
      sim.paint(spawner.x, spawner.y, spawner.element)
    }
  }
}

/**
 * Whether a spawner's cell falls inside a centred square brush of this width.
 * Shared by the erase sweep and the overlay's removal highlight, so the chrome
 * can never disagree with what a wipe actually takes. The lopsided `lo`/`hi`
 * split mirrors the brush footprint in `useSimLoop` — every shipped width is
 * odd, but an even one must land on the same cells in both places.
 */
export function isUnderBrush(
  spawner: Spawner,
  centre: { x: number; y: number },
  brushWidth: number,
): boolean {
  const half = (brushWidth - 1) / 2
  const lo = Math.floor(half)
  const hi = Math.ceil(half)
  return (
    spawner.x >= centre.x - lo &&
    spawner.x <= centre.x + hi &&
    spawner.y >= centre.y - lo &&
    spawner.y <= centre.y + hi
  )
}
