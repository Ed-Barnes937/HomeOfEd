# apps/silt — scoped rules

A falling-sand cellular-automaton playground at `silt.homeofed.com`.
**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
client-side simulation, scenes in `localStorage`, nothing server-owned.
Scaffolded from `templates/starter`
([ADR 0007](../../docs/adr/0007-reference-starter-app.md)). Spec:
`.scratch/sand-sim/spec.md` (v1) and `.scratch/silt-materials/spec.md`
(materials); tickets in `.scratch/silt/` and `.scratch/silt-materials/`. Every
effort since carries its own spec and tickets under `.scratch/silt-*/` - most
recently `.scratch/silt-burnables/` (the ignition ladder, the ember, ash).

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
                    global keydown map, given the actions it dispatches)
  features/         palette/ (the base paintable roster + brush widths, and
                              EarnedElements - the rail's one EARNED control,
                              where mastered unlockables live so the 1-9 hotkeys
                              and the rail's length never move)
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
                              React wiring over those two.
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
types.ts      ElementDef / Archetype / Api / Lifetime / ReactionRow
elements.ts   pinned species ids + the roster (dirt, sand, water, lava, obsidian,
              wood, oil, fire, smoke, steam, acid, stone, sulphur, mud, seed,
              moss, vine, ember, ash) and v1Reactions — config plus one hook. Everything
              that forms a mass declares four shades rather than one, picked
              per cell by `rb` (ADR 0040); `colours[0]` is the base, because the
              rail reads it. The three gases stay flat. Gas densities
              read backwards: `canDisplace` is `mine > theirs`, so the gas
              closest to zero rises highest. Reaction row order is load-bearing:
              a specific pair must precede any tag row covering it (acid + wood,
              the `fire + <fuel>` ignition ladder above `fire + flammable`, and
              `lava + wood` above `lava + flammable`). Wood never becomes fire
              directly - it chars to ember, which creeps, erupts, is doused
              back to wood, or is burned down to ash, which rain wets to mud
              and a seed regrows (ADR 0042)
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
              tries one random diagonal, not both (ADR 0039)
lifecycle.ts  applyReactions / applyLifetime — what happens to a cell after it
              has moved; neither moves anything
growth.ts     the roster's one `onTick`: moss and vine grow into water, up
              first, capped per cell by a branch count kept in `ra` and bounded
              overall by refusing any cell that already touches two plants
sim.ts        the world: chunk scan order, the clock guard, paint/tick
loop.ts       FixedTimestep — the tick rate, decoupled from any render loop
witness.ts    the discovery recorder - flat already-seen tables indexed by
              species id and by a packed species pair, fed from exactly three
              sites (a reaction applying, a decay with a product, the growth
              hook's successful `set`) and drained as rare, name-carrying
              events. Owned by the sim core so both hosts get it; it never
              draws from the `Rng` and never touches a cell
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
  New per-cell fields are parallel grids; the cell never widens past 4 bytes. There are
  **two exceptions, both conditional on the element declaring no `lifetime`**,
  and they cannot collide (one is static-only, the other liquid-only):
  - **The growth hook** (`growth.ts`): moss and vine hold their branch count in
    `ra`. Giving either a lifetime hands the byte back and uncaps growth.
    [ADR 0035](../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md) §3.
  - **The liquid opinion field** (`kernels.ts`): a liquid keeps its lateral
    direction, momentum and seeded marker in `ra` — bit 0, bits 1–3, bit 7.
    Unlike growth this one is *enforced*, not just documented: the scan passes
    `applyArchetype` a `raIsFree` flag, so a liquid that declares a lifetime
    degrades to the old coin flip instead of corrupting its countdown.
    [ADR 0038](../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md).

  This entry and the comments at both sites are summaries of those ADRs, so a
  change to the rule belongs in the ADR first.
- **`Api` reaches a neighbour's `ra` nowhere; `MovementApi` does.** `raAt` /
  `setRaAt` exist for the liquid kernel's opinion contagion and are engine-only
  on purpose — an element hook scribbling on another cell's engine-owned byte is
  the failure mode the ownership rule exists to prevent.
- **The witness recorder is off to the side of the simulation.** It is fed from
  three sites, records a flag and nothing else, and never draws from the `Rng` -
  which is why the determinism test is the assertion that guards it. A hook
  reports its own transmutation through `Api.witnessGrowth()`, the one thing on
  that surface that is not simulation; reactions and decay the engine sees for
  itself. Discoveries reach the page as a `simProtocol` message (rare events, so
  no shared-buffer slot to poll), and a `Sim` keeps what it has witnessed across
  `clear`/`restore` - resetting the world does not reset discovery.
  [ADR 0043](../../docs/adr/0043-silt-discovery-witness-in-the-sim-core.md).
- **A hook cannot keep its own cell awake.** `Api` has no `keepAwake` (it is on
  the engine-internal `MovementApi`), so a hook that must go on being offered a
  draw has to *write* — `growth.ts` writes `ra` every tick it has water to
  reach, because settled water writes nothing and the chunk would sleep under
  the plant.
- **`CHUNK_MARGIN` is fully spent.** The crowding check in `growth.ts` reads two
  cells out (the candidate is one away, its neighbours one past that), which is
  exactly the margin — a write wakes every chunk within two cells of it, so
  nothing is missed, but there is no slack left. A hook that needs a third cell
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

## Field notes progression (`src/features/fieldNotes/`)

Discovery-tree spec §5. `fieldNotesStore.ts` owns `silt:fieldNotes` and nothing
else touches it.

- **Global, not per scene, and edges only.** The blob is
  `{ version, edges, reviewed }`; discovery, mastery and the rail unlock are
  recomputed by `entries.ts` on every load, so nothing derived is stored and
  nothing stored can disagree with the roster. A new denominator is a roster
  change, not a migration.
- **`reviewed` is a count into `edges`, which is append-ordered** - the
  watermark the `NEW n` chip is measured against, so no element name is stored
  for it. `markReviewed()` is called **when the panel closes**: advancing it on
  open would empty the chip on the render that exists to show it.
- **Unknown edge keys are carried, never dropped**; a blob that will not parse,
  or is of another version, reads as empty with a warning and is left on disk
  until a real write replaces it.
- **The rail is base + earned, never base with something inserted.**
  `PAINTABLE_IDS` is the ten base elements; a mastered unlockable (mud today)
  reaches the rail through `buildRailPalette`'s `earned` list and the EARNED
  control at the palette's foot, so no hotkey ever moves (spec §9.8). An earned
  element is paintable in every other way, spawners included. Mud leaving the
  rail did **not** take it out of `v1Elements` - scenes remap by name, and a
  pre-trim scene's mud cells depend on it still being a species.
- **Clearing the world does not clear discoveries.** The only thing that does is
  the panel's armed "forget discoveries" (`store.reset()`), which removes the
  key outright.
- `useFieldNotes` is the one seam the header, panel, rail and moments read. It
  is React wiring only: the store and the pure `fieldNotesView` behind it are
  where the behaviour, and the tests, live.

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
  Growth is the only edge the registry cannot report, so it is declared in the
  generator - a change to `growth.ts` has to be mirrored there.
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3009, CT 3109.
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
