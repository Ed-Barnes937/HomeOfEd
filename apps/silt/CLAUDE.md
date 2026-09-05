# apps/silt — scoped rules

A falling-sand cellular-automaton playground at `silt.homeofed.com`.
**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
client-side simulation, scenes in `localStorage`, nothing server-owned.
Scaffolded from `templates/starter`
([ADR 0007](../../docs/adr/0007-reference-starter-app.md)). Spec:
`.scratch/sand-sim/spec.md` (v1) and `.scratch/silt-materials/spec.md`
(materials); tickets in `.scratch/silt/` and `.scratch/silt-materials/`. Every
effort since carries its own spec and tickets under `.scratch/silt-*/` - most
recently `.scratch/silt-life-followup/` (the seed bank, the land plant, the water
cycle and the density tuning that closed it).

The whole app is one route. There is no data-fetching frontend path at all —
the world lives in the browser, so the backend surface is `/health` plus the
starter's `greeting` procedure, kept only as the layered-DI seam later server
features would slot into:

```
HomePage → useSimLoop → SimHost + Renderer  (the app; the sim ticks in a
         → useScenes  → SceneStore           worker over shared memory —
router → GreetingHandler → ctx.auth          ADR 0036; scenes: localStorage)
```

## Layout

```
src/
  sim/              the simulation engine — headless, DOM-free, worker-ready
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    handlers/       Handler classes — business logic, AppContext only, no Store
    router.ts       tRPC router; createTRPC<void>() (no Store); exports AppRouter
    simulator.ts    backendSimulator wiring: real router, no Store, no PGlite
    main.ts         prod entrypoint: createAppServer + shallow /health
    headers.ts      COOP/COEP on every response — cross-origin isolation for
                    the sim worker (ADR 0036); dev and CT serve the same pair
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/            HomePage — the rail, header, status bar, selection state
  hooks/            useArmedConfirm (two-click confirms), useSiltHotkeys (the
                    global keydown map, given the actions it dispatches),
                    useMobileLayout (the $mobile breakpoint in JS - for the
                    handful of *numbers* a media query cannot hand a component;
                    CSS is still the default answer)
  features/         palette/ (the base paintable roster + brush widths, and
                              EarnedElements - the rail's one EARNED control,
                              where mastered unlockables live so the 1-9 hotkeys
                              and the rail's length never move; earnedAnchor -
                              the pure arithmetic placing its popover beside the
                              control and inside the viewport)
                    render/  (letterboxFit, the grid palette — 256 species ×
                              `VARIANT_SLOTS` variant slots, indexed by
                              `paletteSlot` from both frame paths and by the
                              same arithmetic in the shader (ADR 0040) — the
                              WebGL2 renderer +
                              the Canvas 2D fallback and createRenderer picking
                              between them, WorldOverlay — the chrome drawn
                              over the canvas)
                    sim/     (useSimLoop — the render loop, pointer painting,
                              DPR fit; simHost — worker vs main-thread hosting
                              behind one seam; simWorkerCore — the ticking
                              brain, vitest-covered; simWorker — the entry
                              glue; simProtocol — messages + shared buffers.
                              ADR 0036)
                    spawners/(continuous emitters — entities, not cells)
                    scenes/  (sceneCodec: pure format; sceneStore: localStorage +
                              quota; useScenes: page state; the popover)
                    fieldNotes/ (edgeKeys - the canonical edge-key codec, incl.
                              witnessedKey, the single place a sim witness
                              event becomes a key; a leaf module so the worker
                              can import it. entries - the discovery metagame's
                              shared brain: the one involves() predicate, tiers
                              and the witnessed-set derivations, built off
                              src/docs's graph, never a second derivation from
                              the registry. Both pure. fieldNotesStore -
                              localStorage, one global key, edges only;
                              fieldNotesView - the pure derivation the panel
                              renders; useFieldNotes - the page's single seam,
                              React wiring over those two. panelModel - the
                              picker rows and one element's ring as data, incl.
                              the masking every rendered name goes through,
                              the allowlist deciding which sim tags a player
                              ever reads, the reading line's recipe for the
                              active spoke (ticket 25), the footer key's rows, and
                              `strokeOf` - the one place a line kind becomes a
                              stroke, so a spoke and its sample in the key
                              cannot disagree; ElementTile - *the* tile helper,
                              hex + archetype in, every tile in the feature out;
                              elementAppearance - name -> hex/shape and name ->
                              raw tags, both off the
                              registry; FieldNotesButton (the header chip) and
                              FieldNotesPanel (overlay + phone sheet); moments -
                              the cards, derived as a *diff of two views*, with
                              useMoments owning their timing and MomentCard
                              drawing them over the world.
                              `.scratch/silt-discovery-tree/spec.md`)
  docs/             interactionGraph - derives the element graph from the live
                    registry and renders docs/interaction-graph.md; pure, so the
                    drift test can regenerate and compare
  testing/          IwftApp harness (in-browser backend) + iwft fixture + SiltPagePom
  *.iwft.tsx        whole-frontend tests: render (paint/canvas), blit (WebGL↔2D
                    pixel parity + the env-gated blit bench), chrome, scenes,
                    spawners, mobile
vite.config.ts      react + simulatorPlugin (dev simulator mode) + COOP/COEP
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3109, crossOriginIsolated: true })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, `drizzle.config.ts`, or
`@hoe/db` dependency — a stateless app has none of these.

## The simulation engine (`src/sim/`)

Pure TypeScript, no DOM, no `Math.random()` — see `.scratch/sand-sim/spec.md` §5–6.

```
constants.ts  GRID_WIDTH/HEIGHT (300×200, build-time), cell byte offsets, tick rate,
              CHUNK_SIZE / CHUNK_MARGIN (tunables, not commitments)
types.ts      ElementDef / Archetype / Api / Lifetime / Emission / SetOptions /
              ReactionRow
elements.ts   pinned species ids + the roster (dirt, sand, water, lava, obsidian,
              wood, oil, fire, smoke, steam, acid, stone, sulphur, mud, seed,
              moss, vine, ember, ash, buried, sprout, tip, stalk, flower,
              petal) and v1Reactions - config plus six hooks. Everything
              that forms a mass declares four shades rather than one, picked
              per cell by `rb` (ADR 0040); `colours[0]` is the base, because the
              rail reads it. The three gases stay flat. Gas densities
              read backwards: `canDisplace` is `mine > theirs`, so the gas
              closest to zero rises highest. Reaction row order is load-bearing:
              a specific pair must precede any tag row covering it (acid + wood
              **and the eight `acid + <plant>` rows behind it**, above acid's
              `[solid]`/`[powder]` pair; the `fire + <fuel>` ignition ladder
              above `fire + flammable`; and `lava + wood` above
              `lava + flammable`). Acid leaves **sulphur** on everything living
              it eats - wood and all eight plants - and nothing on ember, ash or
              buried, which are spent material; it has **no row against water at
              all**, so the two coexist and density decides the layering
              ([ADR 0050](../../docs/adr/0050-silt-acid-corrodes-living-matter-and-lets-water-be.md),
              which supersedes the materials spec on both counts). Wood never becomes fire
              directly - it chars to ember, which creeps, erupts, is doused
              back to wood, or is burned down to ash, which rain wets to mud
              and a seed regrows (ADR 0042). Fire drying a bed leaves **steam**,
              not smoke, so a wildfire rains on its own ashes, and a burning
              plant splits by wetness rather than by a probability the engine
              cannot express - stem and tip burn, sprout and flower steam
              ([ADR 0045](../../docs/adr/0045-silt-the-water-ledger.md)). A seed
              on wet soil no longer
              sprouts on contact - it buries (`seed + mud -> buried`, p 0.1),
              because one row per pair cannot both sprout and bury (ADR 0043).
              A withering flower leaves a seed where it stood and throws 3-4
              petals clear (`lifetime.emits`); a petal is a slow floating powder
              that strikes back into a seed on wet soil (p 0.01) and, as garnish,
              on water (p 0.001). A loose seed rots after 1280-2000 ticks - the
              buried one does not, and that is why they are two species
growth.ts     the roster's first `onTick`: moss and vine grow into water, up
              first, capped per cell by a branch count kept in `ra` and bounded
              overall by refusing any cell that already touches two plants
seedBank.ts   the second `onTick`: a buried seed soaks (counter in `ra`), sleeps
              while roofed, and germinates once the sky above it opens - moss if
              2 cells of water have stood over it for 120 continuous ticks,
              otherwise the land sprout. The soil cell is refunded as dirt,
              never mud: the plant drank it. See
              [ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md)
stalk.ts      hooks three and four, the land plant: a sprout raises a stalk tip
              into empty air (never into water) and is spent becoming the base
              of the stem; the tip climbs at p 0.3 on a travelling energy budget
              in `ra`, leaving inert stalk behind, and blooms when the budget
              runs out or when it is boxed in. Stem and flower are the products
              and both crumble - a meadow of immortal columns silts up (ADR 0043).
              **The flower's 1200-2400 tick life is the meadow's density knob,
              not `GERMINATE_P`**: a plant drinks a cell of soil to exist, so a
              bed of N cells pays for N plants however fast they come, and the
              standing crown count is a plant's lifetime over the window.
              Raising germination alone spends the bed sooner (measured: 33-41
              crowns by tick 2000, 0-3 by 12,000). The stem's countdown has to
              stay above the flower's or a crumbling stalk leaves a flower
              hanging (life ticket 06)
petals.ts     the fifth `onTick`, and the smallest: a living flower sheds a petal
              at p 0.005 a tick. The *death* drop is not a hook - `onTick` never
              runs on the tick a lifetime expires, so the engine scatters the
              brood (ADR 0043 §4). The one hook needing no keep-awake write: the
              flower's own countdown already writes every tick
evaporation.ts the sixth hook, and the only one on an element that was always
              here: a one-cell film of water - open air above, something other
              than water below - **dries to nothing**, and it is the one rule in
              the table that spends water outright rather than moving it (Ed's
              feel ruling; it lofted steam until 2026-09-03 and the ambient plume
              read as noise). A pond and a level two-deep pool
              have no film anywhere in them, so both are permanent by
              construction; steam overhead counts as "not open air", which is the
              humidity brake - still load-bearing, because the quench and the
              wet-biomass rows are untouched and still raise real plumes. The one
              hook owning no byte, and so the one that
              made `keepAwake` public
              ([ADR 0044](../../docs/adr/0044-silt-thin-film-evaporation.md) §6)
emit.ts       emitInto - scattering a brood into the empty cells around one cell,
              shared by `lifetime.emits` and the shedding hook. Displaces
              nothing, so a crowded flower simply sheds fewer
registry.ts   createRegistry — boot-time validation; refuses a bad roster. Also
              flattens the tag-keyed reaction table into an id-pair lookup
grid.ts       one ArrayBuffer, interleaved { species, ra, rb, clock } per cell;
              also the one chokepoint keeping chunk dirty rects + counts true
chunks.ts     Chunk / ChunkMap — two dirty rects swapped at frame end, 2-cell
              margin, filled-cell count; `all` is the fixed row-major order
moves.ts      DeferredMoves — the cross-chunk move queue and its PRNG tie-break
api.ts        CellApi — the chunk-relative (dx, dy) surface, one reused cursor
kernels.ts    applyArchetype — the only code that moves cells. Liquids keep
              their lateral direction, momentum and seeded flag packed in `ra`
              (the "opinion field", ADR 0038) instead of re-rolling a coin, and
              a liquid still carrying momentum falls diagonally in its parity
              direction rather than straight down (ADR 0041); a blocked powder
              tries one random diagonal, not both (ADR 0039). Powders take the
              same optional `move` throttle as fluids, so a petal can be a slow
              powder rather than a pooling liquid (life ticket 01)
lifecycle.ts  applyReactions / applyLifetime — what happens to a cell after it
              has moved; neither moves anything. `lifetime.every` makes the
              countdown coarse - the byte counts draws, not ticks, so a life
              longer than 255 ticks fits; the phase is the world's tick, so
              `jitter` (coarse too) is the only thing spreading a cohort out.
              `lifetime.emits` is the death drop: `becomes` rewrites the dying
              cell, `emits` scatters a brood into the free cells around it,
              because a product has no way to act on its own death (ADR 0043 §4)
sim.ts        the world: chunk scan order, the clock guard, paint/tick
loop.ts       FixedTimestep — the tick rate, decoupled from any render loop
witness.ts    the discovery recorder - flat already-seen tables indexed by
              species id and by a packed species pair, fed from the
              transmutation sites (a reaction applying, a decay with a product,
              and the hooks' own reports: growth's `set`, the seed bank's
              germination, the sprout's raise, the tip's bloom - ticket 07) and
              drained as rare, name-carrying events. Owned by the sim core so
              both hosts get it; it never draws from the `Rng` and never
              touches a cell
```

Engine decisions that are not in the spec are in
[ADR 0028](../../docs/adr/0028-silt-simulation-engine.md).

Rules that are easy to break by accident:

- **Archetypes own movement, hooks own transmutation.** An element that needs
  new *motion* is a bug against the archetype set (closed at four, held closed
  by an exhaustive switch), not a new hook. Reactions are rows in the table, not
  element code.
- **Per-cell order is movement → reactions → lifetime → `onTick`**, each gated
  on the last, so an element's code never runs on a cell it no longer is.
- **A cell that should keep acting must write, or call `api.keepAwake()`.**
  Chunk sleeping is driven by writes, so a `move` probability that does not come
  up would otherwise freeze a liquid in mid-air, and a powder that drew the one
  diagonal it could not take would sit frozen in its notch (ADR 0039). The
  judgement is whether *this* cell still has business next tick — declining a
  step is not the same as having nowhere to step. Not every decline qualifies:
  the liquid kernel's stray gate deliberately lets a lone droplet settle
  ([ADR 0038](../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md)).
- **No `Math.random()` under `src/sim`.** Randomness comes from the sim's `Rng`
  via `api.rand()` / `api.randInt()`; the determinism test guards this.
- **`Api` is `(dx, dy)`-relative only**, never absolute — chunked iteration
  depends on it. Out of bounds reads the WALL sentinel.
- **Chunking must not touch determinism.** The two traps: cross-chunk
  destination contention is broken by `rng.randInt`, never by arrival order,
  and chunk order is a row-major array indexed arithmetically — never a `Map`.
- **Chunk sleeping and the clock guard.** Sleeping cells go unstamped, so each
  tick opens by re-stamping everything it is about to scan with the settled
  clock. Drop that pass and the 256-tick byte wrap starts skipping cells.
- **`Grid.stamp` must never mark a chunk dirty** — it runs on every occupied
  cell each tick, so nothing would ever sleep.
- **Byte ownership**: `lifetime` owns `ra` (engine-managed — an element never
  writes it; `0` means "not seeded yet"), colour variant owns `rb` — **seeded at
  birth, preserved by `restore`**: `Grid.write` takes the variant as an argument
  and `Sim.paint` / `CellApi.set` / `CellApi.become` each pass a fresh
  `randInt(256)`, so a transmuted cell does not fall back to variant 0; only
  `Sim.restore` takes the default, because it puts the saved plane back straight
  after. No element writes it either.
  [ADR 0040](../../docs/adr/0040-silt-colour-variants-in-rb.md).
  The one exception to the clearing of `ra` is `CellApi.set` / `Sim.paint`'s
  optional `{ ra }` (life ticket 01) - how a travelling per-cell budget reaches
  the cell a hook creates, and how a built scene pre-ages its cells. `rb` still
  reseeds, and seeding `ra` on a species that declares a `lifetime` throws at
  the call site (`requireRaIsFree`): the registry cannot see it at boot, since
  which species a hook seeds is known only when it seeds it. That guard bites on
  seed 15 since life ticket 04 gave it one - a built scene cannot pre-age a loose
  grain, only the plants that own their byte.
  New per-cell fields are parallel grids; the cell never widens past 4 bytes. There are
  **four exceptions, all conditional on the element declaring no `lifetime`**,
  and none can collide: the claim is per *species*, and a cell is one species
  (ADR 0043):
  - **The growth hook** (`growth.ts`): moss and vine hold their branch count in
    `ra`. Giving either a lifetime hands the byte back and uncaps growth.
    [ADR 0035](../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md) §3.
  - **The liquid opinion field** (`kernels.ts`): a liquid keeps its lateral
    direction, momentum and seeded marker in `ra` — bit 0, bits 1–3, bit 7.
    Unlike growth this one is *enforced*, not just documented: the scan passes
    `applyArchetype` a `raIsFree` flag, so a liquid that declares a lifetime
    degrades to the old coin flip instead of corrupting its countdown.
    [ADR 0038](../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md).
  - **The seed bank** (`seedBank.ts`): a buried seed holds its soak counter in
    `ra`, which is why the seed is *two* species - a grain that falls and burns,
    and a buried one that counts and cannot. Every living thing this epic adds
    splits the same way, into a grower that owns the byte and a product that
    expires.
    [ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md).
  - **The stalk tip** (`stalk.ts`): the tip holds its travelling energy budget in
    `ra` - height + 1, so 1 is spent and 0 (unseeded) blooms on the spot rather
    than climbing forever. Same split as the seed: the tip grows and cannot die,
    the stalk behind it expires and cannot grow.
    [ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md) §2.1.

  This entry and the comments at all four sites are summaries of those ADRs, so
  a change to the rule belongs in the ADR first. The **fourth** claimant was the
  trigger to revisit the byte itself; the revisit is ADR 0043 §2.1 and it held.
  The next one fires the same way - and it is not about the count: a claimant
  that is anything other than a grower which never dies is the argument for
  widening the cell rather than for adding a row here.
- **`Api` reaches a neighbour's `ra` nowhere; `MovementApi` does.** `raAt` /
  `setRaAt` exist for the liquid kernel's opinion contagion and are engine-only
  on purpose (`keepAwake` no longer is - see the next rule) - an element hook
  scribbling on another cell's engine-owned byte is the failure mode the
  ownership rule exists to prevent.
- **The witness recorder is off to the side of the simulation.** It records a
  flag and nothing else, and never draws from the `Rng` - which is why the
  determinism test is the assertion that guards it. A hook reports its own
  transmutation through `Api.witnessGrowth()` and its ticket-07 siblings
  (`witnessGermination(product)` - the argument because one site decides two
  entries - and the cursor-read `witnessRaise()`/`witnessBloom()`, called
  before `become`), the only things on that surface that are not simulation;
  reactions and decay the engine sees for itself. Discoveries reach the page as a `simProtocol` message (rare events, so
  no shared-buffer slot to poll), and a `Sim` keeps what it has witnessed across
  `clear`/`restore` - resetting the world does not reset discovery.
  [ADR 0048](../../docs/adr/0048-silt-discovery-witness-in-the-sim-core.md).
- **A cell that must go on acting has to write, or say so.** Chunk sleeping is
  driven by writes, so a hook that must keep being offered a draw either rewrites
  a byte it already owns or calls `api.keepAwake()` - `growth.ts` writes `ra`
  every tick it has water to reach, because settled water writes nothing and the
  chunk would sleep under the plant, `seedBank.ts` writes its soak for the same
  reason, and the stalk tip re-states its budget on any tick its climb draw
  misses. Each of those three writes a byte it already owns, and the rule was
  that **a hook that would have to write a byte it otherwise has no use for is
  the trigger to promote a real `keepAwake` onto `Api`** (life spec §8) - which is
  why the sprout raises its tip with no probability at all rather than drawing
  for it. **That trigger has now fired**: `evaporation.ts` lives on water, whose
  `ra` is the *enforced* liquid opinion field, so it has no byte to disguise a
  write in and `keepAwake` is public
  ([ADR 0044](../../docs/adr/0044-silt-thin-film-evaporation.md) §3). It stays
  judgement rather than a convenience: the question is whether *this* cell still
  has business next tick. A film that declined its draw does; a pond surface,
  which is not a film at all, does not - and calling it there would hold every
  pond in the world awake for ever. The mirror image matters as much: a *dormant*
  buried seed, a roofed sprout and a roofed film write nothing at all, which is
  what lets the bed under a crowded meadow sleep.
- **`CHUNK_MARGIN` is fully spent.** The crowding check in `growth.ts` reads two
  cells out (the candidate is one away, its neighbours one past that), and the
  seed bank's depth test reads exactly two up - both are exactly the margin. A
  write wakes every chunk within two cells of it, so nothing is missed, but
  there is no slack left. A hook that needs a third cell
  needs the margin raised in the same change. See
  [ADR 0035](../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md).
- **Species ids are pinned**, but scenes remap by *name*: the envelope's
  `elements` table records what each byte meant, so renumbering an id is safe
  and renaming an element silently empties those cells (with a warning).
- **Latest-value refs sync in a `useEffect`, never during render.** A
  long-lived listener (keydown handler, RAF loop) that needs current React
  values without re-binding reads them off a ref; that ref is written from one
  `useEffect` (no dependency array, syncing every value it owns), not
  `ref.current = x` inline in the render body — the render-phase form misbehaves
  under concurrent rendering and StrictMode double-invocation (ticket 15).

## Scene persistence (`src/features/scenes/`)

Spec §8; the calls the spec leaves open are in
[ADR 0029](../../docs/adr/0029-silt-scene-persistence.md).

- `sceneCodec.ts` is **pure and DOM-free** — keep it that way; it is why the
  remap, dimension-mismatch and corruption rules are vitest cases, not browser
  ones. `decodeScene` hands back planes already sized to the current grid.
- `sceneStore.ts` talks to `localStorage` through the `SceneStorage` interface,
  writes the blob **before** the index, and turns quota errors into
  "storage full, delete a scene".
- **Save writes over the current scene** (`store.update`), so one scene costs
  one blob and one thumbnail however many times it is saved; only an unsaved
  world creates a row. `copy` is how a variant is forked. `useScenes` owns
  which scene is current, and the header reads its name from there.
- **Never destructive on failure**: a scene that will not load keeps its blob
  and its row, and gains an error. A load always enters paused.
- `ra`/`rb` are persisted; `clock` is not (it is zeroed by `Sim.restore`).
- **Two rules for *building* a scene**, both easy to get wrong and neither
  enforced anywhere (life ticket 06, pinned in `sceneRoundTrip.test.ts`):
  - **A pond is stone-lined and stone-floored.** An earth basin does not hold
    water - `water + dirt -> mud` and mud is a *liquid*, so the walls wet
    through and the pond oozes away with them.
  - **A pre-grown meadow is pre-aged, through the growers only.** `paint`'s
    `{ ra }` seed is what a built scene has for this, and `requireRaIsFree`
    means only the stalk tip and the buried seed can take it; give each tip a
    different travelling budget and the plants climb, bloom and wither apart.
    Everything else spreads by `lifetime.jitter`, drawn on its first tick.

## Field notes progression (`src/features/fieldNotes/`)

Discovery-tree spec §5. `fieldNotesStore.ts` owns `silt:fieldNotes` and nothing
else touches it.

- **Global, not per scene, and edges only.** The blob is
  `{ version, edges, reviewed }`; discovery, mastery and the rail unlock are
  recomputed by `entries.ts` on every load, so nothing derived is stored and
  nothing stored can disagree with the roster. A new denominator is a roster
  change, not a migration.
- **The chart counts elements, the sim counts species.** `buried` charts as
  seed and sprout/tip/stalk/petal as flower, through `chartAs` on the derived
  graph; `entries.ts` folds it in, so one charted entry can be backed by several
  raw edges - witnessed by any of them, mastered only by all. **What is stored
  and what the sim reports stay raw**: `witnessKeys`/`witnessKeysFor` are those
  keys, `keys`/`entriesFor` are the charted ones, and confusing the two silently
  breaks mastery. Changing the mapping needs no migration.
- **`reviewed` is a count into `edges`, which is append-ordered** - the
  watermark the `NEW n` chip is measured against, so no element name is stored
  for it. `markReviewed()` is called **when the panel closes**: advancing it on
  open would empty the chip on the render that exists to show it.
- **Unknown edge keys are carried, never dropped**; a blob that will not parse,
  or is of another version, reads as empty with a warning and is left on disk
  until a real write replaces it.
- **The rail is base + earned, never base with something inserted.**
  `PAINTABLE_IDS` is the ten base elements; a mastered unlockable - since ticket
  14 that is **every charted non-base element**, derived as the index's
  `unlockable` rather than a kept list - reaches the rail through
  `buildRailPalette`'s `earned` list and the EARNED control at the palette's
  foot, so no hotkey ever moves (spec §9.8). An earned
  element is paintable in every other way, spawners included. Mud leaving the
  rail did **not** take it out of `v1Elements` - scenes remap by name, and a
  pre-trim scene's mud cells depend on it still being a species.
- **Clearing the world does not clear discoveries.** The only thing that does is
  the panel's armed "forget discoveries" (`store.reset()`), which removes the
  key outright.
- `useFieldNotes` is the one seam the header, panel, rail and moments read. It
  is React wiring only: the store and the pure `fieldNotesView` behind it are
  where the behaviour, and the tests, live.
- **One tile helper, one masking seam.** Every tile the feature draws - picker
  row, phone grid, ring, product tiles, the rail's teaser - comes from
  `ElementTile`, built from the element's `colours[0]` and archetype alone
  (square / cut-corner / diamond / hexagon), so a new element needs no art.
  `ElementRefTile` is the only thing that decides whether a colour may be drawn
  at all: a hidden element's hex is as much a spoiler as its name (spec §7), and
  every name the panel renders goes through `panelModel`'s `refOf`, which is
  why the invariant is a vitest case and not a review habit.
  **The reading line is the panel's one text site for an interaction** (ticket
  25): the ring draws tiles and arrowheads only, and the band under it renders
  the *active* spoke - hovered, focused or tapped - as a recipe of tiles
  (`Spoke.reading`). That is also why the two taps differ: a ring tile *reads*
  its spoke into the band, a band tile *follows* an element. A ring tile is
  therefore never disabled - a masked reading names nothing, and disabling it
  would leave a spoke with a hidden partner the one spoke nobody could read
  ([ADR 0051](../../docs/adr/0051-silt-the-reading-line.md)). The masking is not
  hypothetical - a pre-trim scene restores painted mud, so `react:lava+mud` can
  be witnessed while mud itself has never been discovered. **A second spoiler
  surface now rides the same seam**: an element's tag chips (ticket 12) are
  filled in by `refOf` under the same discovered check that masks the name, so
  a hidden element carries no tags at all. Anything else the panel learns to
  say about an element belongs there too, rather than in a fresh guard.
- **Engine vocabulary never reaches the player raw.** The sim's tags are the
  reaction table's keys, not player-facing words, so `panelModel`'s `TAG_LABELS`
  is an allowlist rather than a pass-through: a tag invented for the roster
  tomorrow is dropped from the panel until someone decides what it should read
  as. `elementAppearance`'s `elementTags` deliberately hands over the **raw**
  tags so that decision has exactly one home. `energy` is in (the rail already
  groups fire under that word - `features/palette/paletteGroups.ts`); `wall` is
  out (it belongs to the out-of-bounds sentinel, not to any element).
- **A moment is a diff of two views, not a second reading of the sim.** The
  sim reports a first witness once (`useSimLoop`'s `onWitnessed` into
  `witness`); everything after that - the chip's tick, the panel, the rail's
  unlock, the card, the 100% line - re-derives from the store, so a card can
  never claim something the chip beside it has not counted. `momentsFor` takes
  the view before and the view after, which is also why closing the panel and
  forgetting discoveries raise nothing without a case for either. Cards queue
  one at a time and a burst collapses to the newest few: quiet beats complete.
  The seed the page sends the sim at boot (`witnessedAtBoot`) is noise
  reduction only - the store would dedupe a re-report anyway.
- **The key is static text about line kinds, and that is what keeps it safe.**
  The footer's key derives its rows from the graph (`legendRows`) and names no
  element at all, so it sits outside the spoiler policy rather than merely
  inside it (spec §7) - an illustrative example would be the regression, and
  `panelModel.test.ts` checks its words against every name in the roster,
  substrings included ("long-dashed" would smuggle ash in). It explains only
  what the screen draws: the phone hides the notches, so it hides their row too.
  That is also why it stays with the **ring** rather than the panel (ticket 22) -
  every row it holds is a line kind, and a panel with no chart on it draws none
  of them. Its toggle leads the footer's controls at its own size: sharing
  `forget discoveries`' 8px footnote rule, at the tail of a strip of up to
  twenty-two notches, is how a control that was live all along went unfound.
- **The phone sheet's ring is sized by its room and stays square.** The ring
  area is a container (`container-type: size`), so the ring is the largest
  square fitting under the header band that names the focused element (ticket
  21) - not a fixed 340px, and never a width with a height of its own: the
  SVG's 0-100 viewBox and the absolutely positioned tiles share one coordinate
  system, so an oblong ring draws the lines and the tiles apart. The name is
  *moved*, not duplicated - one `FocusName`, in the ring's centre on a desktop
  and in the band on a phone - which is the second thing `useMobileLayout`
  decides in this panel.
- **The panel picks, it does not know.** Selection and the green-edge clearing
  are panel-local `useState`; the counts, mastery, `NEW` set and denominators
  all arrive from the view. `markReviewed()` fires from `HomePage`'s
  `closeNotes`, never on open.

## Commands

- `pnpm dev --filter=silt` — simulator mode on port **3009** (real router, no
  persistence; restart to pick up server changes).
- `pnpm test --filter=silt` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`, CT port **3109**).
- `pnpm --filter silt run bench` — `bench/sim.bench.ts`, ms/tick for five named
  scenarios under native Node. A tool, not a gate: it is deliberately outside
  `pnpm test`, since a timing assertion in CI would only flake. It prints
  `scannedLastTick` beside every timing — a scenario that got faster because it
  stopped simulating is not a win, and the scanned count is what tells the two
  apart.
- `pnpm --filter silt run graph` — rewrites
  [`docs/interaction-graph.md`](docs/interaction-graph.md) (mermaid graph plus a
  row-by-row table) from the registry. Unlike `bench` this one **is** gated:
  `src/docs/interactionGraph.test.ts` fails if the checked-in file has drifted,
  so a new element or reaction row means running the script in the same change.
  Hooks are the edges the registry cannot report, so they are declared in the
  generator and mirrored by hand: growth's two (`growth.ts`) and the four
  `HookEdge` transmutations (ticket 07) - germination's pair (`seedBank.ts`)
  and the raise and bloom (`stalk.ts`). Evaporation stays unreported: it
  produces nothing, and a fade is not an entry. A
  coarse `lifetime` is reported in real ticks, not in countdown draws, and a
  `lifetime.emits` death drop is reported beside the decay it rides on.
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- **A mobile `.iwft` emulates touch, not a phone's width.** `playwright/index.html`
  carries no viewport meta (the app's `index.html` does), so a
  `viewport: { width: 390 }` run lays out at Chromium's 980px fallback and
  scales the picture down: `$mobile` matches on `pointer: coarse` alone. Assert
  against `document.documentElement.clientWidth` rather than `viewportSize()`,
  and prefer a proportional claim to a pixel one.
- Ports: dev 3009, CT 3109.
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
