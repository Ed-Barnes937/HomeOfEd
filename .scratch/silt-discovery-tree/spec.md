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

- **Species** - the sim's own unit: one row of `v1Elements`, one owner of a
  byte (ADR 0043). 25 today.
- **Charted element** - the player's unit, and the only one this feature counts.
  Most species are one; the ones that exist because a byte needed an owner are
  **charted as** the element they belong to: `buried` as **seed** (it is what a
  seed does in mud, not a thing you can hold) and sprout, tip, stalk and petal
  as **flower** (stages and parts of one plant). 20 today. The mapping is
  presentation - it is declared in the graph derivation
  (`chartAs`, `src/docs/interactionGraph.ts`), never in the sim, and the doc
  that derivation generates still reports the raw chemistry (ticket 08).
- **Node** - a charted element, as the picker lists it. 20 today.
- **Edge** - one concrete interaction, in the sim's own names. Three kinds:
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
- **Entry** - an edge as the chart counts it: the same edge with every name
  charted. Several edges can land on one entry - `acid + flower` is backed by
  the five acid has with the plant's parts - and the entry is **witnessed when
  any of them fires, mastered only when all of them have** (ticket 08). What is
  stored stays raw and name-based, so nothing about this migrates.
- **Pre-known** - the 10 base paintable elements (`PAINTABLE_IDS`, with mud
  removed - see Mastery below). They sit in the rail from the first launch, so
  they are never "undiscovered".
- **Discoverable element** - a charted element that is not in the base rail:
  obsidian, smoke, steam, sulphur, moss, vine, ember, ash, mud, and - since the
  plant's parts chart as one (ticket 08) - flower. 10 today.
- **Witnessed** - the sim actually performed the transmutation in front of the
  player. Discovery is event-driven, never inferred from world contents.
- **Mastered** - every edge that names the element (as reagent or product) has
  been witnessed. Derived, like element discovery, from the witnessed-edge set.
- **Unlockable** - a discoverable element that joins the paint rail when
  mastered. **Every** discoverable is one (ticket 14, amending decision 6):
  mastery is the unlock, full stop, so the set is derived - charted elements
  minus the base rail - rather than a kept list, and a new discoverable is
  earnable the day it lands. 10 today, and the EARNED control lists them in
  that derived roster order rather than the order they were earned in: mastery
  is derived from a *set* of witnessed edges, which remembers no chronology, and
  a list that reorders itself as the roster fills would be the worse of the two.
  Mud stays the natural first unlock (two
  of its 6 edges need ash, so it pulls the player through the char chain); easy
  ones like steam and obsidian come early, which is fine - painting a gas is a
  toy, not an economy.

Totals with today's roster: **20 elements and 47 interactions** - the graph's 58
raw edges (48 reactions + 4 productive decays + 2 growth + 4 hook edges) folded
onto the charted names, where lava's, fire's and acid's spokes to the plant's
parts become one apiece and the burial joins `acid + seed` (ticket 08).
(This paragraph has now been updated four times - the counts here are
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
- An **element is discovered** when it is pre-known, or when a witnessed edge
  names it as a product - the edge the player actually saw, charted. A grouped
  entry never discovers what the parts of it that have *not* fired would leave:
  burning a stalk gives fire, not the steam a sprout gives (ticket 08). There is
  no separate element-detection path: every discoverable element is the product
  of at least one edge (obsidian and steam from water + lava, sulphur from acid
  + wood, moss from germination, flower from the germination that comes up dry,
  vine from growth, ember from fire + wood, ash from fire + ember, mud from dirt
  + water or ash + water, smoke from several).
  The premise was broken on purpose between the life-followup merge and ticket
  07 (decision 10); the hook edges restored it.
  This keeps the engine seam to exactly one surface: edge witnessing.
- An **element is mastered** when every edge naming it is witnessed - every
  *raw* edge, so a grouped entry masters nothing until all of the edges behind
  it have fired (decision 11). Mastery is derived from the same edge set -
  nothing extra is recorded. Note the consequence: an element can read its full
  `seen/total` and still be unstarred, because the count is over charted entries
  and the star is over the edges behind them.
- An **unlockable element joins the paint rail when mastered** - and every
  discoverable is unlockable (ticket 14), so mastering an element is what earns
  it, whichever one it is. Earned elements live in the EARNED control at the
  rail's foot (decision 8), so the 1-9 hotkeys never move however many arrive.
  Note the pacing mud still buys: two of its edges need ash, so it is a mid-game
  goal that pulls the player through the char chain (wood -> ember -> ash).
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
  (inverted chip). Nothing persists after 47/47. Desktop opens an overlay
  (1040px, scenes-popover chrome: 2px ink border, 6px offset shadow); mobile
  is a full-screen sheet.
- **Counters** pinned in the panel header: elements `n/20`, interactions
  `n/47`, plus a `NEW n` chip counting elements newly seen since the panel
  was last opened. All derived, never stored.
- **Picker** (left column desktop, wrapped tile rows on phone): every element
  in tier order then rail order, each with its own `seen/total` count.
  Tier 0 = the 10 base paintables in rail order; products at minimum
  transmutation depth (obsidian/steam/smoke/sulphur/mud/moss/ember/flower 1,
  vine/ash 2 - charting buried as the seed it is put the whole plant one step
  off the rail, ticket 08). Undiscovered elements keep their slot as a dark "?" tile with
  `- - -` for the name, and are not selectable. Layout is deterministic from
  the data - no hand-placed nodes.
- **Ring**: the selected element centred, one spoke per **witnessed** entry.
  The ring is **icons-only**: a tile at each spoke point, its name under it, and
  the arrowhead - no words along the line. Ticket 20's measurement is why (the
  ring has about 10.4 arc units of label room per spoke at capacity, against
  labels up to 16), and ticket 25 is the change; PoE, constellation UIs and
  Neo4j Bloom all land in the same place. Unwitnessed entries are never drawn;
  a `still to find: n` row with empty notches counts what remains without
  naming it (decision 9).
- **The reading line**: one fixed-height band under the ring holding the
  **active** spoke - hovered or keyboard-focused on desktop, tapped on phone -
  as a recipe row of tiles with their names: `lava + water -> steam · obsidian`.
  Zero-product edges are entries too and read "both consumed"; a stage of one
  element's own life (ticket 08) reads as that element alone, since an arrow
  from a thing to itself says nothing; a merged spoke (ticket 09) lists its
  members in the reagent slot they differ in, with its `2/5` chip. The band's
  height never changes - an unread ring shows a quiet hint - so the ring above
  never jumps. **Tapping is split in two**: a ring tile *reads* its spoke into
  the band, and a tile *in the band* is what follows an element, so a mis-tap
  on the ring no longer throws the player onto another element's chart.
- **The bottom band** is those two rows: the focused element's tag chips
  (ticket 12) first, because they describe the ELEMENT, then the reading line,
  because it describes the SPOKE.
- **One definition of "an entry"**: an edge counts for an element when the
  element is a reagent *or* a product. The picker count, the ring, the
  still-to-find footer and the unlock chip all read the same predicate -
  splitting them is the bug that empties the ring for product-only elements.
- **Element tiles**: one helper builds every tile from `hex` + archetype.
  Shape carries behaviour: static square, powder cut-corner, liquid diamond,
  gas hexagon; a two-stop pixel shade over the element's `colours[0]`.
  Sizes 18/22/30/40/56px per the mockup.
- **Node states**: pre-known and discovered share one treatment (ink plate
  edge); undiscovered is the dark "?" tile; **new since last opened** swaps
  the plate edge to the live green `#3ecf6b` until selected; **mastered**
  (every edge touching the element witnessed) adds a small drawn star after
  the name - no colour, no badge. The same star is drawn **hollow** when every
  charted entry is witnessed but a raw edge behind a grouped one is not
  (ticket 18, decision 11): one glyph in two weights, since the fill is what
  says "earned" and the shape is what says "this element's star".
- **Edge kinds**: reaction solid, decay long-dashed with an arrowhead at the
  product, growth dotted with an arrowhead. An arrowhead pointing into the
  centre means the pair produces the focused element. A **stage** spoke - one
  whose every name is the focused element itself, which is what the raise and
  the bloom become once charted (ticket 08) - carries none: both ends of the
  arrow would be the centre.
- **The unlock**: every unearned discoverable's picker row states
  `n/m to unlock` (ticket 14 - mud's is `n/6`). On mastery an
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
  NEW list - may name a hidden element's name, hex or products.** Since ticket
  25 the reading line is the only place the panel puts an interaction into
  words at all, so the invariant has one text site to hold rather than up to
  two dozen per ring. A ring tile is a control whatever its element's state -
  it reads a spoke rather than navigating, and a masked reading names nothing.
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
   a mastered unlockable joins the paint rail. This is an app change
   (`PAINTABLE_IDS` shrinks; the rail becomes base + unlocked), not just a chart
   change - it gets its own ticket.
   *Amended 2026-09-04 (ticket 14, Ed on PR #128):* the unlockables were mud
   alone; they are now **every charted non-base element**, derived rather than
   listed. Mastery is the unlock full stop - a per-element opt-in was a knob with
   no case to turn it, and shipping one earnable element out of ten made the
   other nine's `n/m` counts a dead end. The derivation runs over *charted*
   elements (ticket 08), so a grouped element is earned and painted as its own
   canonical species: flower earns flower, never tip or stalk.
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
    producer-less picker fallback is gone. 58 raw edges with today's roster.
11. **Species are charted, not listed** (2026-09-04, ticket 08, on PR #128
    review): the chart's unit is the player's element, not the sim's species,
    so `buried` charts as seed and sprout/tip/stalk/petal as flower (§1). Three
    rulings shape it: a grouped entry is witnessed by *any* of the raw edges
    behind it and mastered only by all of them (depth kept, hunting removed);
    germinate, raise and bloom stay as separate charted stage entries under
    flower rather than dropping out as self-loops, so the life cycle is still a
    story to find; and the group's name is **flower**. The mapping is
    presentation, in the graph derivation and not the sim, and the stored
    witness keys stay raw - nothing migrates. 20 elements, 47 entries.

    **Resolved 2026-09-05 by ticket 18 (Ed's triage: the partial star).** The
    two halves of the first ruling pull apart on the elements that own a grouped
    entry - flower, fire, lava, acid, seed: their picker row counts charted
    entries, so it can read `9/9` with `still to find: 0` while the star waits on
    raw edges §7 forbids the panel from naming. The ruling is unchanged and the
    star gains a third state instead: **hollow/partial** when every charted entry
    involving the element is witnessed but a raw edge behind a grouped one is
    not. Display only - no count, no unlock and no derivation moves, and the
    filled star is still all raw edges and still the unlock trigger. It is
    honest inside §7 because it says only *that* something is left, never what;
    the tapped spoke's members and its `x/y` chip (tickets 09/25) are where the
    gap is already visible. Elements whose entries are each one raw edge - mud's
    six - can never show it, so the unlock and completion moments read exactly as
    before. `panelModel`'s `masteryOf` is the one derivation, defined as
    `seen === total` without mastery, so the row count and the star cannot
    contradict each other by construction; a screen reader gets "mastered" or
    "more to see here".

## 10. Handoff plan

1. ~~Ed confirms §9 1-4~~ Done.
2. ~~Hand the design brief to claude-design for mockups~~ Done - handoff
   received 2026-09-03 (local-only under `handoff/mockups/`; deviations
   accepted as decisions 7-9 and folded into §6-§7 above, which are the
   committed source of truth for implementation).
3. Tickets are cut under `.scratch/silt-discovery-tree/issues/`, TDD
   throughout.
4. Interim prototyping, if any, uses dev-art placeholders.
