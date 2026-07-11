# 0022 — fridge: cross-device board consistency (fixed logical canvas, scale-to-fit)

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** [0010-shared-fridge-boards.md](0010-shared-fridge-boards.md)
  (the share snapshot this constrains — same `StoredBoard` payload);
  [boardSchema.ts](../../apps/fridge/src/server/boardSchema.ts) (the persisted
  shape); [0003-fridge-implementation-plan.md](../plans/0003-fridge-implementation-plan.md)
  §5/§7/§8

## Context

A shared fridge board must look the **same** on every device — that is the
whole point of the share link ([ADR 0010](0010-shared-fridge-boards.md)):
publish the arrangement you're looking at, someone else opens it and gets *that
arrangement*. Today it does not hold across form factors.

Magnet positions are stored as **absolute surface-local pixels**. `x`/`y` are
integers in `[−50, 5000]` ([boardSchema.ts:30-31](../../apps/fridge/src/server/boardSchema.ts));
`toStoredBoard` rounds them and drops `w`/`h`/`z`/`id`
([serialize.ts:63-71](../../apps/fridge/src/features/board/serialize.ts)); `w`/`h`
are recomputed from `sizeFor(type)` on load ([serialize.ts:85-100](../../apps/fridge/src/features/board/serialize.ts),
[model.ts:58-62](../../apps/fridge/src/features/board/model.ts)). The share
payload is exactly this `StoredBoard`, keyed by a server id — the `/b/<id>`
route fetches it and imports it verbatim, with no coordinate transform
(`buildImportedBoard` only rewrites the name — [importSharedBoard.ts:20-22](../../apps/fridge/src/features/share/importSharedBoard.ts)).

Those pixels are interpreted against the **measured** surface. `useFridgeBoard`
measures the live surface with a `ResizeObserver` and, on every resize,
re-clamps every magnet into it ([useFridgeBoard.ts:318-328](../../apps/fridge/src/features/board/useFridgeBoard.ts)
→ `setSurface` → `clampOne` at [useFridgeBoard.ts:104-106](../../apps/fridge/src/features/board/useFridgeBoard.ts)).
`clampOne` forces `x → [0, boundsW − w]`, `y → [0, boundsH − h]`
([clamp.ts:7-10](../../packages/magnet-kit/src/clamp.ts)). The surface is **not**
a fixed aspect ratio — it is viewport-driven:

- door width `min(1060px, 92vw)`, `max-height: 648px`, surface inset `7px`
  ([FridgeDoor.module.scss:1-11,49-55](../../apps/fridge/src/features/board/FridgeDoor.module.scss));
- the stage is pinned with **fixed px chrome** — `top: 98px`, `bottom: 214px`
  ([FridgePage.module.scss:30-41](../../apps/fridge/src/pages/FridgePage.module.scss)),
  so surface height ≈ `viewportH − 312 − 14`.

**The drift is real, not theoretical.** A board authored on a ~1046×474
desktop surface, opened on a ~360px-wide phone (surface ≈ 317×454): every
magnet with `x > 265` (i.e. `boundsW − w = 317 − 52`) is clamped to the hard
right edge, then `relax()` shoves the collisions apart into a vertical pile.
The seed board's HELLO row alone (`x` 285→509, [serialize.ts:33-37](../../apps/fridge/src/features/board/serialize.ts))
collapses on **any** surface narrower than ~561px — the word is destroyed. No
normalisation exists anywhere in the spawn → drag → serialize → import path;
positions are absolute px end to end.

The owner constraint is explicit: the shared board stays **intact and
consistent** across devices. Per-device reflow is therefore off the table;
only the surrounding chrome may adapt.

## Options considered

Each option is judged on: fixes consistency? · impact on the share format ·
migration of live boards · backward-compat · effort.

### (a) Fixed logical canvas + scale-to-fit (letterbox)

The board is a constant logical canvas (a fixed W×H in px, aspect ratio baked
in). Magnets keep their absolute px `x`/`y`/`w`/`h` **inside that canvas**;
`clampOne` uses the constant dims, not the measured element. The door is
rendered at its logical size and fit into the available stage with a single CSS
`transform: scale()` (letterboxed), so every device shows the identical
arrangement, only scaled. Pointer math divides client deltas by the scale.

- **Consistency:** fully fixed — pixel-identical layout everywhere.
- **Share format:** unchanged. `x`/`y` are already absolute px; they are simply
  reinterpreted against a constant canvas instead of a measured surface.
  `storedBoardSchema` is untouched.
- **Migration:** none. Existing payloads validate and render as-is; there is no
  coordinate rewrite.
- **Backward-compat:** total — old and new payloads are the same bytes.
- **Effort:** medium. Feed `surfW`/`surfH` from constants (not the
  `ResizeObserver` measurement), add the scale wrapper + letterbox, divide
  pointer deltas by scale. Contained to `useFridgeBoard` + the door layout.

### (b) Normalised 0..1 coordinate space, projected at render

Store `x`/`y` as fractions of the surface; multiply by the measured surface on
render.

- **Consistency:** only *relative*. Fractions preserve proportional placement,
  but because magnet glyphs are a **fixed** px size and the surface aspect
  ratio still varies per device, gaps and collisions differ — it does not by
  itself yield an identical arrangement unless a fixed aspect ratio is also
  imposed (which is then option (c)).
- **Share format:** breaks. `x`/`y` become `0..1` floats, violating the current
  `int`, `[−50, 5000]` schema — requires a payload version bump.
- **Migration:** the hard part. fridge is **live** and share/import was
  verified E2E in prod (share rows may exist), but stored payloads never
  recorded the authoring surface size, so old absolute-px rows **cannot be
  converted losslessly** to fractions — any migration guesses the original
  surface.
- **Backward-compat:** none without a versioned reader + a best-effort
  converter.
- **Effort:** high, plus migration risk against live data.

### (c) Hybrid — normalised coords within a fixed-aspect canvas

Fix the aspect ratio (as in (a)) **and** normalise positions (as in (b)).

- **Consistency:** fully fixed, and resolution-independent.
- **Share format / migration / compat:** inherits (b)'s format change and
  migration problem — the union of both costs.
- **Effort:** highest. And largely redundant: with a fixed-aspect canvas the
  absolute-px space of (a) already reproduces exactly; normalising on top buys
  only sub-pixel scaling niceness while forcing the migration (b) requires.
  Because magnet sizes are fixed px, a purely fractional space would also make
  magnet-to-canvas proportions drift, which is undesirable.

## Decision

Adopt **option (a): a fixed logical canvas rendered scale-to-fit (letterbox).**
The logical canvas is **1080×720 px (3:2)** — chosen ≥ the previous door-max
authoring bounds (~1046×634) so every existing shared board renders in place
with no migration, wide enough to fill the desktop door, and square enough to
limit pan on a portrait phone (a wider ratio costs phone panning roughly 1:1).

Magnets stay in absolute px inside a constant logical board; `clampOne` bounds
against the constant, not the measured surface; the door scales uniformly into
whatever stage space each device offers. This is the only option that
**guarantees a pixel-identical arrangement across devices while leaving the
`StoredBoard` share format byte-for-byte unchanged** — no schema change, no
migration of the live prod `shared_boards` rows, no versioned reader. It also
matches the grain of the app: magnets are fixed-size px objects, so a fixed-px
canvas is their natural coordinate space.

The mismatch it removes is precisely today's bug — positions were bound to a
*measured* surface that differs per device; binding them to a *constant*
surface makes the arrangement device-independent.

## Consequences

- **No data migration; existing shares keep working.** Because the payload is
  unchanged, every already-published board (fridge has been live since
  2026-07-04) still validates and imports. Positions authored against the old
  variable surface (≈1046 wide on desktop, close to the logical width) fall
  inside the logical canvas and render in place — there is nothing to rewrite.
- **`clampOne` decouples from the DOM measurement.** The `setSurface` /
  `ResizeObserver` path stops driving the coordinate space; it (or a
  replacement) now only computes the *scale* to fit the stage. The engine
  boundary is unaffected — `clampOne`/`relax`/`spawn` still take explicit
  bounds, now constants.
- **Pointer math gains a scale divisor.** Drag/knob handlers translate client
  coordinates through the surface rect ([useFridgeBoard.ts:416-473](../../apps/fridge/src/features/board/useFridgeBoard.ts));
  they must divide by the render scale so a magnet tracks the cursor. This is
  the main correctness risk and needs an explicit test.
- **Letterbox bars appear** when the stage aspect ratio differs from the canvas
  (thin margins top/bottom or left/right). Acceptable — it is the visible cost
  of "the same board everywhere".
- **Mobile chrome adaptation is a separate, additive concern.** The reason the
  surface is tiny on phones is the fixed 98px/214px chrome, not the coordinate
  model. Adapting the toolbar/tray (collapsible tray, slimmer toolbar,
  bottom-sheet) only changes the *stage area the fixed-aspect board scales
  into* — it must **not** touch the board coordinate space. Track it
  independently (follow-up ADR / plan item); it does not block this decision.
- **Mobile editing is handled in the view, not the model** — see *Editing on
  mobile* below for the zoom/pan + landscape decision that keeps small-screen
  editing usable without reflowing the board.

## Editing on mobile (zoom/pan + landscape nudge)

Scale-to-fit has a cost this ADR owns rather than defers: on a portrait phone
the fixed landscape canvas scales down to a short band, so magnets render at
roughly a third of their desktop size and become hard to grab. Reflowing to fix
that would break the consistency guarantee above, so the fix lives in the
*view*, not the coordinate space.

- **Viewing is always the canonical board** — the full arrangement, scaled to
  fit, identical on every device. This is the default and the only thing a
  share-link recipient sees.
- **Editing gets a view-only zoom/pan.** Pinch to zoom and drag to pan the board
  *within its frame*. This is a second transform composed on top of the
  option-(a) `transform: scale()`; it changes only what is on screen, never the
  stored `x`/`y`. The pointer math already divides client deltas by the render
  scale (see Consequences) — zoom/pan folds its extra scale+translate into that
  same divisor, so a magnet still tracks the finger while zoomed in.
- **Nudge to landscape.** On a portrait phone, show a lightweight, dismissible
  hint that rotating gives the board more room (landscape is where a ~1.65:1
  canvas fills the screen). Non-blocking — editing still works in portrait via
  zoom/pan.

These are pure presentation: the stored board, the share format, and
`clampOne`'s constant bounds are all untouched, so the cross-device guarantee
holds no matter how any one device zooms or rotates.

## Open questions

- ~~Exact logical canvas dimensions + aspect ratio.~~ **Resolved: 1080×720
  (3:2)** (owner, 2026-07-11) — ≥ the old ~1046×634 authoring bounds, so no
  migration; fills the desktop door; squarer than the old ~1.65:1 to keep
  portrait-phone panning low.
- **Live share rows:** confirm whether prod `shared_boards` actually holds
  boards beyond test data. It does not change the decision (option (a) needs no
  migration) but it is the reason (b)/(c) are effectively closed.
- **Very short viewports** (landscape phones): with 312px of fixed chrome the
  stage can shrink to near-zero before any board scaling helps — this is the
  chrome-adaptation follow-up, flagged here so it is not lost. (The landscape
  *nudge* is decided above; the chrome that must shrink to make landscape
  actually roomy is the separate follow-up.)
- **Zoom/pan bounds + reset:** min/max zoom, whether pan is clamped to the
  canvas edges, and how a user returns to the canonical fit view (double-tap /
  a reset control) — detail for the implementer, not a blocker.
