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

- **Node** - an element in the roster (19 today; `v1Elements`).
- **Edge** - one concrete interaction. Three kinds:
  - **Reaction** - an unordered pair from the resolved registry
    (`reactionFor`), tag rows expanded, `maxHardness` exclusions applied.
    32 pairs today.
  - **Decay** - a `lifetime.becomes` transition with a product:
    fire -> smoke, steam -> water, ember -> fire. 3 today. (Smoke fades to
    nothing; a `becomes: null` decay is not an edge and not a discovery.)
  - **Growth** - the growth hook: moss + water -> vine, vine + water -> vine.
    2 today. (seed + mud -> buried is a reaction row.)
  - **Hook** - a hook transmutation the derived graph declares (ticket 07):
    `germinate:moss` (buried + standing water -> moss), `germinate:sprout`
    (buried, sky open -> sprout), `raise:sprout` (sprout -> tip + stalk),
    `bloom:tip` (tip -> flower). 4 today. The tip's climb, petal shedding,
    evaporation and the germination dirt refund are deliberately not entries.
- **Pre-known** - the 10 base paintable elements (`PAINTABLE_IDS`, with mud
  removed - see Mastery below). They sit in the rail from the first launch, so
  they are never "undiscovered".
- **Discoverable element** - a product not in the base rail: obsidian, smoke,
  steam, sulphur, moss, vine, ember, ash, and now mud. 9 today.
- **Witnessed** - the sim actually performed the transmutation in front of the
  player. Discovery is event-driven, never inferred from world contents.
- **Mastered** - every edge that names the element (as reagent or product) has
  been witnessed. Derived, like element discovery, from the witnessed-edge set.
- **Unlockable** - a discoverable element that joins the paint rail when
  mastered. v1 has exactly one: mud (6 edges since the life epic: dirt+water,
  ash+water, mud+fire, mud+lava, mud+seed, mud+petal).

Totals with today's roster: **25 elements and 58 interactions** (48 reactions +
4 productive decays + 2 growth edges + 4 hook edges, after ticket 07 charted
the life epic's hooks).
(This paragraph has now been updated three times - the counts here are
illustrative; the registry is the truth.)
All counts are derived from the registry at runtime, never hardcoded - a new
element or row changes the denominators automatically.

## 2. The graph is derived, not authored

Single source of truth: `createRegistry(v1Elements, v1Reactions)` plus the
declared hook edges (growth's two, and ticket 07's four transmutations). The
same derivation drives three consumers:

1. The repo's generated `apps/silt/docs/interaction-graph.md` (PR #122;
   regenerated for the burnables roster in PR #124). Its derivation is a pure, DOM-free module at
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

- The 10 base paintables are known from first launch.
- An **edge is discovered** the first time that interaction fires in the sim:
  `applyReactions` applies its pair, `applyLifetime` fires a decay with a
  product, or a hook reports its own transmutation (growth's vine cell, a
  germination, the sprout's raise, the tip's bloom - ticket 07).
- An **element is discovered** when it is pre-known, or when any witnessed edge
  names it as a product. There is no separate element-detection path: every
  discoverable element is the product of at least one edge (obsidian and steam
  from water + lava, sulphur from acid + wood, buried from seed + mud, moss and
  sprout from germination, tip and stalk from the raise, flower from the bloom,
  petal from the flower's decay, vine from growth, ember from fire + wood, ash
  from fire + ember, mud from dirt + water or ash + water, smoke from several).
  The premise was broken on purpose between the life-followup merge and ticket
  07 (decision 10); the hook edges restored it.
  This keeps the engine seam to exactly one surface: edge witnessing.
- An **element is mastered** when every edge naming it is witnessed. Mastery is
  derived from the same edge set - nothing extra is recorded.
- An **unlockable element joins the paint rail when mastered** (appended after
  seed; the 1-9 hotkeys never move). v1: mastering mud's 5 edges makes mud
  paintable. Note the pacing this buys: two of mud's edges need ash, so the
  unlock is a mid-game goal that pulls the player through the char chain
  (wood -> ember -> ash), not a freebie.
- **Not** discoveries:
  - Painting (painting requires a known element - the base rail or an earned
    unlock, whose edges are by definition already witnessed) and spawner
    emission (spawners emit paintable species; an unlocked element is fully
    paintable, spawners included).
  - Scene restore. Loading a scene containing moss does not discover moss; the
    transmutations that made that scene were witnessed when they happened, and
    discovery is global (§5), so nothing is lost. Likewise a pre-trim scene
    with painted mud restores fine (scenes remap by name) but does not unlock
    mud.
  - Anything in the paused state that is not a stepped tick - `step` counts as
    witnessing (it runs real ticks).

## 4. Engine detection (constraints for implementation, context for design)

Reactions fire inside the sim core, which runs in a worker over shared memory
(ADR 0036) or on the main thread in the local fallback. Perf is sacred (the
60fps/120fps epics), so:

- The recorder is owned by the sim core (not the worker glue), so both hosts
  get it. It is a flat witness table indexed by pair key / species id: one
  store per event, no allocation, no branching beyond a single "already seen"
  check, on the hot path only at the transmutation sites (`applyReactions`,
  `applyLifetime`, and the hooks' own reports - growth's `api.set`, the seed
  bank's germination, the sprout's raise and the tip's bloom).
- Recording never touches the RNG and never changes sim behaviour - the
  determinism test must stay green with the recorder in place.
- Transport: discoveries are rare (a few dozen firsts, ever), so the worker reports a
  first-witness as a message to the page rather than a per-frame shared-buffer
  poll. The simHost seam hides worker vs local, as it does for everything else.
- The page maps witnessed keys to the derived graph, updates persistence, and
  raises the UI moment.

## 5. Persistence

- Global progression, not per scene: one localStorage key of its own (the
  scenes feature's storage rules are the precedent, but this is a separate,
  tiny, name-keyed JSON blob - no quota drama).
- Shape (illustrative): `{ version: 1, edges: ["react:water+lava", "decay:fire", ...] }`.
  Element discovery, mastery and rail unlocks are all recomputed from edges +
  pre-knowns on load, so none of them is stored and none can disagree. The
  mud unlock costs the schema nothing.
- Forward-compatible: unknown edge keys on load are kept but ignored;
  a roster change simply changes the denominators. Renaming an element orphans
  its keys (same trade the scene codec already makes).
- Reset: a "forget discoveries" action behind the existing two-click armed
  confirm pattern (`useArmedConfirm`). Resetting the world does NOT reset
  discoveries.

## 6. UI structure (as designed - mockups accepted 2026-09-03)

The claude-design handoff (local-only: `handoff/mockups/` beside this spec -
`field-notes-standalone.html` is the interactive mockup, its `README.md` the
design notes) replaced the brief's whole-graph chart with a **picker + ring**,
accepted as decision 7. The graph is never shown whole; the panel shows one
element at a time, so the picture does not get busier as the roster grows.

- **Entry point**: a "Field notes" control in the header next to SCENES:
  the words plus `witnessed/total` interactions. States: untouched (greyed
  numerals), in progress, a ~250ms inverted tick-up on witness, complete
  (inverted chip). Nothing persists after 37/37. Desktop opens an overlay
  (1040px, scenes-popover chrome: 2px ink border, 6px offset shadow); mobile
  is a full-screen sheet.
- **Counters** pinned in the panel header: elements `n/19`, interactions
  `n/37`, plus a `NEW n` chip counting elements newly seen since the panel
  was last opened. All derived, never stored.
- **Picker** (left column desktop, wrapped tile rows on phone): every element
  in tier order then rail order, each with its own `seen/total` count.
  Tier 0 = the 10 base paintables in rail order; products at minimum
  transmutation depth (obsidian/steam/smoke/sulphur/mud/ember 1, moss/ash 2,
  vine 3). Undiscovered elements keep their slot as a dark "?" tile with
  `- - -` for the name, and are not selectable. Layout is deterministic from
  the data - no hand-placed nodes.
- **Ring**: the selected element centred, one spoke per **witnessed** entry.
  A spoke carries its outcome as text plus the product elements' own small
  tiles, which are tappable (focus follows). Unwitnessed entries are never
  drawn; a `still to find: n` row with empty notches counts what remains
  without naming it (decision 9). Zero-product edges are entries too - they
  read "both consumed".
- **One definition of "an entry"**: an edge counts for an element when the
  element is a reagent *or* a product. The picker count, the ring, the
  still-to-find footer and mud's unlock chip all read the same predicate -
  splitting them is the bug that empties the ring for product-only elements.
- **Element tiles**: one helper builds every tile from `hex` + archetype.
  Shape carries behaviour: static square, powder cut-corner, liquid diamond,
  gas hexagon; a two-stop pixel shade over the element's `colours[0]`.
  Sizes 18/22/30/40/56px per the mockup.
- **Node states**: pre-known and discovered share one treatment (ink plate
  edge); undiscovered is the dark "?" tile; **new since last opened** swaps
  the plate edge to the live green `#3ecf6b` until selected; **mastered**
  (every edge touching the element witnessed) adds a small drawn star after
  the name - no colour, no badge.
- **Edge kinds**: reaction solid, decay long-dashed with an arrowhead at the
  product, growth dotted with an arrowhead. An arrowhead pointing into the
  centre means the pair produces the focused element.
- **The unlock**: mud's picker row states `n/5 to unlock`. On mastery an
  **EARNED control appears at the rail's foot** (scenes-popover chrome) and
  holds everything earned since - one control, however many unlocks follow
  (decision 8). No locked placeholder beforehand; hotkeys 1-9 never move.
- **Moments**: discovery and unlock share one quiet card, bottom-left over
  the canvas (opposite the run pill), rise ~400ms, hold ~2.5s, fade.
  Discovery: tile + "new entry" + name. Unlock: tile + "mud - 5 of 5" +
  "mud joins your rail". The 100% moment is one line over the world in the
  first-visit hint's type, once. No confetti, nothing persistent.

## 7. Spoiler policy (decided; tightened by the accepted design)

**Silhouette, don't hide - and never name.**

- Undiscovered elements keep their picker slot as a darkened "?" tile:
  position, shape (archetype) and existence visible, identity hidden. The
  player sees the shape of what remains, which is what makes the chart a goal
  rather than a surprise log.
- Unwitnessed interactions are never drawn (decision 9): the per-element
  `still to find: n` notches and per-row `seen/total` counts stand in for the
  brief's faint dashed edges.
- The invariant, from the design notes: **nothing in the panel - not even the
  NEW list - may name a hidden element's name, hex or products.**
- Alternatives considered: full fog (only counts visible - makes the panel
  useless as a goal map) and full reveal (kills the mystery).

## 8. Non-goals (v1)

- No server sync, no accounts - localStorage only, per ADR 0008.
- No hint system beyond the silhouettes ("try acid on wood" prompts are a
  possible v2).
- No achievements/badges beyond the completion counts.
- No whole-graph overview mode (the ring + picker is v1's whole answer;
  decision 7).
- No per-scene discovery tracking.
- The repo markdown doc (§2.1) is for the maintainer, not linked in-app.

## 9. Decisions (resolved with Ed, 2026-09-03)

1. Spoiler policy: silhouettes (§7).
2. Name: **Field notes**.
3. Smoke fading to nothing is not a discovery - only transitions with a
   product are edges (37 with today's roster). (The generated repo doc lists
   the fade in its table for completeness; the app ignores it.)
4. No persistent completion cosmetic: a small one-time moment when the last
   edge lights up, then the finished chart is the reward.
5. The rail is trimmed to base elements: **mud leaves `PAINTABLE_IDS`** (it is
   dirt + water's product). Stone, dirt, fire and wood stay - stone/dirt/fire
   are core tools whose product status is incidental, and wood's only recipe
   (dousing ember) needs wood, so trimming it would kill the whole char chain.
6. **Mastery unlock**: witnessing every edge that names an element masters it;
   a mastered unlockable joins the paint rail. v1's only unlockable is mud.
   This is an app change (`PAINTABLE_IDS` shrinks; the rail becomes base +
   unlocked), not just a chart change - it gets its own ticket.
7. **Ring + picker accepted** over the brief's whole-graph chart (design's
   pivot, accepted): scales with the roster; the picker's "?" slots and
   per-element counts preserve the goal-map function. A whole-graph overview
   is a v2 candidate at most (§8).
8. **EARNED control accepted** over inline rail insertion: unlocked elements
   live in one control at the rail's foot, so hotkeys and rail length are
   stable however many unlockables arrive.
9. **Still-to-find notches accepted** over faint dashed unwitnessed edges:
   unwitnessed entries are never drawn; counts carry the remaining mystery.
10. **The life epic's hook-born elements are uncharted, interim** (2026-09-04,
    on merging life-followup): moss, sprout, tip, stalk and flower are created
    by onTick hooks the derived graph cannot yet express, so no edge produces
    them and they are undiscoverable silhouettes (and untiered, along with
    vine and petal, whose recipes' reagents are among the five - both stay
    discoverable through `grow:moss` and `decay:flower`). This breaks §3's
    "every discoverable element is the product of at least one edge" premise
    on purpose and only for now: ticket 07 charts the hooks (germinate/raise/
    bloom edges + their witness sites) and restores it. A death drop's brood
    (`lifetime.emits`, the flower's petals) counts as a product of the decay
    it rides on - that is what keeps petal discoverable meanwhile.
    **Resolved 2026-09-04 by ticket 07**: the four hook edges are in the graph
    (`HookEdge` in the generator, witness sites in `seedBank.ts`/`stalk.ts`),
    the premise above holds again, every element is tiered, and the interim
    producer-less picker fallback is gone. 58 entries with today's roster.

## 10. Handoff plan

1. ~~Ed confirms §9 1-4~~ Done.
2. ~~Hand the design brief to claude-design for mockups~~ Done - handoff
   received 2026-09-03 (local-only under `handoff/mockups/`; deviations
   accepted as decisions 7-9 and folded into §6-§7 above, which are the
   committed source of truth for implementation).
3. Tickets are cut under `.scratch/silt-discovery-tree/issues/`, TDD
   throughout.
4. Interim prototyping, if any, uses dev-art placeholders.
