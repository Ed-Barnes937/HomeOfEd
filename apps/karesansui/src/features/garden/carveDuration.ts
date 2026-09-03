/**
 * Draw-duration policy for the rake loop: the speed slider's curve with a
 * rotation-rate floor bolted under it. Pure functions, but deliberately *not*
 * in `engine/`: the engine is the garden device's geometry and knows nothing of
 * wall clock, while a duration is animation policy owned by `useRakeLoop`. This
 * sits beside its one caller, like `settings.ts`.
 *
 * The audience includes photosensitive children, so no bright element in the
 * mech bowl may orbit fast enough to read as a flicker. The speed slider alone
 * cannot guarantee that: it maps to a *duration*, while the number of carrier
 * revolutions packed into that duration is set by the gear train. At
 * `speed: 100` the old flat floor of 1500 ms drove the worst selectable train
 * (ring 120 / wheel 63, 21 carrier turns) at ~14 rev/s.
 *
 * The fix is a second floor, proportional to the turns the draw has to spend:
 * at least `MIN_MS_PER_TURN` of wall clock per carrier revolution. Short trains
 * are untouched (a 3-turn train at `speed: 100` still finishes in 1500 ms) and
 * every pattern is still drawn in full. See
 * [ADR 0045](../../../../../docs/adr/0045-karesansui-rotation-rate-floor.md).
 */
import { fullTurns } from './engine/gears.ts'
import { clampSpeed, type GardenConfig } from './engine/state.ts'

/**
 * Minimum draw time per carrier revolution (ms). Settled analytically at 500 ms
 * so the fastest cog's carrier is bounded at `1000 / 500 = 2` rev/s, inside the
 * spec's ~3 rev/s ceiling with headroom (ADR 0045).
 */
export const MIN_MS_PER_TURN = 500

/** The carrier-rate ceiling `MIN_MS_PER_TURN` buys, in revolutions per second. */
export const MAX_CARRIER_REV_PER_SEC = 1000 / MIN_MS_PER_TURN

/** The unfloored speed curve: brisk ~1.5 s to meditative ~31.5 s. */
function speedCurveMs(speed: number): number {
  return 1500 + Math.pow((100 - clampSpeed(speed)) / 100, 1.7) * 30000
}

/**
 * Carrier revolutions the draw actually animates: every cog rolls over its own
 * `fullTurns(ring, [w])` on one shared progress clock (`engine/garden.ts`,
 * `render/MechRenderer.ts`), so the fastest cog sets the rate. Deliberately
 * **not** `fullTurns(ring, wheels)`: that is the train's pattern-closure LCM
 * (up to 200), a count nothing in the mechanism ever spins through.
 */
export function fastestCogTurns(ring: number, wheels: number[]): number {
  return wheels.reduce((most, w) => Math.max(most, fullTurns(ring, [w])), 1)
}

/**
 * How long one draw of `config` should take (ms): the speed curve, floored so
 * the fastest cog cannot exceed `MAX_CARRIER_REV_PER_SEC`. The floor only binds
 * at the brisk end of the slider for long trains; elsewhere the curve wins.
 */
export function carveDurationMs(config: GardenConfig): number {
  const turns = fastestCogTurns(config.ring, config.wheels)
  return Math.max(speedCurveMs(config.speed), turns * MIN_MS_PER_TURN)
}
