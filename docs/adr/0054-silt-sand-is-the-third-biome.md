# 0054 — silt: sand is the third biome (seeds + sand = cactus)

- Status: accepted
- Date: 2026-09-05
- Spec: `.scratch/silt-cactus/spec.md`

## Context

A seed that lands on sand rots (seed 15's lifetime): sand deliberately has no
water row (`water + dirt -> mud` is dirt only, ADR-era ruling), so there is no
burial route and sand is the roster's one dead-end bed. The seed bank
(ADR 0043) already frames germination as "the bed decides the biome" — water
makes moss, wet soil makes the meadow plant. The epic adds the dry branch: a
cactus, tall and slow, that sometimes crowns with a flower whose death drops a
seed, closing a desert loop the way the meadow's closes.

## Decisions

### 1. No new seed species — the bed decides

The same seed 15 buries in sand (`seed + sand -> duned`, p 0.03, the mud row's
shape at a stingier rate) and in mud. The seed's rot clock racing the slow
burial is the desert's attrition; no crowding rule is added in v1. The felt
density knob is measured (ticket 04), not guessed — the meadow's lesson
(ADR 0046) that the knob is never the rate you think it is.

### 2. The cactus is the grower/product split, third instance

Five species: `duned` (bank), `nub` (seedling), `apex` (grower), `cactus`
(flesh, crumbles at 6400–8160 ticks), `blossom` (crown, 1600–2400 ticks,
dies to a seed + 1–2 petals). The flesh's minimum lifetime clears the
blossom's maximum — the hanging-flower invariant, as stalk vs flower.

**The apex is the fifth `ra` claimant.** The revisit ADR 0043 §2.1 demands was
re-run: it is exactly the permitted shape — a grower that never dies, the
stalk tip's split verbatim — so the byte holds and the cell does not widen.
The counter-trigger stands unchanged: a claimant that is not a
grower-that-never-dies argues for widening the cell, not for a sixth row in
the CLAUDE.md list.

### 3. The stalk factories are parameterised, not forked

`createSprout`/`createTip` gain options (height, climb rate, and the terminal
draw below) defaulting to the meadow's current constants, so the meadow plant
is bit-identical — including its RNG draw sequence — and the cactus is data:
height 10–16, climb p 0.08.

### 4. "Potentially flowering" is a single terminal draw

`createTip`'s terminal transition takes `{ flower, cap, flowerP }`: one draw
when the budget is spent or the tip is boxed in — flower at `flowerP`, else
inert cap. A `lifetime.becomes` cannot express it (deterministic: every cactus
would eventually flower) and a reaction row cannot (no pair). The meadow keeps
`flowerP: 1` and spends no draw; the cactus blooms at 0.3, which is what makes
a blossom an event.

### 5. Fire cannot clear a desert

All four living cactus parts are wet tissue and steam rather than burn (the
flower/sprout split of ADR 0045, extended): four named `fire + <part> ->
steam` rows above the `[flammable]` fallback. Unlike the meadow tip (~30
ticks on screen, kept on the burn ladder), the apex climbs for 100+ ticks and
steams too. Acid and old age are what remove cacti: four named
`acid + <part> -> sulphur` rows join the existing eight, and `duned` gets the
`buried` treatment — no residue row, fire-proof by the missing tag.

### 6. The sand bank drinks nothing

Germination refunds the bed cell as sand. The mud bank's economy (burial
costs a soil cell, the plant drinks it — ADR 0043/0046) is a moisture ledger;
sand has no moisture to ledger, so the desert's cap is seed scarcity: low
burial p, seed rot, rare flowering. Owning no counter, the bank is the second
customer of the public `keepAwake` (ADR 0044): silent while roofed, awake only
under open sky.

## Consequences

- The rosters's chartAs foldings gain `duned -> seed` and
  `nub`/`apex`/`blossom` -> `cactus`; `cactus` is the charted element and the
  rail unlockable.
- Deferred, deliberately: saguaro arms/branching; a crowding gate (added only
  if the measured band reads as a hedge).
