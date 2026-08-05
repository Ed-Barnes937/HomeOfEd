import type { Archetype, MovementApi } from './types.ts'

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
 * The motion half of the element model — the only code that moves cells.
 * Elements never implement movement; they pick an archetype and hand it
 * numbers.
 *
 * The switch is exhaustive, so `liquid` and `gas` (ticket 06) cannot be added
 * to the `Archetype` union without their kernels landing in the same change.
 */
export function applyArchetype(api: MovementApi, archetype: Archetype): void {
  switch (archetype.kind) {
    case 'static':
      return
    case 'powder':
      powder(api, archetype.slide)
      return
    default: {
      const exhaustive: never = archetype
      throw new Error(`unhandled archetype ${JSON.stringify(exhaustive)}`)
    }
  }
}
