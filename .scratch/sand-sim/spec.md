# Silt — spec

A falling-sand cellular-automata playground at `silt.homeofed.com`. Calm, small
and personal — a toy you noodle with, not a physics workstation. This spec is
the destination of the [sand-sim wayfinder map](map.md); every decision below
is locked. Rationale lives in the linked tickets and research docs — this
document states *what to build*.

Sources: [prior-art research](research/prior-art.md) ·
[element-model designs](research/element-model-designs.md) ·
[design brief](design/design-brief.md) (hi-fi mockups in `design/Silt handoff/`).

---

## 1. Product summary

- A fixed 300×200 world where elements fall, flow, and react under simple
  cellular-automata rules.
- **Paused is a workbench, not an error**: pause/play toggles between setup
  mode and simulation; painting works in both states; step advances one tick;
  reset clears everything.
- v1 ships four paintable elements (Dirt, Sand, Water, Lava), one reaction
  (Water + Lava → Obsidian), one spawner type (continuous emitter), and
  localStorage scene persistence.
- Modest v1 targets on an ambitious architecture: the engine is built so that
  fire, steam, acid, and a thirty-element palette are cheap additions later.

## 2. HomeOfEd wiring checklist

Stateless app per [ADR 0008](../../docs/adr/0008-apps-without-a-database.md) —
no Postgres, shallow `/health` (no Store round-trip). Copy base is
`templates/starter`.

| Touchpoint | Value |
| --- | --- |
| App name | `apps/silt`, package name `silt` |
| Subdomain | `silt.homeofed.com` |
| Fly app | `hoe-silt` (human runs `fly apps create`) |
| Ports | Take the **next-free row from the port registry** in [adding-an-app.md](../../docs/how-to/adding-an-app.md) at implementation time and add `silt` to it — do not guess; check unmerged branches too (`espy` is live but absent from the table). |
| Cloudflare | Proxied CNAME `silt → hoe-silt.fly.dev`, Full (strict), Fly cert (human-run) |
| CI | Copy the `deploy-hub` job in `.github/workflows/deploy.yml` (affected check, fly.toml path, smoke URL) |
| Docker stack | One service in `compose.yml`, fresh host port, no `DATABASE_URL`, no `depends_on` |

Standard stack: SPA (TanStack Router + Query + tRPC client), layered backend +
DI. The backend surface is minimal (health only in v1) but keeps the standard
shape so later server features slot in.

## 3. Interaction model

- **Play/pause** toggle. Paused = setup mode; the grid brightens (not dims).
  Painting and spawner placement work in both states.
- **Step** advances exactly one sim tick while paused.
- **Reset** clears **everything — cells and spawners** — behind a second-click
  confirm. (A softer "clear cells only" affordance is deliberately deferred;
  add only if user feedback asks — [ticket 09](issues/09-design-open-questions.md).)
- **Painting**: brush in four sizes, applies the selected element. Eraser is a
  tool, not an element. One-finger touch painting works; no pan/zoom in v1.
- **Modes**: paint / spawner — the mode applies to whichever element is
  selected.

## 4. v1 element roster and reactions

| Element | Archetype | Notes |
| --- | --- | --- |
| Dirt | static | |
| Sand | powder | |
| Water | liquid | |
| Lava | liquid, `move: 0.15` | "slow liquid" = per-step move probability, not a velocity field |
| Obsidian | static | reaction product only — not in the paint palette |

One reaction, expressed as a **reaction-table row, not element code**:
Water + Lava → Obsidian (both cells transmute).

All five elements are pure config — zero behavioural code. Element names are
**one word each** (Silkscreen at 10px caps label length). **Element ids are
pinned explicitly** in the registry (non-contiguous enums caused Sandspiel
save-format pain; our scenes hit localStorage from day one).

Lava ignition is out of v1, but the model below accommodates it (gas archetype
+ lifetime + one `onTick` hook) without engine changes.

## 5. Engine architecture

### 5.1 Cell layout

Typed-array grid, never objects-per-cell. Each cell is 4 bytes:

```
{ species, ra, rb, clock }
```

- `ra`/`rb` are untyped scratch, reinterpreted per element. **Byte ownership
  is a spec rule**: the engine's `lifetime` feature owns `ra`; colour variant
  owns `rb`. A hook wanting scratch must not collide with an engine feature
  that owns the byte.
- `clock` is the double-update guard: a per-tick `generation` counter; every
  write stamps `generation + 1` and the scan skips already-stamped cells.
  Keeps the sim in-place (single transferable, worker-ready buffer). Note
  this ties correctness to sim ticks — fixed-timestep decoupling is required,
  not a nicety.
- Future per-cell fields (heat, wind…) are **parallel grids**, never a wider
  cell.

### 5.2 Element model: archetype + hooks

Decision from [ticket 02](issues/02-element-modularity-model.md); full
comparison in [element-model-designs.md](research/element-model-designs.md).
The boundary: **archetypes own movement; hooks own transmutation.**

- `Archetype` is a **closed, engine-owned set of four motion kernels**:
  `static` | `powder {density, slide}` | `liquid {density, dispersion, move?}`
  | `gas {density, dispersion, move?}`. `move` is per-step move probability;
  density orders displacement; gas density < 0.
- `ElementDef` = pinned `id`, `name`, `colours`, `tags`, `archetype`, optional
  `hardness`, optional engine-managed `lifetime {ticks, jitter, becomes}`
  (stored in `ra`), and **at most one hook**: `onTick(api)`, which runs
  strictly *after* archetype movement so it can never corrupt the movement
  invariant.
- **Reactions** live in a tag-keyed pair table:
  `{a, b, p, aBecomes, bBecomes, maxHardness}` — keys may be tags (e.g.
  `[corrodible]`), which is what stops the table going O(n²).
- The `Api` is chunk-relative only: `get/set/swap/become` with `(dx,dy)`
  offsets (never absolute coords), `has(tag)`, `ra`/`rb` scratch,
  `rand()/randInt()` from the sim PRNG.
- **WALL sentinel**: out-of-bounds reads return a WALL cell, never undefined —
  no element ever branches on edges.
- **Boot-time registry validation**: duplicate ids, unknown reaction targets,
  bad probabilities fail at load.

Accepted, named failure mode: non-gravity-relative motion (projectiles) would
someday force a fifth `particle` archetype — a bounded one-time cost,
preferred over opening the archetype set now. Field-coupled physics (heat,
pressure) is a separate engine subsystem, out of v1.

### 5.3 Update loop

- **Fixed-timestep sim decoupled from the render loop** (required by the
  clock trick, §5.1).
- **Scan order**: generation-alternating horizontal scan
  (`scanx = gen % 2 == 0 ? width - 1 - x : x`) — fairness without consuming
  RNG.
- **Chunking from day one, structure only** (payoff deferred; no thread
  pool). Per winter.dev's pattern: chunk struct with *two* dirty rects
  (working + current, swapped at frame end), a 2-cell margin, a filled-cell
  count to skip empty chunks, and a **deferred cross-chunk move list**.
  Chunk size is a tunable constant, not a spec commitment (prior art varies
  by two orders of magnitude).
- **Determinism guards**: the cross-chunk move tie-break (two cells wanting
  the same destination) must draw from the **seeded PRNG**, and chunk
  resolution order must be fixed. These are the two places chunking silently
  destroys determinism.

### 5.4 Determinism

Seeded PRNG owned by the sim; no `Math.random()` anywhere in sim code — the
only randomness reachable from element code is `api.rand()`. Fixed update
order rules as above. The seed is per-session, not persisted — determinism
serves tests, not cross-session replay.

### 5.5 Sim/renderer split

Narrow interface between sim and renderer: Canvas 2D first, WebGL a drop-in
later. Sim state lives in transferable buffers so a worker move is possible
without restructuring.

## 6. Grid and rendering

From [ticket 06](issues/06-grid-dimensions.md):

- **Fixed logical grid, 300×200** (3:2 landscape), a build-time constant.
  Never viewport-derived; not user-configurable. 60k cells = ⅔ of Sandspiel's
  proven single-threaded 60fps load.
- The constant **may grow later** (e.g. 600×400); the scene format stores
  dimensions in its header to keep old scenes loadable (§7).
- **Rendering**: sim draws into a 300×200 backing buffer (one pixel per
  cell); the on-screen canvas scales it aspect-preserving into the play area,
  **letterboxed**, with image smoothing off (`image-rendering: pixelated`).
  Fractional scale factors are fine. Letterbox margins are painted the
  `world` colour (`#181510`) so the void blends with the grid edge
  ([ticket 09](issues/09-design-open-questions.md) — this overrides the
  design brief's "no letterboxing" line).
- **Resize = refit only**: recompute the canvas fit; the sim is untouched.
  Backing store is devicePixelRatio-aware (`cssSize × dpr`, re-evaluated on
  resize/zoom) — entirely on the renderer side of the seam.

## 7. Spawners

- One type in v1: **continuous emitter** — emits its element while the sim
  runs.
- Spawners are **entities, not cells**: minimal `{x, y, element}`.
- Placement via spawner mode (ghost preview under cursor). Drawn as a
  white-outlined box with the element's colour inside so it never reads as
  painted cells; hover turns it red with a minus; one click removes it.
- **The erase tool also removes them** — an erase stroke takes every spawner
  under its brush footprint, so clearing an area does not leave an emitter
  behind to refill it ([ticket 21](issues/21-erase-removes-spawners.md)). Both
  removal paths wear the same red-with-minus.
- Reset removes spawners (§3).

## 8. Scene persistence (localStorage)

From [ticket 07](issues/07-scene-serialisation-format.md). One JSON envelope
per scene:

```json
{
  "version": 1,
  "width": 300, "height": 200,
  "encoding": "raw",
  "elements": { "1": "dirt", "2": "sand", "3": "water", "4": "lava", "5": "obsidian" },
  "species": "<base64>", "ra": "<base64>", "rb": "<base64>",
  "spawners": [ { "x": 150, "y": 10, "element": "water" } ]
}
```

- **Persisted bytes**: `species + ra + rb` as three planar base64 strings.
  `clock` is runtime bookkeeping, reset to 0 on load. `encoding: "raw"` is
  the seam for future RLE / `CompressionStream` values — not built in v1
  (~240KB worst case per scene ≈ 20 scenes in the 5MB quota).
- **Remap by name**: the `elements` table records what each species byte
  meant at save time; load remaps to current registry ids. Unknown element
  name → empty cell (load succeeds, console warning). Spawner with unknown
  element is dropped; unknown extra spawner fields tolerated-and-ignored.
- **Storage layout**: `silt:scene:<uuid>` (`crypto.randomUUID()`) per scene +
  index key `silt:scenes` holding `[{id, name, updatedAt}]`. Boot-time
  reconcile: drop index entries with no blob, adopt orphan blobs.
- **Dimension mismatch**: saved smaller than current grid → paste anchored
  **bottom-centre** (spawner coords offset the same); saved larger → refuse
  to load with a clear error.
- **Failure handling — loud, never silent, never destructive**:
  `QuotaExceededError` → "storage full, delete a scene"; write scene blob
  first, index second; load failure (parse error, unknown version, plane
  length ≠ width×height) leaves the scene in the list with an error, never
  auto-deletes a blob.
- **Loads always enter paused.** Envelope is pure simulation data — no
  name/timestamps (those live in the index).

## 9. UI/UX

Direction: **pixel toy** on a **docked left rail** — full detail in the
[design brief](design/design-brief.md); hi-fi mockups in
`design/Silt handoff/`. The load-bearing points:

- **Layout**: rail 176px · header 58px · status bar 32px. The canvas is the
  app; nothing floats over the world except spawner chrome and the run/pause
  pill. Chrome is made of the same pixels as the world (hard 2–3px borders,
  offset shadows, bitmap face).
- **Rail**: grouped palette (Solid / Powder / Liquid / Energy — 18px swatch,
  name, hotkey; selected row inverts to ink), brush (four squares at true
  relative scale), paint/spawner mode toggle, erase button (never sorts into
  a category). Built for a roster that will triple. Swatches-only rail
  collapse is **post-v1**.
- **Header**: SILT · scene name | play · step · reset | scenes.
- **Status bar**: element · brush · spawner count · mode (left); cursor cell
  · grid size · FPS (right).
- **Scenes**: a popover — save current at top, saved-scene rows with canvas
  snapshot thumbnails, inline rename, **delete behind a second click**
  (required: the only escape from a full quota), footer "this browser only".
- **States**: first visit shows one fading line (*drag to pour sand*), no
  modal/tour; running shows a pill with a blinking green cell; paused
  brightens the grid and inverts the pill.
- **Keyboard**: `1–9` select · `[` `]` brush · `space` play/pause · `.` step
  · `E` erase · `Ctrl+S` save.
- **Mobile**: rail rotates into a bottom bar; palette row scrolls sideways
  keeping group order; 44–48px targets; step drops off; erase becomes the
  last chip. One finger paints. Desktop-first — this must *work*, no further
  mobile investment.
- **Tokens**: ink `#1A1714` · paper `#E7E2D5` · panel `#EFEADD` · raised
  `#F5F2E9` · muted `#8A8478` · world `#181510` · destructive `#E2542A`.
  Silkscreen for labels/names/headings (8–11px caps), IBM Plex Mono for
  numbers/status. Element colours are identical in rail and grid; exact
  element hexes in the HTML brief §05.

## 10. Testing stance

TDD per repo rules, but **few and targeted**: behavioural unit cases (a sand
grain falls, water displaces, the reaction row fires at probability 1, scene
round-trips, dimension-mismatch paste/refuse) — not golden-snapshot suites.
Determinism (§5.4) exists to make these tests exact. `*.iwft` whole-frontend
tests cover the core interaction loop (paint → play → save → reload → load).

## 11. Post-v1 roadmap (informative, not committed)

The architecture holds these doors open — none are v1 work:

- **Fire / steam / smoke**: gas archetype + `lifetime` (already engine-managed
  in `ra`) + at most one small `onTick` (ignition).
- **Acid**: liquid + `hardness` number + one tag-keyed reaction row
  (`[corrodible]`) — no per-pair rules.
- **Oil-on-water / glass**: density numbers and reaction rows only.
- **Bigger grid** (600×400): flip the constant; scene header keeps old saves
  loadable.
- **Scene compression**: new `encoding` value (RLE or deflate).
- **Rail collapse** to swatches-only.
- **WebGL renderer, worker sim**: seams already in place.
- Explicitly **not** worth it (prior art): TPT-style air/pressure grid.

## 12. Out of scope

- Building/deploying is a separate effort (this spec is the handoff).
- Database / shareable scene URLs (additive later, ADR 0008).
- Mobile-specific investment beyond "works" (Capacitor, mobile layouts).
- Lava ignition and elements beyond the v1 roster.
- Onboarding, settings, accounts, sharing, pan/zoom (per the design brief).
