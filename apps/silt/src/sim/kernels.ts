import { EMPTY, WALL } from './elements.ts'
import type { Archetype, Fluid, MovementApi } from './types.ts'

function occupied(api: MovementApi, dx: number, dy: number): boolean {
  const cell = api.get(dx, dy)
  return cell !== EMPTY && cell !== WALL
}

/**
 * A stray cell: nothing resting on it and no more of the same liquid beside it.
 *
 * Sideways is the only move with no gravity behind it, and a *body* of liquid
 * needs it — unconditional lateral flow is what levels a pool properly, and
 * every weaker rule tried here left pools mounded like a powder. A lone droplet
 * has no such claim, and it is the one case that misbehaves: ungated it slides
 * a fresh `dispersion` cells every tick forever, so its chunk never sleeps.
 * Stopping strays is therefore the whole gate.
 *
 * `-dy` is "up" for a liquid and "down" for a gas, so this reads upside down
 * for something that rises, which is correct.
 */
function isStray(api: MovementApi, dy: number): boolean {
  const self = api.get(0, 0)
  return !occupied(api, 0, -dy) && api.get(-1, 0) !== self && api.get(1, 0) !== self
}

/** Whether stepping `dx`-ward is both possible and worth doing. */
function wouldSpread(api: MovementApi, dx: number, dy: number): boolean {
  return api.canMove(dx, 0) && !isStray(api, dy)
}

/**
 * Whether any step `fluid` would try is open to this cell. Must stay in step
 * with the kernel below — the sealed-pocket and mid-fall cases in
 * `liquids.test.ts` are what pin the two together.
 */
function canFlow(api: MovementApi, spec: Fluid, dy: number): boolean {
  if (api.canMove(0, dy) || api.canMove(-1, dy) || api.canMove(1, dy)) return true
  if (spec.dispersion === 0) return false
  return wouldSpread(api, -1, dy) || wouldSpread(api, 1, dy)
}

/**
 * Down first; when that is blocked, one diagonal chosen by coin flip so a pile
 * does not lean. `slide` gates the attempt — 0 makes an unmoving heap, 1 the
 * classic falling-sand angle of repose.
 */
function powder(api: MovementApi, slide: number): void {
  if (api.tryMove(0, 1)) return

  // No `slide === 1` short-circuit: the draw happens whenever a grain is
  // blocked below, so retuning slide changes which way grains go but not how
  // much of the RNG stream this branch eats.
  if (api.rand() >= slide) return

  const first = api.randInt(2) === 0 ? -1 : 1
  if (api.tryMove(first, 1)) return
  api.tryMove(-first, 1)
}

/**
 * Liquids and gases are the same kernel run in opposite directions: `dy` is
 * +1 for something that sinks, -1 for something that rises. Down (or up), then
 * a diagonal, then *along* — the third step is what makes a liquid level out
 * instead of piling like a powder.
 *
 * `move` gates the whole step, so lava oozes without needing a velocity field.
 * `dispersion` is walked one validated cell at a time rather than as a single
 * long swap: each step is checked against the world as it stands, so a liquid
 * can never skate through something that arrived mid-tick. The sideways step
 * additionally needs weight above it — see `underPressure`.
 */
function fluid(api: MovementApi, spec: Fluid, dy: number): void {
  if (spec.move !== undefined && api.rand() >= spec.move) {
    // Declining a step is not the same as having nowhere to step. A skipped
    // step writes nothing, so without this the chunk sleeps and the liquid
    // freezes wherever it happened to be — mid-fall, most of the time.
    if (canFlow(api, spec, dy)) api.keepAwake()
    return
  }

  if (api.tryMove(0, dy)) return

  const first = api.randInt(2) === 0 ? -1 : 1
  if (api.tryMove(first, dy)) return
  if (api.tryMove(-first, dy)) return

  if (spec.dispersion === 0) return

  // Both directions, like the powder's two diagonals: the coin picks the order,
  // not the opportunity. Giving up after one blocked side would leave a cell
  // that wrote nothing, and its chunk would sleep with the puddle still uneven.
  const along = api.randInt(2) === 0 ? -1 : 1
  if (!spread(api, along, dy, spec.dispersion)) spread(api, -along, dy, spec.dispersion)
}

/** Sideways travel, one validated cell at a time. True if the cell moved. */
function spread(api: MovementApi, dx: number, dy: number, dispersion: number): boolean {
  if (!wouldSpread(api, dx, dy)) return false

  for (let step = 0; step < dispersion; step++) {
    // The first step is guaranteed by `wouldSpread`; a later one can be blocked
    // by whatever the walk revealed, and the cell has still moved.
    if (!api.tryMove(dx, 0)) return true
    // A queued cross-chunk move left the cursor behind; the spread stops at the
    // chunk edge and resumes next tick rather than queuing the same cell twice.
    if (api.deferred) return true
  }
  return true
}

/**
 * The motion half of the element model — the only code that moves cells.
 * Elements never implement movement; they pick an archetype and hand it
 * numbers.
 *
 * The switch is exhaustive over the closed set of four, so a fifth archetype
 * cannot join the `Archetype` union without its kernel landing here too.
 */
export function applyArchetype(api: MovementApi, archetype: Archetype): void {
  switch (archetype.kind) {
    case 'static':
      return
    case 'powder':
      powder(api, archetype.slide)
      return
    case 'liquid':
      fluid(api, archetype, 1)
      return
    case 'gas':
      fluid(api, archetype, -1)
      return
    default: {
      const exhaustive: never = archetype
      throw new Error(`unhandled archetype ${JSON.stringify(exhaustive)}`)
    }
  }
}
