# Spec: Silt discovery tree

Status: ready for design handoff (open questions resolved 2026-09-03)
Audience: claude-design (mockups), then implementation in this repo.
In-app name: **Field notes**.

Silt gains a light collection metagame: the sandbox stays the game, but the app
now tracks which elements and which interactions the player has *witnessed*, and
shows that progress as a graph of pixel-styled element tiles with the
connections between them lighting up as they are discovered. The loop becomes
"muck about, and in mucking about, complete the chart".

This spec defines behaviour, data, and UI structure/states. Visual design
(tile art, layout aesthetics, motion) is deliberately deferred to claude-design;
§7 is the design brief.

## 1. Vocabulary

- **Node** - an element in the roster (17 today; `v1Elements`).
- **Edge** - one concrete interaction. Three kinds:
  - **Reaction** - an unordered pair from the resolved registry
    (`reactionFor`), tag rows expanded, `maxHardness` exclusions applied.
    26 pairs today.
  - **Decay** - a `lifetime.becomes` transition with a product:
    fire -> smoke, steam -> water. 2 today. (Smoke fades to nothing; a
    `becomes: null` decay is not an edge and not a discovery.)
  - **Growth** - the growth hook: moss + water -> vine, vine + water -> vine.
    2 today. (seed + mud -> moss is already a reaction row.)
- **Pre-known** - the 11 paintable elements (`PAINTABLE_IDS`). They sit in the
  rail from the first launch, so they are never "undiscovered".
- **Discoverable element** - a non-paintable product: obsidian, smoke, steam,
  sulphur, moss, vine. 6 today.
- **Witnessed** - the sim actually performed the transmutation in front of the
  player. Discovery is event-driven, never inferred from world contents.

Totals with today's roster: **17 elements (6 discoverable) and 30 interactions**.
All counts are derived from the registry at runtime, never hardcoded - a new
element or row changes the denominators automatically.

## 2. The graph is derived, not authored

Single source of truth: `createRegistry(v1Elements, v1Reactions)` plus the two
declared hook edges. The same derivation drives three consumers:

1. The repo's generated `apps/silt/docs/interaction-graph.md` (PR #122, branch
   `silt-interaction-graph`). Its derivation is a pure, DOM-free module at
   `apps/silt/src/docs/interactionGraph.ts`; this feature imports that module
   rather than re-deriving. (It lives under `src/docs/`, not `src/sim/`,
   because it also reads `PAINTABLE_IDS` from features/palette - importing
   that from inside `src/sim` would invert the layering.)
2. The in-app tree: nodes, edges, denominators.
3. The engine's witness recorder: the set of edge keys it may record.

Edge identity is name-based and canonical, e.g. `react:acid+wood` (names
sorted), `decay:fire`, `grow:moss`. Names, not ids, because names are what the
scene codec already treats as the stable identity across renumbering.

## 3. Discovery rules

- The 11 paintables are known from first launch.
- An **edge is discovered** the first time that interaction fires in the sim:
  `applyReactions` applies its pair, `applyLifetime` fires a decay with a
  product, or the growth hook grows a vine cell.
- An **element is discovered** when it is pre-known, or when any witnessed edge
  names it as a product. There is no separate element-detection path: every
  discoverable element is the product of at least one edge (obsidian and steam
  from water + lava, sulphur from acid + wood, moss from seed + mud, vine from
  growth, smoke from several). This keeps the engine seam to exactly one
  surface: edge witnessing.
- **Not** discoveries:
  - Painting (only pre-known elements are paintable) and spawner emission
    (spawners emit paintable species).
  - Scene restore. Loading a scene containing moss does not discover moss; the
    transmutations that made that scene were witnessed when they happened, and
    discovery is global (§5), so nothing is lost.
  - Anything in the paused state that is not a stepped tick - `step` counts as
    witnessing (it runs real ticks).

## 4. Engine detection (constraints for implementation, context for design)

Reactions fire inside the sim core, which runs in a worker over shared memory
(ADR 0036) or on the main thread in the local fallback. Perf is sacred (the
60fps/120fps epics), so:

- The recorder is owned by the sim core (not the worker glue), so both hosts
  get it. It is a flat witness table indexed by pair key / species id: one
  store per event, no allocation, no branching beyond a single "already seen"
  check, on the hot path only at the three transmutation sites
  (`applyReactions`, `applyLifetime`, the growth hook's `api.set`).
- Recording never touches the RNG and never changes sim behaviour - the
  determinism test must stay green with the recorder in place.
- Transport: discoveries are rare (30 firsts, ever), so the worker reports a
  first-witness as a message to the page rather than a per-frame shared-buffer
  poll. The simHost seam hides worker vs local, as it does for everything else.
- The page maps witnessed keys to the derived graph, updates persistence, and
  raises the UI moment.

## 5. Persistence

- Global progression, not per scene: one localStorage key of its own (the
  scenes feature's storage rules are the precedent, but this is a separate,
  tiny, name-keyed JSON blob - no quota drama).
- Shape (illustrative): `{ version: 1, edges: ["react:water+lava", "decay:fire", ...] }`.
  Element discovery is recomputed from edges + pre-knowns on load, so it is
  never stored and can never disagree.
- Forward-compatible: unknown edge keys on load are kept but ignored;
  a roster change simply changes the denominators. Renaming an element orphans
  its keys (same trade the scene codec already makes).
- Reset: a "forget discoveries" action behind the existing two-click armed
  confirm pattern (`useArmedConfirm`). Resetting the world does NOT reset
  discoveries.

## 6. UI structure (what exists; design decides how it looks)

- **Entry point**: a "Field notes" control in the header/status-bar chrome
  showing progress (e.g. "19/30") that opens the tree. The scenes popover is the precedent for
  page-chrome overlays; on mobile this becomes a full-screen sheet (mobile
  layout already has iwft coverage patterns).
- **The tree panel**: the full derived graph. It is a graph, not a strict tree
  (water -> steam -> water is a cycle), but it layers naturally:
  - Tier 0: the 11 paintables (the rail roster, ideally in rail order).
  - Tier n: products, placed by minimum transmutation steps from tier 0
    (obsidian/steam/smoke/sulphur/mud*/moss at 1, vine at 2).
    (*mud and stone are both paintable and products; they stay in tier 0.)
  - Layout is deterministic and derived from the same data, so a new element
    slots in without hand-editing positions. Design may curate within a tier.
- **Node states**: pre-known / discovered / undiscovered. Nodes are pixel-art
  styled square tiles; discovered tiles use the element's base colour
  (`colours[0]`, the same swatch the rail shows) and name.
- **Edge states**: witnessed (lit, labelled with its products) /
  unwitnessed-but-visible (see spoiler policy) / hidden.
- **Edge kinds** are visually distinguishable (reaction vs decay vs growth) -
  decay edges have one parent, reactions two.
- **Discovery moment**: when a first-witness arrives, a calm, small
  notification (silt is a quiet app - no confetti): the element/interaction
  name, and the tree control's count ticks up. If the tree is open, the new
  node/edge transitions from unknown to known in place.
- **Counts**: elements discovered / total, interactions discovered / total.
  100% is its own small moment (design's call how small).

## 7. Spoiler policy (decided)

**Silhouette, don't hide.**

- Undiscovered elements render as darkened "?" tiles: position and existence
  visible, identity hidden. The player can see the shape of what remains,
  which is what makes the chart a goal rather than a surprise log.
- Unwitnessed edges render as faint dashed connections with no product label
  when at least one endpoint is discovered; an edge between two undiscovered
  nodes stays hidden.
- Alternatives considered: full fog (only counts visible - makes the panel
  useless as a goal map) and full reveal (kills the mystery). The middle
  ground is the standard collection-game answer (Pokedex silhouettes) and
  gives claude-design the richest state set to work with.

## 8. Non-goals (v1)

- No server sync, no accounts - localStorage only, per ADR 0008.
- No hint system beyond the silhouettes ("try acid on wood" prompts are a
  possible v2).
- No achievements/badges beyond the completion counts.
- No per-scene discovery tracking.
- The repo markdown doc (§2.1) is for the maintainer, not linked in-app.

## 9. Decisions (resolved with Ed, 2026-09-03)

1. Spoiler policy: silhouettes (§7).
2. Name: **Field notes**.
3. Smoke fading to nothing is not a discovery - only transitions with a
   product are edges; the total stays 30. (The generated repo doc lists the
   fade in its table for completeness; the app ignores it.)
4. No persistent completion cosmetic: a small one-time moment when the last
   edge lights up, then the finished chart is the reward.

## 10. Handoff plan

1. ~~Ed confirms §9~~ Done.
2. Hand §1, §6, §7 to claude-design for mockups: the tree panel (desktop
   overlay + mobile sheet), node/edge states, the discovery notification, and
   the header control. Pixel-tile art direction is design's to own; the tile
   colours must stay the registry's `colours[0]` swatches.
3. Mockups come back here; tickets get cut under
   `.scratch/silt-discovery-tree/issues/` (engine recorder, persistence,
   derivation reuse, panel, notification), TDD throughout.
4. Interim prototyping, if any, uses dev-art placeholders.
