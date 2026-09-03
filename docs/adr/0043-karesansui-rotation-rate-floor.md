# 0043 - karesansui: a rotation-rate floor on the draw duration

- **Status:** Accepted (2026-09-03, landed with
  `.scratch/a11y-pass/issues/04-karesansui-rotation-cap.md`)
- **Date:** 2026-09-03
- **Related:** `.scratch/a11y-pass/spec.md` §4 (the motion-safety audit);
  [ADR 0020](0020-karesansui-many-pens-model.md) for the planetary
  "many pens" model these rates come out of;
  [ADR 0021](0021-karesansui-minimal-console.md) for the console the speed
  slider lives in. Implemented in
  `apps/karesansui/src/features/garden/carveDuration.ts` and consumed by
  `useRakeLoop.ts`.

## Context

The apps are aimed at home-education communities; some of the children using
them are photosensitive. The a11y audit (2026-09-03) found karesansui's
mechanism bowl to be the one place in the estate where a user-selectable
combination produces motion in flicker territory.

The cause is that the speed slider sets a **duration**, while the number of
revolutions crammed into that duration is set by the **gear train**. At
`speed: 100` the duration floored flat at 1500 ms
(`useRakeLoop.ts`, `1500 + ((100 - speed) / 100) ^ 1.7 * 30000`), and each cog
rolls through its own `fullTurns(ring, [w])` carrier revolutions over that one
progress clock (`engine/garden.ts`, `render/MechRenderer.ts`). Measured over the
whole selectable option space at `speed: 100`, before this change:

| quantity | worst train | rate |
| --- | --- | --- |
| carrier orbit (marble + gear disc translating across the bowl) | ring 120 / wheel 63, 21 turns (tied by ring 96 / wheel 63) | **14.0 rev/s** |
| gear body spin (`rot = -(ring / w) * tt`) | ring 120 / wheel 63 | 26.7 rev/s |
| marble epicycle about its own wheel centre | ring 144 / wheel 52, 13 turns | 15.3 rev/s |

The marble is near-white (`#fff3d8`, `MechRenderer.draw`) inside a mech bowl
whose ground is near-black (`--mech-bowl-bg`, `#3a2c1c` to `#160f09`), so the
14 rev/s case is a bright shape translated across a dark field at 14 Hz. No
WCAG 2.3.1 general-flash breach was *proven* (the marble is
small, well under the 25%-of-viewport test), but 14 Hz sits squarely in the
photosensitive-trigger band and the audience is children. The audit's call was
to remove the risk at source rather than ship a warning.

Two things constrain the fix. Long trains are the interesting patterns, so the
fix must not truncate them; and short trains are the app's "press Play and see
something now" moment, so a 1-to-3-turn train at `speed: 100` must still finish
in ~1.5 s.

## Decision

Extract the duration formula into `carveDuration.ts` and give it a second
floor, proportional to the turns the draw has to spend:

```ts
export const MIN_MS_PER_TURN = 500
duration = Math.max(speedCurveMs(speed), fastestCogTurns(ring, wheels) * MIN_MS_PER_TURN)
```

**`MIN_MS_PER_TURN = 500`**, which bounds the fastest cog's carrier at
`1000 / 500 = 2` rev/s: the tighter end of the spec's "2-3 rev/s" window, chosen
because the headroom under the ~3 rev/s requirement costs nothing that anyone
will notice (the worst train goes from 1.5 s to 10.5 s, and it was never
legible at 1.5 s anyway).

**`fastestCogTurns` is the *fastest cog's* turn count**, `max` of
`fullTurns(ring, [w])` over the train, not `fullTurns(ring, wheels)`. The
train-level value is the pattern-closure LCM and reaches its clamp of 200 for
ordinary multi-cog trains (e.g. ring 96 / wheels [63, 52]), yet nothing in the
mechanism ever spins through it: each cog only rolls its own count. Flooring on
the train-level value would have stretched such a train to 100 s at `speed: 100`
for no safety gain. The two agree for every single-cog train, including the
21-turn worst case the audit measured.

### Alternatives considered

- **Generate the curves from `prettyTurns` (40) instead of `fullTurns` (200).**
  Rejected: `prettyTurns` is not what drives `tMax`, and switching would change
  *what pattern is drawn* rather than how fast, truncating long trains'
  rosettes. The duration floor preserves every pattern exactly.
- **Lower the global speed ceiling.** Rejected: it is the wrong axis. The
  ceiling would have to be set for the 21-turn worst case, so every short train
  would lose its brisk draw to make one long train safe. Tying the floor to the
  train's turn count keeps the two independent.
- **Bound the gear-body spin too.** Not taken, and explicitly sanctioned by the
  ticket ("a carrier bound of 3 rev/s still allows fast body spin ... the body is
  a rotating disc"). Body spin exceeds the carrier by the tooth ratio (up to
  144/24 = 6x); with the floor in place the worst body rate is 9.6 rev/s (ring
  144 / wheel 30, 5 turns in 2500 ms), down from 26.7. A near-rotationally-
  symmetric toothed disc spinning in place reads as shimmer, not as a bright
  shape crossing a dark field.
- **Bound the marble's own epicycle too.** Not taken, but this one is *not*
  settled: see the open question below.

## Consequences

- Worst carrier rate over the whole option space at `speed: 100` drops
  **14.0 -> 2.0 rev/s**; worst body spin 26.7 -> 9.6 rev/s; worst marble
  epicycle 15.3 -> 7.6 rev/s.
- The two trains the audit named, at `speed: 100`: **ring 120 / wheel 63**
  (21 turns) now draws in 10 500 ms - carrier 2.00 rev/s, body 3.81 rev/s,
  epicycle 1.81 rev/s. **Ring 144 / wheel 24** (1 turn) is unchanged at
  1500 ms - carrier 0.67 rev/s, body 4.00 rev/s, epicycle 3.33 rev/s (the floor
  never binds on a 1-turn train; its body spin was already the ratio-6 case).
- Short trains keep their brisk draw: every train of 3 turns or fewer still
  finishes at `speed: 100` in exactly the reference 1500 ms.
- The floor binds only near the brisk end. Nothing changes at or below
  `speed: 50` for any train, and the meditative end stays at ~31.5 s.
- No engine change, no `gears.ts` change, no change to the clearing-rake sweep
  (`CLEAR_DUR`, still 1800 ms, one comb pass), the one-off Clear, or the
  reduced-motion path (which lands the finished pattern instantly and never
  consults a duration).
- `carveDuration.test.ts` pins the behaviour, including a sweep over the actual
  selectable option space (`ringOpts() x wheelOpts()`, and every multiset train
  up to `MAX_GEARS`) asserting no cog exceeds the bound at `speed: 100`. That
  test is the tripwire if someone later widens the option lists or raises the
  speed ceiling.
- The helper now runs `speed` through `clampSpeed` before the `Math.pow`. In
  range this is a no-op; out of range the old expression returned `NaN` for
  `speed > 100`, which would have made `progress` `NaN` and hung the draw.

### Owed: a human visual confirmation

The ticket asked for the constant to be settled by eyeballing the worst trains.
The implementing agent cannot watch an animation, so **500 ms was settled
analytically** from the rate table above rather than visually. The maths bounds
the carrier at exactly 2 rev/s, but "does the ring 120 / wheel 63 draw still
feel alive at 10.5 s?" is a judgement only Ed can make. A visual pass over the
two named trains at `speed: 100` is still owed; if either reads wrong,
`MIN_MS_PER_TURN` is the single knob (higher is calmer and slower) and the
option-space pin will hold either way.

### Open: the marble's epicycle is not covered by the carrier bound

The spec asks that "no orbiting element in the mech bowl visibly exceeds
~3 rev/s". A marble has two motions: it rides the carrier (now bounded at
2 rev/s) *and* it circles its own wheel centre at `f = (ring - w) / w` turns per
carrier turn. The carrier floor pulls that second rate down from 15.3 to
7.6 rev/s, but does not bound it. The worst case is **ring 144 / wheel 30**:
19 epicycle revolutions in 2500 ms = 7.6 rev/s, on a radius of
`offset_max * 30 / 144` = 19.6% of the bowl radius (so a ~39%-of-diameter
circle) at maximum offset. That is the same near-white `#fff3d8` marble the
audit named, not a symmetric disc, so the disc argument does not cover it.

It is left open rather than fixed because **the ticket's two requirements
collide here**. A 3 rev/s epicycle bound demands 1667 ms for a 3-turn train
(ring 120 / wheel 45, 5 epicycle revolutions), which contradicts the ticket's
own acceptance criterion that "a 3-turn train at speed 100 should still finish
in 1.5 s". The ticket resolves the ambiguity in favour of the carrier ("bound
the carrier at <= 2-3 rev/s") and asks for a human eyeball, so the call on
whether 7.6 rev/s at a fifth of the bowl radius is acceptable belongs with Ed,
alongside the visual pass above. If it is not acceptable, the fix is a second
floor keyed on `f * turns` (worst case: ring 144 / wheel 30 stretches from
2.5 s to 6.3 s) plus a decision to relax the 1.5 s short-train criterion to
~1.7 s.
