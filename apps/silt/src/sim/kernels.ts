import { EMPTY, WALL } from './elements.ts'
import type { Archetype, Fluid, Grain, MovementApi } from './types.ts'

/**
 * ## The opinion field (ADR 0038)
 *
 * A liquid that owns its `ra` keeps its lateral direction there instead of
 * tossing a coin for it every tick. The packing, all in the one byte:
 *
 * - bit 0 — direction parity: 0 is leftward, 1 is rightward.
 * - bits 1–3 — momentum, 0–7.
 * - bit 7 — seeded. `grid.write` clears `ra`, so 0 means "not seeded yet" (the
 *   convention `applyLifetime` uses); this bit is what stops a cell whose
 *   parity and momentum are both zero from reading as unseeded and re-drawing.
 */
const PARITY = 0x01
const MOMENTUM_MASK = 0x0e
const MOMENTUM_SHIFT = 1
const SEEDED = 0x80

/**
 * Ticks a blocked cell presses on before it will turn around — sandspiel's
 * figure. Long enough that water leans on a wall and the reversal travels back
 * up the current as a wave, rather than every cell flip-flopping in place.
 */
export const MOMENTUM_TICKS = 6

/** Always seeded: an opinion that reads as 0 is an opinion that gets re-drawn. */
export function packOpinion(parity: number, momentum: number): number {
  return SEEDED | (parity & PARITY) | ((momentum << MOMENTUM_SHIFT) & MOMENTUM_MASK)
}

export function parityOf(ra: number): number {
  return ra & PARITY
}

export function momentumOf(ra: number): number {
  return (ra & MOMENTUM_MASK) >> MOMENTUM_SHIFT
}

/** The eight cells contagion may recruit from. */
const AROUND: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

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
 *
 * It still asks about **both** sides under the opinion field, where the cell
 * only ever tries one. That is deliberate: a cell whose parity points at a wall
 * with its other side open does have a step available, one bump away, and this
 * is only ever consulted on a tick the liquid declined to act on — so answering
 * "no" there would let the chunk sleep on a puddle that has not levelled.
 */
function canFlow(api: MovementApi, spec: Fluid, dy: number): boolean {
  if (api.canMove(0, dy) || api.canMove(-1, dy) || api.canMove(1, dy)) return true
  if (spec.dispersion === 0) return false
  return wouldSpread(api, -1, dy) || wouldSpread(api, 1, dy)
}

/**
 * Whether any step the powder kernel would try is open to this grain. Must stay
 * in step with the kernel below, and is only ever consulted on a tick a slow
 * powder declined to act on - answering "no" while a step is available would let
 * the chunk sleep on a grain still in mid-air. `slide: 0` never looks sideways,
 * so for such a powder a blocked cell below really is nowhere to go.
 */
function canFall(api: MovementApi, slide: number): boolean {
  if (api.canMove(0, 1)) return true
  if (slide === 0) return false
  return api.canMove(-1, 1) || api.canMove(1, 1)
}

/**
 * Down first; when that is blocked, **one** diagonal chosen by coin flip — the
 * coin picks the direction, not the order, so a grain whose only way out is the
 * side the coin missed stays put this tick and draws again next.
 *
 * That stickiness is what makes sand avalanche as a granular flow rather than
 * drain like a liquid. It does *not* change the settled angle of repose, which
 * is geometric — at `slide: 1` a grain slides whenever its downhill diagonal is
 * open, so halving the rate delays the slide without moving the angle. A poured
 * cone comes out identical either way; a collapsing column takes about 2.2× as
 * long to settle. Measurements in ADR 0039.
 *
 * `slide` gates the attempt — 0 makes an unmoving heap, 1 the classic
 * falling-sand angle. Under the one-diagonal rule a one-sided notch is escaped
 * with probability `slide × 0.5` per tick rather than `slide`.
 */
function powder(api: MovementApi, spec: Grain): void {
  const { slide, move } = spec

  // `move` gates the whole step, exactly as it does for a fluid: a petal is
  // sand's kernel taken one tick in four, which is a slow *powder* rather than
  // the pooling a slow liquid would give it. Undefined for every powder on the
  // roster, so none of them draws here at all and the RNG stream is unmoved.
  if (move !== undefined && api.rand() >= move) {
    if (canFall(api, slide)) api.keepAwake()
    return
  }

  if (api.tryMove(0, 1)) return

  // No `slide === 1` short-circuit: the draw happens whenever a grain is
  // blocked below, so retuning slide changes which way grains go but not how
  // much of the RNG stream this branch eats.
  if (api.rand() >= slide) return

  const dx = api.randInt(2) === 0 ? -1 : 1
  if (api.tryMove(dx, 1)) return

  // A wasted coin writes nothing, so the chunk would sleep with the grain
  // frozen mid-notch and it would never get its next draw. Sandspiel has no
  // chunk sleeping and never meets this; the liquid kernel above solves the
  // same problem the same way.
  if (api.canMove(-dx, 1)) api.keepAwake()
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
 *
 * Only the *lateral* step differs between the two liquid behaviours:
 * `useOpinionField` picks the direction from `ra` rather than from a coin.
 * Falling and the diagonals are the same either way.
 */
function fluid(api: MovementApi, spec: Fluid, dy: number, useOpinionField: boolean): void {
  if (spec.move !== undefined && api.rand() >= spec.move) {
    // Declining a step is not the same as having nowhere to step. A skipped
    // step writes nothing, so without this the chunk sleeps and the liquid
    // freezes wherever it happened to be — mid-fall, most of the time.
    if (canFlow(api, spec, dy)) api.keepAwake()
    return
  }

  // Momentum steers the fall (ADR 0041): a cell whose last act was a successful
  // lateral spread falls diagonally in its parity direction, spending one
  // momentum per step, and only falls straight once the counter is empty or the
  // diagonal is blocked. Fresh paint has `ra === 0` and settled interiors have
  // momentum 0, so the pour stream still falls straight; the only cells that
  // arc are the ones stripped off a plateau's top layer, thrown clear of its
  // vertical face instead of curtaining down it, which is what lets a poured
  // block shed from three surfaces instead of one. `tryMove` draws no
  // randomness, so the branch costs nothing from the RNG stream on success.
  if (useOpinionField) {
    const packed = api.ra
    const momentum = momentumOf(packed)
    if (packed !== 0 && momentum > 0) {
      const along = parityOf(packed) === 0 ? -1 : 1
      if (api.tryMove(along, dy)) {
        api.ra = packOpinion(parityOf(packed), momentum - 1)
        return
      }
    }
  }

  if (api.tryMove(0, dy)) return

  const first = api.randInt(2) === 0 ? -1 : 1
  if (api.tryMove(first, dy)) return
  if (api.tryMove(-first, dy)) return

  if (spec.dispersion === 0) return

  if (useOpinionField) {
    lateralOpinion(api, dy, spec.dispersion)
    return
  }

  // Both directions: the coin picks the order, not the opportunity. Giving up
  // after one blocked side would leave a cell that wrote nothing, and its chunk
  // would sleep with the puddle still uneven. The powder kernel takes the other
  // road — one diagonal and a `keepAwake` (ADR 0039) — because a wedged grain
  // *should* stick, where an uneven puddle should not.
  const along = api.randInt(2) === 0 ? -1 : 1
  if (!spread(api, along, dy, spec.dispersion)) spread(api, -along, dy, spec.dispersion)
}

/**
 * The lateral step for a liquid that owns its `ra` — sandspiel's water, three
 * stacked mechanisms in one byte (ADR 0038):
 *
 * 1. **Persistence.** The parity is the direction, kept between ticks. The cell
 *    commits to it: unlike the coin above, it does *not* then try the other
 *    side this tick, which is what makes a body of liquid flow as a current
 *    rather than as a fog of independent per-cell decisions.
 * 2. **Contagion.** Every successful step hands the direction to one random
 *    neighbour of the same species, so an opinion spreads as a majority vote.
 * 3. **Momentum.** A successful step refills a counter; a blocked cell spends
 *    one tick of it at a time and turns around only once it is empty. Without
 *    it a cell at a wall flip-flops every tick and no current survives contact.
 *
 * The stray gate comes first, before even the seed, so a lone droplet writes
 * nothing at all and its chunk is still free to sleep.
 */
function lateralOpinion(api: MovementApi, dy: number, dispersion: number): void {
  if (isStray(api, dy)) return

  let packed = api.ra
  if (packed === 0) {
    // Fresh liquid: `grid.write` cleared the byte, so without a draw here every
    // cell of a pour would share one parity and the whole thing would lean.
    packed = packOpinion(api.randInt(2), 0)
    api.ra = packed
  }

  const parity = parityOf(packed)
  const along = parity === 0 ? -1 : 1

  if (spread(api, along, dy, dispersion)) {
    // `spread` carried the cursor to the cell's new home — or left it behind on
    // a queued cross-chunk move, in which case this writes the cell that is
    // about to leave. Either way it is the same cell's byte, and a deferred
    // move carries all four of them.
    api.ra = packOpinion(parity, MOMENTUM_TICKS)
    recruitNeighbour(api, parity)
    return
  }

  // Blocked. Spend a tick of momentum; with none left, turn around if there is
  // anywhere behind to turn into. Both branches write `ra`, which is also what
  // keeps the chunk awake while the counter runs down. A cell boxed in on both
  // sides with an empty counter writes nothing and is free to settle.
  const momentum = momentumOf(packed)
  if (momentum > 0) {
    api.ra = packOpinion(parity, momentum - 1)
  } else if (api.canMove(-along, 0)) {
    api.ra = packOpinion(parity ^ PARITY, 0)
  }
}

/**
 * Opinion contagion: give this cell's direction to **one** random neighbour of
 * the same species, keeping whatever momentum that neighbour had. One rather
 * than all eight is what makes the field organise like a vote instead of
 * snapping. The write goes through the grid, so it marks the neighbour's chunk
 * dirty — a flowing body keeps itself awake this way.
 */
function recruitNeighbour(api: MovementApi, parity: number): void {
  const [dx, dy] = AROUND[api.randInt(AROUND.length)]!
  if (api.get(dx, dy) !== api.get(0, 0)) return
  api.setRaAt(dx, dy, packOpinion(parity, momentumOf(api.raAt(dx, dy))))
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
 *
 * `raIsFree` says whether this element has left `ra` unclaimed — an element
 * with a `lifetime` has the engine's countdown in that byte, and the liquid
 * kernel's opinion field would corrupt it. Such a liquid degrades to the coin
 * flip rather than misbehaving (ADR 0038).
 */
export function applyArchetype(api: MovementApi, archetype: Archetype, raIsFree: boolean): void {
  switch (archetype.kind) {
    case 'static':
      return
    case 'powder':
      powder(api, archetype)
      return
    case 'liquid':
      fluid(api, archetype, 1, raIsFree)
      return
    case 'gas':
      // Liquids only (ADR 0038). A rising plume disperses rather than pooling,
      // so there is no body for an opinion to organise — and both gases in the
      // roster spend `ra` on a lifetime anyway.
      fluid(api, archetype, -1, false)
      return
    default: {
      const exhaustive: never = archetype
      throw new Error(`unhandled archetype ${JSON.stringify(exhaustive)}`)
    }
  }
}
