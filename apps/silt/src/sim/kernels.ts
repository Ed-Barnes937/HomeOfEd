import type { Archetype, MovementApi } from './types.ts'

/** The shape both fluid archetypes share; `Archetype` owns the real types. */
type Fluid = { dispersion: number; move?: number }

/** Whether any of the steps `fluid` would try is open to this cell. */
function canFlow(api: MovementApi, spec: Fluid, dy: number): boolean {
  if (api.canMove(0, dy) || api.canMove(-1, dy) || api.canMove(1, dy)) return true
  return spec.dispersion > 0 && (api.canMove(-1, 0) || api.canMove(1, 0))
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
 * can never skate through something that arrived mid-tick.
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

  // Both directions, like the powder's two diagonals: the coin picks the order,
  // not the opportunity. Giving up after one blocked side would leave a cell
  // that wrote nothing, and its chunk would sleep with the puddle still uneven.
  const along = api.randInt(2) === 0 ? -1 : 1
  if (!spread(api, along, spec.dispersion)) spread(api, -along, spec.dispersion)
}

/** Sideways travel, one validated cell at a time. True if the cell moved. */
function spread(api: MovementApi, dx: number, dispersion: number): boolean {
  for (let step = 0; step < dispersion; step++) {
    if (!api.tryMove(dx, 0)) return step > 0
    // A queued cross-chunk move left the cursor behind; the spread stops at the
    // chunk edge and resumes next tick rather than queuing the same cell twice.
    if (api.deferred) return true
  }
  return dispersion > 0
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
