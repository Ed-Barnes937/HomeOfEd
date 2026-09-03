# 04 - Karesansui: cap the effective rotation rate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §4

At `speed: 100` the carve duration floors at 1500 ms
(`apps/karesansui/src/features/garden/useRakeLoop.ts:183-187`):

```ts
duration: 1500 + Math.pow((100 - configRef.current.speed) / 100, 1.7) * 30000
```

while the curve generator drives rotation from `fullTurns` - capped at 200
(`apps/karesansui/src/features/garden/engine/gears.ts:52-61`), not
`prettyTurns`' legible 40 - via `tMax = 2π * fullTurns`
(`engine/garden.ts:58-59`). The worst selectable train (ring 120 / wheel 63)
packs 21 carrier revolutions into 1.5 s: the marble (near-white `#fff3d8` on
near-black, `render/MechRenderer.ts:135-141` vs `tokens.scss:101`) and the
gear discs orbit at **~14 Hz**, and the gear body spins at ~27 Hz. That is
squarely in photosensitive-trigger territory; the audience is kids, some
photosensitive. Fix it at source so no warning is ever needed.

## Design

Floor the carve duration as a function of the train's turn count, so the
carrier rate is bounded regardless of speed and train:

```ts
const MIN_MS_PER_TURN = 500 // carrier <= 2 rev/s; tune, see below
duration: Math.max(
  1500 + Math.pow((100 - speed) / 100, 1.7) * 30000,
  fullTurns * MIN_MS_PER_TURN,
)
```

- **The requirement, not the constant, is the spec:** no orbiting element in
  the mech bowl visibly exceeds ~3 rev/s at any selectable speed/gear
  combination. The gear *body* spins faster than the carrier by the tooth
  ratio (up to 144/24 = 6x), so a carrier bound of 3 rev/s still allows fast
  body spin - but the body is a rotating disc (self-similar-ish, plus tooth
  aliasing shimmer), while the carrier motion is what translates bright
  shapes across dark background. Bound the carrier at <= 2-3 rev/s and then
  *eyeball the worst train* (ring 120 / wheel 63, and the highest-ratio
  ring 144 / wheel 24) at speed 100 before settling the constant. Record the
  chosen value and the eyeball verdict in the ADR.
- Short trains must keep feeling fast: a 3-turn train at speed 100 should
  still finish in 1.5 s (the floor only binds when `fullTurns` is large).
  That is the point of tying the floor to `fullTurns` rather than lowering
  the global speed ceiling.
- An alternative considered in the audit - generating curves from
  `prettyTurns` (40) instead of `fullTurns` (200) - changes what pattern is
  drawn, not just how fast; it truncates long trains' patterns. Prefer the
  duration floor, which preserves every pattern. If the implementer finds a
  reason to prefer truncation, that is a real decision - stop and ask.
- The clearing-rake loop and clear sweep have fixed durations and are not
  affected; do not touch them.
- Reduced-motion behaviour (instant land, `useRakeLoop.ts:172-181`) is
  untouched.

## Tests

- Unit-test the duration formula directly (extract it if it is inline): at
  speed 100, `fullTurns = 3` gives 1500 ms; `fullTurns = 21` gives
  `21 * MIN_MS_PER_TURN`; at low speed the old formula still dominates.
- A pin over the *actual selectable option space* (`ringOpts() x wheelOpts()`,
  `engine/gears.ts:11-18`): for every combination at speed 100,
  `fullTurns / (duration / 1000) <= 3` (or the chosen bound). This is the
  test that fails if someone widens the option lists later.
- Existing carve/clear iwft tests stay green; if any pins an exact duration
  at high speed for a long train, rewrite it to the new story rather than
  loosening it.

## ADR

Write `docs/adr/NNNN-karesansui-rotation-rate-floor.md` (MADR-lite): the
photosensitivity motivation with the measured 14 Hz worst case, duration
floor vs prettyTurns truncation vs lowering the speed ceiling, the chosen
`MIN_MS_PER_TURN` and the eyeball check that settled it.

## Constraints

- `apps/karesansui` only; `useRakeLoop.ts` (and a small extracted helper +
  its test) should be the whole diff. No engine/gears changes.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter karesansui run test` green
  (use `pnpm --filter`, not `turbo run --filter`).
