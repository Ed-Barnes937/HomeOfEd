# silt-cactus — seeds + sand = cactus

**Status:** approved (Ed, 2026-09-05). Design conversation is summarised here;
decisions that survive the epic land in ADR 0054.

## 1. What this is

The desert biome. Today a seed that lands on sand just rots (seed 15's
lifetime): sand deliberately has no water row, so there is no burial route and
the bed is a dead end. This epic makes sand the third branch of the biome
decision the seed bank already embodies — standing water makes moss, wet soil
makes the meadow plant, and now dry sand makes a cactus: a tall, slow column
that sometimes crowns with a flower, whose flower dies to a falling seed, so
the desert reproduces with no rule saying "reproduce".

**No new seed species.** The bed decides the biome, exactly as `seedBank.ts`
frames it. A meadow flower's seed blown onto a dune becomes a cactus; a
blossom's seed rolling onto mud becomes a meadow plant.

## 2. New species (ids append after 25; pinned, never renumbered)

All follow the grower/product split
([ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md)):

| id | name | role | `ra` | lifetime |
|----|------|------|------|----------|
| 26 | `duned` | the bank: a seed bedded in sand | none (uses `keepAwake`) | none |
| 27 | `nub` | the seedling: spent raising the apex | none | none |
| 28 | `apex` | the grower: climbs on a travelling budget | budget (height + 1) | none |
| 29 | `cactus` | the flesh: inert column, crumbles | engine's | `{ ticks: 200, jitter: 55, every: 32, becomes: null }` (6400–8160 ticks) |
| 30 | `blossom` | the crown: rare, dies to a seed | engine's | `{ ticks: 100, jitter: 50, every: 16, becomes: 'seed', emits: { species: 'petal', min: 1, max: 2 } }` (1600–2400 ticks) |

The invariant carried over from the meadow: **the flesh's minimum lifetime
(6400) must clear the blossom's maximum (2400)** or a crumbling column leaves a
blossom hanging in the air.

`apex` is the roster's **fifth `ra` claimant**, and it is exactly the shape the
byte-ownership rule permits — a grower that never dies, the same split as the
stalk tip. The revisit ritual (ADR 0043 §2.1) is re-run in ADR 0054.

Colours (mass rule: four shades, `colours[0]` is the base; ×1.00/×0.90/×1.08/
×0.96 as everywhere):

- `duned` — a husk darkened into the dune, between sand and seed:
  base `#a98f54`.
- `nub` — a grey-green seedling, duller than the meadow sprout: base `#7fae62`.
- `apex` — **one colour**, like the stalk tip (a single travelling cell):
  `#b7d98a`.
- `cactus` — teal-leaning desert green, distinct from moss's yellow-green:
  base `#3f7d55`.
- `blossom` — desert bloom, four colours (four divides `VARIANT_SLOTS`):
  `['#e86fa4', '#f2c94c', '#f4a1b8', '#f7e08a']`, magenta base.

Tags: `nub`, `apex`, `cactus`, `blossom` are `['solid', 'flammable']`;
`duned` is `['solid']` only (the bank must survive fire, exactly like
`buried`). Everything is hardness 0. All are `static` archetypes.

## 3. Chemistry (reaction rows)

Order is load-bearing, as ever — named rows above the tag rows that cover them.

1. **Burial**: `{ a: 'seed', b: 'sand', p: 0.03, aBecomes: null, bBecomes: 'duned' }`.
   Lower than mud's 0.1: sand is a stingier bed, and the seed's rot clock
   racing a slow burial is the natural attrition that stops every grain of
   sand near a meadow becoming a cactus farm. Safe at the tail of the table —
   nothing above claims the pair.
2. **Fire — the wet-tissue split**: cactus is a water tank, so all four living
   parts steam rather than burn (the flower/sprout precedent). Four named rows
   **above `fire + [flammable]`**, p 0.4, `aBecomes: 'fire'`,
   `bBecomes: 'steam'`, for `nub`, `apex`, `cactus`, `blossom`. Unlike the
   meadow tip (on screen ~30 ticks, kept on the burn ladder), the apex climbs
   for 100+ ticks and steams too. Net effect, and it is deliberate: **fire
   cannot clear a desert** — acid and old age are what remove cacti.
3. **Acid**: four named rows `-> sulphur` at 0.3 (`aBecomes: 'sulphur'`,
   `bBecomes: null`), **above the `[solid]`/`[powder]` tag rows**, joining the
   existing eight literal rows (that block explicitly chose named rows over a
   `plantMatter` tag; follow it). `duned` gets **no row** — spent-material
   treatment like `buried`: the tag rows erase it with no residue.
4. **Water**: nothing. The biome is committed at burial; a rained-on cactus is
   just wet.

## 4. Hooks

- **The sand bank** (`sandBank.ts`, new — ticket 02): simpler than
  `seedBank.ts`, not a third biome inside it. No soak counter, no depth test.
  Roofed by anything (water included) → dormant and **silent** (no write, the
  chunk sleeps; a write within 2 cells wakes it when the roof moves). Open air
  above → `api.keepAwake()` plus a slow draw; on success, set the cell above
  to `nub`, report `witnessGermination(nub)`, and **refund the bed cell as
  sand** (`become(sand)` — nothing is drunk; the desert's cap is seed scarcity,
  not a moisture ledger). Owning no byte, it is the second legitimate customer
  of the public `keepAwake` (the evaporation precedent, ADR 0044).
- **Raise and climb** reuse `createSprout` / `createTip` with cactus ids —
  after ticket 01 parameterises the constants (they are module-level today).
  Cactus numbers: height 10–16 (`min: 10, jitter: 6`), climb p **0.08**
  (saguaro pace vs the stalk's 0.3).
- **"Potentially flowering" is a single terminal draw** — the one thing the
  current machinery cannot express. `createTip`'s terminal transition takes
  `{ flower, cap, flowerP }`: when the budget is spent or the tip is boxed in,
  one draw — `rand() < flowerP` becomes the flower, otherwise the cap species.
  Meadow keeps `flowerP: 1` (behaviour identical); cactus uses
  `flowerP: 0.3, flower: blossom, cap: cactus`. A `lifetime.becomes` cannot do
  it (deterministic — every cactus would flower eventually) and a reaction row
  cannot (no pair).
- **The blossom sheds**: reuse the existing `createShed` hook unchanged.

## 5. Tuning numbers (starting points, measured in ticket 04)

- Burial p 0.03; germination p `0.004 / 4` (half the mud bank's — a desert
  establishes slowly); climb p 0.08; flowerP 0.3; blossom emits 1–2 petals.
- No crowding/spacing gate in v1. The meadow's lesson: the felt density knob is
  never the rate you think it is. Ship simple, measure the way `life.test.ts`
  measures the meadow band, and add a `growth.ts`-style crowding check only if
  the desert reads as a hedge (`CHUNK_MARGIN` = 2 can support one).

## 6. Discovery / field notes

- `chartAs` foldings (in `interactionGraph.ts`'s `CHARTED_AS`): `duned` → seed
  (as `buried` is); `nub`, `apex`, `blossom` → `cactus` (mirroring
  sprout/tip/stalk/petal → flower). `cactus` is the charted element.
- Hook edges declared by hand in the generator, mirroring the existing four:
  the sand germination, the cactus raise, the cactus bloom. The witness sites
  come free from the reused factories, **but check the keys**: the raise/bloom
  witnesses are cursor-read, so they should key on `nub`/`apex` automatically —
  verify, don't assume. If the bloom's two-product terminal needs the witness
  surface to learn a product argument, **stop and raise it** rather than
  guessing.
- New charted elements become rail unlockables automatically (every charted
  non-base element is `unlockable` since discovery ticket 14). Denominators
  recompute; no migration.
- `pnpm --filter silt run graph` regenerated in the same change; the drift
  test gates it.

## 7. Out of scope (deliberately)

- **Arms/branching** — "growing tall" is a column; saguaro arms are their own
  future ticket once the column reads right.
- **Crowding gate** — see §5.
- New iwft tests — no rail/panel behaviour changes; unit + existing suites
  cover it (the pragmatic split).

## 8. Verify

`pnpm --filter silt run lint`, `... run typecheck`, `... run test` all green;
graph regenerated; `apps/silt/CLAUDE.md` roster paragraph updated; ADR 0054
records the decisions (factory parameterisation, the fifth `ra` claimant, the
terminal flower draw, fire-cannot-clear-a-desert, no-drink sand economy).
