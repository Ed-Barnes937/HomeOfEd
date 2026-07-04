# 0003 — Fridge app: tech spec + implementation plan

- **Status:** Proposed
- **Date:** 2026-07-03
- **Related:** [ADR 0001](../adr/0001-foundation.md),
  [ADR 0003](../adr/0003-spa-default-tanstack-start-opt-in.md),
  [ADR 0007](../adr/0007-reference-starter-app.md),
  [ADR 0008](../adr/0008-apps-without-a-database.md),
  ADR 0009 (to be written in F0 — magnet-kit package),
  ADR 0010 (to be written in F10 — shared-board model),
  [adding-an-app how-to](../how-to/adding-an-app.md),
  [phase-4 runbook](../runbooks/phase-4-go-live.md)

## 1. Summary

A new leaf app `apps/fridge` at **fridge.homeofed.com**: a single-screen
fridge door covered in draggable letter / number / fraction magnets that
physically **bump and shove each other** while dragging. Magnets are added
from a bottom tray, rotated via a selection knob or scroll wheel, and removed
by double-click. The fridge finish (steel/white/red/mint) and kitchen light
(warm/cool/night) are switchable. Boards are named and saved locally; a later
phase adds server-side **share links** (immutable snapshots in Postgres).

The collision/placement/rotation maths lives in a new reusable package,
**`packages/magnet-kit`** (`@hoe/magnet-kit`) — pure TS, no React/DOM — so a
future magnet-style app (e.g. a ransom-notes game) can reuse it.

**Visual reference (authoritative).** A high-fidelity handoff lives in
[`docs/reference/fridge-magnets/`](../reference/fridge-magnets/) — read its
`README.md` first; open `Fridge.dc.html` in a browser to feel the
interactions. For everything visual and interactive (layout, tokens, type,
radii, shadows, magnet recipes, collision feel, timings) **the handoff wins
over prose in this spec**, except for the deliberate deviations in §2. Port
token *values* from its `styles/tokens.css` into `src/styles/tokens.scss`;
don't copy files verbatim. The prototype's `relax()` / drag / rotate code is
the reference implementation for the engine (§3) and its app-side wiring (§4).

Decisions already made (with Ed):

| Decision | Choice |
| --- | --- |
| App name | `apps/fridge`, subdomain **fridge.homeofed.com**, Fly app `hoe-fridge`. |
| Engine | **`packages/magnet-kit` now** — pure-TS geometry/gesture maths, TDD'd in isolation (ADR 0009). |
| Add gesture | **Tap-to-spawn** (reference behaviour): tap a tray tile, magnet appears near the top of the door and settles via collision. No drag-from-tray. |
| Magnet types | **Letters, numbers, fractions only.** The reference's Words tab / word tiles are dropped. |
| Fridge colour | The reference's **4 preset finishes** (steel/white/red/mint). No free colour picker. |
| Kitchen light | **Kept** (warm/cool/night), saved/shared as part of the board. |
| Sharing | **Server share link** (phase 3): publish stores an anonymous **immutable snapshot** in Postgres under a short ID → `fridge.homeofed.com/b/<id>`. Opening the link **imports** it as a new local fridge the visitor can edit. No accounts, no server-side edit/delete. |
| Personal saves | **localStorage only** (reference behaviour). Only *shared* boards touch the DB. |
| Deploys | **Two go-lives:** stateless app first (F9), DB + sharing later (F13). |

Assumptions this spec makes (flagged, not asked — overrule if wrong):

- **DOM rendering, not canvas.** Magnets are absolutely-positioned `div`s
  styled by the pure-CSS recipes in `tokens.css` (the handoff has no raster
  assets and relies on `background-clip:text`, conic gradients, layered
  shadows). Expected magnet counts (≲100) are far below DOM limits.
- **Matte magnets** (`magnetGloss` default `false`), **mint** default finish,
  **warm** default light — the prototype's own defaults.
- Collision uses **unrotated AABBs** (exactly like the prototype); rotation is
  cosmetic. Good enough at ±7° tilts; snapped-90° word-style magnets are a
  future engine concern, not v1.
- **Fredoka is self-hosted** (`.woff2` in `apps/fridge/public/fonts/` +
  `@font-face`), per `fonts/FONTS.md` — no runtime Google Fonts dependency.
- localStorage key **`fridge:v1`**; first-ever load seeds a demo board (§6).
- Import is **only** via opening a share URL. A paste-an-ID import box is a
  follow-up (§2).
- `min_machines_running = 0` for `hoe-fridge` (gimmick app, cold starts OK).
- Colours are stored as **palette keys** (`'red'|'blue'|…`), not raw hex
  triples as the prototype does — smaller payloads and no user-supplied
  strings ever reach inline `style` (matters once boards are shared).

## 2. Non-goals / follow-ups

- **Words tab / word tiles** — dropped from v1 (decided). The engine and the
  serial format don't preclude them; the ransom-notes app is the natural home.
- **Drag-from-tray** add gesture; free fridge-colour picker.
- **Paste-an-ID / paste-a-URL import box** (import is link-open only in v1).
- Share-link management: expiry, deletion, ownership, abuse throttling beyond
  payload caps (§8). Revisit if it's ever abused.
- Multi-touch (two magnets dragged at once); the engine takes a single
  `activeId`.
- Sound effects, magnet physics beyond AABB separation (no rotation-aware
  collision, no inertia).

## 3. Package: `@hoe/magnet-kit`

New workspace package `packages/magnet-kit`, scaffolded like
`packages/logger` (same `package.json` shape: `"exports": { ".": "./src/index.ts" }`,
TS source exports per ADR 0004, `@hoe/config` devDeps, vitest). **Zero
runtime dependencies.** No React, no DOM types anywhere in it.

The API is small, functional, and framework-agnostic. Functions **mutate the
boxes passed in** (documented; it's what makes the multi-pass relax cheap) —
callers clone before calling if they need immutability (the app does, per
React state rules).

```ts
// types.ts
export interface Box { id: number; x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }
export interface Placement { x: number; y: number; rot: number }

// clamp.ts
export function clampOne(b: Box, boundsW: number, boundsH: number): void
// x → [0, boundsW - b.w], y → [0, boundsH - b.h] (exactly the prototype's clampOne)

// relax.ts — the core "bump" (port of the prototype's relax()/push())
export function relax(
  boxes: Box[], activeId: number | null,
  boundsW: number, boundsH: number, passes = 7,
): void
// For `passes` iterations: for every pair (i, j<i…n): compute AABB overlap
// (ox, oy). If both > 0, separate along the SMALLER-overlap axis, direction
// by centre comparison. Push rules:
//   - the pair member whose id === activeId is IMMOVABLE — the other member
//     takes the full push (this is what makes the dragged magnet shove);
//   - otherwise the push splits 50/50 (this is what makes shoves chain
//     through a cluster).
// After each pass, clampOne() every box to bounds.

// spawn.ts
export function spawnPlacement(
  boundsW: number, boundsH: number, size: Size, rng: () => number,
): Placement
// x = boundsW/2 - size.w/2 + (rng()-0.5)*90   (centre ± up to 45px)
// y = boundsH*0.16 + rng()*46
// rot = rng()*14 - 7                          (± up to 7°)
// rng injected for deterministic tests (Math.random in the app).
// Returns UNCLAMPED coordinates — callers must run relax() (which clamps)
// right after spawning, as the app does in §4. Don't skip it.

// rotation.ts
export function knobRotation(cx: number, cy: number, px: number, py: number): number
// degrees; atan2(py-cy, px-cx)*180/PI + 90 — knob straight up = 0°.
export function snapRotation(rot: number, within = 7): number
// Normalise rot to [0,360) FIRST (the prototype does this on every release,
// snap or not). Then snap to the nearest multiple of 90 (mod 360) when
// |delta| < within (strict, matching the prototype's `< 7`); otherwise
// return the normalised value unchanged.
export function wheelRotation(rot: number, deltaY: number, step = 7): number
// rot + step * Math.sign(deltaY). Deliberate micro-divergence: the
// prototype rotates -7° at deltaY === 0; sign(0) === 0 is a no-op here.
```

What the engine deliberately does **not** own: magnet types/sizes/colours,
serialisation, React state, persistence — those are app concerns (§5, §6).
The seam for the future ransom-notes app is exactly `Box` + these functions.

## 4. Interaction spec (app-side wiring of the engine)

All behaviour below is the handoff's §Interactions, restated with engine
call-sites. The magnet **surface** is the `inset:7px` div inside the door;
all coordinates are surface-local px.

- **Add (tap-to-spawn):** tapping a tray tile builds a magnet of that type
  (size from `sizeFor(type)`, §5), places it with `spawnPlacement()`, appends
  it, then runs `relax(all, newId, W, H)` so it settles without overlap. The
  new magnet becomes selected. Colour = picked swatch, or next palette colour
  in cycle when `auto`.
- **Drag + bump:** `onPointerDown` on a magnet: `setPointerCapture`, record
  `{ id, grabOffset }` in a ref, select it, bump it to top z. Each
  `pointermove`: position = pointer − grabOffset → `clampOne` → clone all
  magnets → `relax(clones, draggedId, W, H)` → set state. `pointerup`: clear
  drag, persist. Non-dragged magnets get
  `transition: left .13s cubic-bezier(.2,.9,.3,1.15), top .13s …` (they
  visibly slide when bumped); the dragged magnet has **no** transition,
  `scale(1.08)`, raised z-index.
- **Rotate:** dragging the selection knob sets
  `rot = knobRotation(centre, pointer)` live; on release apply
  `snapRotation(rot)` (snap to 0/90/180/270 within 7°). Wheel over a magnet:
  select it and `wheelRotation(rot, e.deltaY)` (±7°/tick).
- **Remove:** double-click a magnet, or the selection overlay's **×**.
  **Clear** empties the current board (with no confirm — matches reference).
- **Select/deselect:** pointerdown on a magnet selects; clicking empty
  surface deselects. The selection overlay (dashed ring, rotate stalk+knob,
  delete ×) tracks the magnet's box + rotation — recipe in the handoff §C.
- **Resize:** on window resize, re-measure the surface and `clampOne` every
  magnet (handoff §Persistence).

Perf note: the prototype re-renders every magnet each pointermove and is
fine at reference scale. If it ever stutters, throttle moves to rAF — do
**not** move state out of React speculatively.

## 5. Board model + serialisation

App-side (`src/features/board/model.ts`, `serialize.ts`):

```ts
type MagnetType = 'letter' | 'number' | 'fraction'
type PaletteKey = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple'
type Finish = 'steel' | 'white' | 'red' | 'mint'
type Wall = 'warm' | 'cool' | 'dark'

interface Magnet {           // runtime — extends magnet-kit's Box
  id: number; type: MagnetType
  label: string              // 'A'–'Z' | '0'–'9'; '' for fractions
  deg: number                // fractions only: 90|120|180|270|360, else 0
  color: PaletteKey
  x: number; y: number; w: number; h: number; rot: number; z: number
}

interface StoredMagnet {     // serialised — w/h/z/id are DERIVED, not stored
  type: MagnetType; label: string; deg: number; color: PaletteKey
  x: number; y: number; rot: number     // x/y rounded to ints; rot normalised to [0,360)
}
interface StoredBoard { name: string; magnets: StoredMagnet[]; finish: Finish; wall: Wall }
```

- `sizeFor(type)` — letter `52×60`, number `50×60`, fraction `64×64`
  (prototype values). Recomputed on every load/import: stored payloads never
  carry dimensions, so a malformed/hostile payload can't create absurd boxes.
- `PALETTE: Record<PaletteKey, {main,dark,light}>` — the 6 triples from
  `tokens.css`; `auto` cycles keys in token order (red→blue→green→yellow→
  orange→purple). Colour keys map to CSS via classes/CSS vars — **no
  user-influenced string is ever interpolated into `style`**.
- Shapes tab: ¼ ⅓ ½ ¾ ● → `deg` 90/120/180/270/360.
- **localStorage** `fridge:v1`:
  `{ v: 1, current: StoredBoard, saved: StoredBoard[] }` — written on every
  mutation, restored + re-clamped on load. Unparseable/invalid JSON → fall
  back to the seed board (never crash).
- **Seed board** (first-ever load; reference's, minus the word tile):
  HELLO in letters (palette cycling), a 120° and a 270° fraction disc, a
  green `3`.
- One **zod** schema `storedBoardSchema` validates both localStorage reads
  and (phase 3) share payloads server-side: name ≤ 60 chars; ≤ 200 magnets;
  `label` matches `/^[A-Z0-9]?$/`; `deg` ∈ {0,90,120,180,270,360}; enums for
  type/color/finish/wall; x/y finite ints in [−50, 5000]; rot finite in
  [0, 360) (serialisation normalises — wheel rotation is otherwise
  unbounded). It lives in `src/server/boardSchema.ts` so handlers and the
  frontend share it.

## 6. UI spec

Recreate the handoff pixel-close (its README §Screens is the spec; the
screenshots are ground truth). Summary of the four regions and the v1 deltas:

- **A. Top toolbar** — wordmark "the fridge" + helper text; right: name
  input, **Save**, **New**, **Clear**. Phase 3 adds a **Share** button here
  (§8). Recipes per handoff §A.
- **B. Saved-fridge chips** — wrapping pill row, active chip filled `--ink`,
  trailing × deletes (stopPropagation). Empty-state caption per handoff.
- **C. Fridge stage** — door (`min(1060px,92vw)` × `max 648px`), finish
  overlay, magnet surface (`inset:7px`), chrome handle, page-wide
  kitchen-light overlay. Magnet recipes: matte letter/number
  (`.magnet-letter--matte`), fraction disc (`.magnet-fraction`) — from
  `tokens.css`. **Not ported:** the word-tile recipe and `--font-tile`
  (Words dropped), and the `.magnet-letter--glossy` recipe — `magnetGloss`
  is a design-time prop the UI never exposes; matte is the prototype's
  default and matches the ground-truth screenshots.
- **D. Tray** — appearance column (FRIDGE FINISH 4 swatches, KITCHEN LIGHT 3
  swatches) + add column with **three** tabs (`A B C` / `1 2 3` / `Shapes` —
  no Words tab), colour picker (`auto` pill + 6 swatches, always visible now
  that Words is gone), palette grids, hint line.

Styling: SCSS modules per component + `src/styles/tokens.scss` holding every
custom property from the handoff's `tokens.css` (minus word-tile tokens).
Fonts: Fredoka 700 self-hosted (`FONTS.md` has the download pointer);
Georgia only appears in the handoff for word tiles, so it's dropped too.

## 7. App architecture

Stateless scaffold first (ADR 0008); DB is additive in phase 3.

```
apps/fridge/src/
  server/                     starter skeleton (health only until phase 3)
    boardSchema.ts            zod storedBoardSchema (§5) — shared by client+server
    handlers/healthHandler.ts
    router.ts  simulator.ts  main.ts
    # phase 3 adds: schema.ts, migrations{,.ts}, migrate.ts, store.ts,
    #   handlers/shareBoardHandler.ts, handlers/getBoardHandler.ts
  features/board/
    model.ts                  Magnet types, sizeFor, PALETTE, fraction defs
    serialize.ts              Stored↔runtime mapping, localStorage load/save, seed
    useFridgeBoard.ts         useReducer board state; engine calls; gesture refs
    FridgeDoor.tsx(+scss)     door, finish overlay, surface, handle
    MagnetView.tsx(+scss)     one magnet, recipe by type; pointer handlers
    SelectionOverlay.tsx(+scss)
  features/tray/              Tray, Tabs, PaletteGrid, ColorPicker,
                              AppearanceColumn (+scss each)
  features/toolbar/           TopBar, SavedChips (+scss)
  features/share/             (phase 3) ShareButton, shared-board import glue
  pages/FridgePage.tsx        composes A–D; window-resize reclamp; light overlay
  styles/tokens.scss
  testing/                    IwftApp, FridgePagePom, iwftTest
  fridge.iwft.tsx
  router.tsx                  '/' (phase 3 adds '/b/$id')
```

Rules mirrored from boids: engine stays pure (it's a package now, so the
boundary is physical); server code sticks to erasable TS (ADR 0004);
relative imports carry explicit extensions; layered backend + DI survives
even while stateless.

State: `useFridgeBoard` owns `{ magnets, selId, dragId, finish, wall, pick,
tab, saveName, saved }` in a reducer; `nid`/`zTop` counters and transient
gesture data live in refs. Every persisted-state mutation writes
localStorage via `serialize.ts`.

## 8. Backend phase 3: DB + share links

Follow [the how-to §2](../how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only)
mechanically (hub is the copy source for every file it lists). App-specific
content:

- **Schema** (`src/server/schema.ts`): one table.

  ```ts
  sharedBoards: pgTable('shared_boards', {
    id: text('id').primaryKey(),                    // 10-char base62
    name: text('name').notNull(),
    payload: jsonb('payload').notNull(),            // StoredBoard
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  })
  ```

- **Store** (`FridgeStore` interface + `DrizzleFridgeStore`):
  `ping()`, `insertSharedBoard(id, name, payload)` (throws on id conflict),
  `getSharedBoard(id) → { name, payload } | null`.
- **Handlers:**
  - `ShareBoardHandler` — input `StoredBoard` validated by
    `storedBoardSchema` (§5 caps are the abuse guard); generates a 10-char
    base62 id from an injected `idGen` (crypto-random in prod, fixed in
    tests); retries twice on conflict; returns `{ id }`.
  - `GetBoardHandler` — input `{ id: /^[A-Za-z0-9]{10}$/ }`; returns the
    validated `StoredBoard` (re-parse through the schema on the way out) or
    a tRPC `NOT_FOUND`.
- **Router:** `board.share` mutation, `board.get` query, `health` query.
- **Frontend:**
  - **Share** button in the toolbar (enabled when the board has ≥1 magnet):
    calls `board.share`, then shows/copies
    `https://fridge.homeofed.com/b/<id>` (origin-relative in dev).
  - Route **`/b/$id`** (TanStack Router): fetches `board.get`; on success
    imports it as a **new local fridge** named `"<name> (shared)"` (sizes/
    ids/z recomputed per §5), makes it current, navigates to `/`. On
    NOT_FOUND: small "This shared fridge doesn't exist" state with a link
    home. SPA fallback for deep links is **already in place** —
    `createAppServer`'s `setNotFoundHandler` serves `index.html` for
    non-API GET/HEAD (covered by `createAppServer.test.ts`); no backend-kit
    change needed.
- **Semantics** (→ ADR 0010): snapshots are anonymous, immutable, unlisted
  (guessing a 62^10 id is the only discovery), and permanent in v1. Sharing
  again after edits mints a new id.

## 9. Hub change

Add a `fridge` entry/link on the hub landing page next to the boids one
(same pattern the boids plan used in its §7). Verify with hub's own loop.

## 10. Wiring checklist (root CLAUDE.md)

| # | Touchpoint | Value |
|---|---|---|
| 1 | App name | `apps/fridge`, package name `fridge`; `index.html` `<title>` |
| 2 | Subdomain | `fridge.homeofed.com` |
| 3 | Ports | dev **3002**, CT **3103** (hub 3000/3100, starter 3001/3101, boids 3001/3102) |
| 4 | Fly app | `hoe-fridge` (`fly.toml`), `primary_region = 'lhr'`, `min_machines_running = 0` |
| 5 | Cloudflare | proxied CNAME `fridge → hoe-fridge.fly.dev`, Full (strict) — human-gated |
| 6 | CI | copy `deploy-hub` → `deploy-fridge` (affected check `select(.name == "fridge")`, config path, smoke URL) |
| 7 | compose.yml | `fridge` service, host port **8082** (hub 8080, boids 8081); phase 3 turns it into the two-service `fridge` + `fridge-db` pattern |
| 8 | Postgres (phase 3) | `fly postgres attach hoe-pg --app hoe-fridge --database-name fridge` — human-gated |
| 9 | DB wiring (phase 3) | how-to §2 in full (deps, schema, migrations, store, entrypoints, timeouts, `release_command`, Dockerfile pglite rules) |

New package touchpoints: `packages/magnet-kit` is picked up by the
`packages/*` workspace glob for pnpm/turbo, but the app's **Dockerfile
filter/COPY lists are hand-maintained** and must be edited too:

- add `"@hoe/magnet-kit": "workspace:*"` to `apps/fridge/package.json`
  dependencies;
- **Dockerfile prod-deps stage:** add `--filter=@hoe/magnet-kit` to the
  `pnpm install` filter list (alongside backend-kit/logger);
- **Dockerfile runtime stage:** add
  `COPY --from=pruner /app/out/full/packages/magnet-kit ./packages/magnet-kit`;
- **Dockerfile `rm -rf` line:** retarget the copied test-source removals to
  `apps/fridge/src/testing apps/fridge/src/fridge.iwft.tsx` (a stale
  `templates/starter` path silently ships test code).

Missing any of these surfaces only at F8 as `Cannot find module
'@hoe/magnet-kit'` in the prod container.

## 11. Implementation plan (TDD, each task ends green)

Verify loop for every task:
`corepack pnpm --filter <pkg> run lint && … typecheck && … test && … build`
(use `--filter fridge`, `--filter @hoe/magnet-kit`, `--filter hub` as
touched; `build` applies to the app, not the package; the how-to's §3
warning about `turbo run` applies).

**Phase 1 — engine**

- **F0 — ADR 0009.** `docs/adr/0009-magnet-kit-package.md` (MADR-lite):
  engine extracted to a package *before* a second consumer exists because
  reuse is an explicit product requirement; functional mutate-in-place API
  over a minimal `Box`; what stays out of the engine (§3).
- **F1 — Package scaffold.** `packages/magnet-kit` copied from
  `packages/logger`'s shape (no runtime deps). *Verify:* package loop green
  with a placeholder test; `pnpm install` resolves the workspace.
- **F2 — Engine TDD.** `clamp` → `relax` → `spawn` → `rotation`, each
  red/green. Required cases: clamp at all four bounds; two-box overlap
  resolves along the smaller axis with correct signs; `activeId` box never
  moves and its partner takes the full push; non-active pairs split 50/50;
  three-in-a-row domino (dragging A into B pushes C); a *sparse* seeded
  random scene (total box area ≪ bounds) fully separates to zero overlaps
  within 7 passes; a *dense* scene's total overlap is non-increasing and
  never worse than the input — zero overlap is **not** guaranteed when
  boxes are jammed against bounds (the per-pass clamp re-introduces it;
  the prototype behaves the same — do not "fix" the engine to force
  convergence); everything in-bounds after relax (that one *is* guaranteed
  by the per-pass clamp); `spawnPlacement` ranges (exact bounds with a
  stubbed rng at 0, 0.5, 1); `knobRotation` cardinal points (up=0,
  right=90, down=180, left=270); `snapRotation` snaps at 6° but not at 7°
  (strict `<` boundary), always returns a value normalised to [0,360)
  (−50 → 310 unsnapped); `wheelRotation` sign.

**Phase 2 — stateless app**

- **F3 — Scaffold.** Follow the how-to §1 top-to-bottom
  (`cp -r templates/starter apps/fridge`, then all seven touchpoints) with
  §10's values **including §10's Dockerfile edits for `@hoe/magnet-kit`**;
  replace the starter `greeting` demo with a
  `health`-only router (frontend makes **no** tRPC calls this phase — boids
  precedent); scoped `CLAUDE.md` + `README.md` (layout, ports, engine
  boundary = the package, no-DB pointer to ADR 0008); placeholder
  `FridgePage`. *Verify:* full loop green; dev serves on 3002; minimal
  `fridge.iwft.tsx` + `FridgePagePom` assert the placeholder renders.
- **F4 — Static fridge scene.** `tokens.scss` (port values from the
  handoff's `tokens.css`, minus word-tile tokens); Fredoka self-hosted;
  wall, door, finish overlay, handle, kitchen-light overlay; `MagnetView`
  recipes (matte letter, number, fraction disc); page regions A–D as static
  chrome; a hardcoded demo board rendered on the surface. *Verify:* iwft —
  page mounts, door + tray + N magnets visible; by eye vs
  `screenshots/01-default-view.png` and `05-finish-red-night-light.png`
  (flip finish/light via a temporary control or props).
- **F5 — Interactions.** `useFridgeBoard` + engine wiring per §4: drag+bump,
  select, knob rotate + snap, wheel rotate, double-click / × remove, clear,
  tap-to-spawn from all three tabs, colour picker + auto cycling, surface
  deselect. Unit: reducer actions (add applies spawn+relax via injected rng;
  remove; rotate; colour cycle). iwft (via `FridgePagePom`): tapping `A`
  adds a magnet; dragging one onto a neighbour displaces the neighbour
  (assert both positions); wheel changes the magnet's rotation transform;
  double-click removes; × removes; knob visible when selected.
- **F6 — Toolbar + persistence.** Name input, Save/New/Clear, saved chips
  (load / delete / active state), `serialize.ts` localStorage round-trip,
  seed board, resize re-clamp. Unit: stored↔runtime mapping recomputes
  w/h/id/z; zod schema accepts the seed and rejects oversize/garbage;
  corrupt localStorage → seed. iwft: save → chip appears; reload restores
  board + finish + light; chip × deletes; New starts empty; Clear empties.
- **F7 — Hub link.** §9. *Verify:* hub loop green.
- **F8 — Ship wiring.** compose service (8082), `deploy-fridge` CI job,
  Dockerfile/fly.toml sanity (scaffolded in F3). *Verify:* the how-to §3
  stateless prod smoke (`/health`, SPA index) + `docker compose up fridge`;
  CI green on the PR.
- **F9 — Go-live A (human, §12).** Stateless deploy.

**Phase 3 — DB + sharing**

- **F10 — ADR 0010 + DB wiring.** Write
  `docs/adr/0010-shared-fridge-boards.md` (immutable anonymous snapshots,
  import-on-open, payload caps, sizes recomputed on import, no ownership in
  v1). Then how-to §2 in full: deps, `schema.ts` (§8), generate migration,
  loaders, `FridgeStore` + `DrizzleFridgeStore`, wire store through
  router/handlers/simulator/main/IwftApp, `store.test.ts` over PGlite,
  vitest timeouts, `.env.example`, `release_command`, Dockerfile db edits,
  compose two-service pattern. *Verify:* full loop green (health test now
  uses a Store fake); `docker compose up fridge` → deep `/health` ok.
- **F11 — Share handlers.** `ShareBoardHandler` + `GetBoardHandler` per §8,
  TDD with a hand-written `FridgeStore` fake (valid board → id shape;
  schema-violating payloads rejected; id conflict retries then errors;
  get missing → NOT_FOUND; get re-validates payload). Store-level tests for
  insert/get in `store.test.ts`.
- **F12 — Share/import UI.** Share button + copied URL; `/b/$id` route with
  import-as-new-local-fridge + NOT_FOUND state; SPA-fallback checkpoint
  (§8). iwft: seed a shared board via `mountApp({ seed })` → visiting
  `/b/<id>` lands on `/` with the board present and named
  `"<name> (shared)"`; share flow surfaces a `/b/` URL; unknown id shows the
  not-found state.
- **F13 — Go-live B (human, §12).** Postgres attach + redeploy.

## 12. Go-live runbook (human-gated — agents stop here)

Add to `docs/runbooks/` during F8/F12; hand off per the how-to §4.

```bash
# Go-live A (after F8)
fly apps create hoe-fridge
fly certs add fridge.homeofed.com --app hoe-fridge   # after first deploy
# Cloudflare: proxied CNAME fridge → hoe-fridge.fly.dev (Full-strict is zone-wide)

# Go-live B (after F12)
fly postgres attach hoe-pg --app hoe-fridge --database-name fridge
# then merge → deploy runs the release_command migration
```

> **⚠ Deploy-token gotcha (from the boids go-live):** ensure the repo's
> `FLY_API_TOKEN` secret is org-scoped (or covers `hoe-fridge`); an
> app-scoped token cannot deploy the new app.

Verify: `curl -fsS https://hoe-fridge.fly.dev/health`, same via
`https://fridge.homeofed.com`, then bump some magnets; after B, share a
board from one browser and open the link in another.
