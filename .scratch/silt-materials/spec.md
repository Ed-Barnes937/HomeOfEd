# Spec: Silt materials — fire, acid, soil, life

Extends the v1 roster (`.scratch/sand-sim/spec.md` §4) from five elements and one
reaction to seventeen elements and eighteen reactions, in four sequential PRs.

Everything here is config in `apps/silt/src/sim/elements.ts` except one
`onTick` hook in PR 04. No archetype is added; no engine subsystem is added.

## 1. Engine constraints this design is built around

These were established by reading the engine, and each one shapes a decision
below. They are easy to break by accident.

1. **One reaction per ordered pair, full stop.** `resolvePairs`' `add()` refuses
   to overwrite an existing key, and `applyReactions` moves on to the *next
   neighbour* when a probability draw fails — it never falls through to a second
   rule for the same pair. There is no "30% this, 70% that". `p` is a **rate**
   (how soon the one outcome happens), never a **split**.
2. **Row order is load-bearing.** A tag row registers every pair it covers, so a
   specific row for a pair inside that tag must come **first** or it never lands
   — silently. See `acid + wood` below.
3. **`become`/`set` clear the target's scratch bytes** (`grid.write`). A row whose
   `aBecomes` names the element itself resets its `ra`, restarting any lifetime.
   For fire this is the desired behaviour — fire touching fuel stays alive — but
   it is a trap anywhere a countdown must survive a reaction.
4. **`maxHardness` gates both sides at boot**, and a pair it excludes is simply
   never registered rather than re-checked per tick. This is how sulphur is made
   un-re-corrodible by construction rather than by a guard.
5. **Never write a tag row whose tag includes the element on the other side.**
   `acid + [liquid]` would register acid↔acid, acid↔oil and acid↔lava at once,
   including a self-pair. Name partners explicitly where the tag overlaps.
6. **`MAX_LIFETIME_TICKS` is 255**, at `TICKS_PER_SECOND` 60 — nothing lives
   longer than 4.25 seconds without chaining into a second element.
7. **`canDisplace` is `mine > theirs` and is not direction-aware.** A rising gas
   pushes through another gas only when it is the *denser* one, so **the gas
   closest to zero ends up highest**. Getting this backwards puts fire on top of
   its own smoke.

## 2. Density ladder

```
smoke −5  ·  steam −10  ·  fire −20  │ EMPTY │  oil 20 · water 30 · acid 35 ·
seed 40 · lava 45 · mud 50 · sulphur 55 · sand 60
```

Consequences that are deliberate: oil floats on water; acid sinks under water;
seed sinks through water and rests *on* mud rather than burying itself; sand
remains the ceiling and sinks through everything (v1's existing note).

## 3. Roster

Ids are pinned and never renumbered — species bytes go into localStorage scenes.

| id | element | archetype | tags | hardness | lifetime | paint | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | dirt | static | solid | 0 | | yes | v1 |
| 2 | sand | powder d60 slide 1 | powder | 0 | | yes | v1 |
| 3 | water | liquid d30 disp 5 | liquid | | | yes | v1 |
| 4 | lava | liquid d45 disp 2 move .15 | liquid | | | yes | v1 |
| 5 | obsidian | static | solid | **5** | | no | v1 |
| 6 | wood | static | solid, flammable | **1** | | yes | 01 |
| 7 | oil | liquid d20 disp 4 | liquid, flammable | | | yes | 01 |
| 8 | fire | gas d−20 disp 1 move .3 | gas, energy | | 40 +0..20 → smoke | yes | 01 |
| 9 | smoke | gas d−5 disp 3 | gas | | 200 +0..55 → null | no | 01 |
| 10 | steam | gas d−10 disp 4 | gas | | 180 +0..60 → water | no | 01 |
| 11 | acid | liquid d35 disp 4 | liquid | 0 | | yes | 02 |
| 12 | stone | static | solid | **3** | | yes | 02 |
| 13 | sulphur | powder d55 slide 1 | powder, flammable | **2** | | no | 02 |
| 14 | mud | liquid d50 disp 1 move .1 | liquid | | | yes | 03 |
| 15 | seed | powder d40 slide 1 | powder, flammable | 0 | | yes | 04 |
| 16 | moss | static | solid, flammable | 0 | | no | 04 |
| 17 | vine | static | solid, flammable | 0 | | no | 04 |

Hardness on the existing dirt/sand/obsidian is added in PR 02, where it first
matters. Lifetime values are opening guesses to be tuned, not decisions.

**Jitter is one-sided.** `applyLifetime` computes `ticks + randInt(jitter + 1)`,
so `200 +0..55` means a range of 200–255, never 145–255. Smoke's `200 + 55` lands
exactly on `MAX_LIFETIME_TICKS`, so raising either number is a boot failure, not a
slow fuse.

Paintable is an explicit list in `paletteGroups.ts`, not a tag — adding an
element does not add it to the rail, and the safe default is the right way
round. Fire is paintable so the **Energy** rail group renders for the first
time; the alternative (lava as the only match) was considered and rejected for
that reason.

## 4. Reaction table

**In this order.** Row order decides which rule claims a pair.

| # | a | b | p | a becomes | b becomes | PR | why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | water | lava | 1 | steam | obsidian | 01 | *changes v1* — was obsidian + obsidian |
| 2 | water | fire | 1 | steam | smoke | 01 | quenching **is** the steam source |
| 3 | fire | [flammable] | 0.4 | fire | fire | 01 | one row covers every fuel, now and later |
| 4 | lava | [flammable] | 0.15 | lava | fire | 01 | lava ignites and survives |
| 5 | acid | wood | 0.3 | **sulphur** | ∅ | 02 | **must precede rows 6–7** |
| 6 | acid | [solid] | 0.3 | ∅ | ∅ | 02 | `maxHardness: 1` |
| 7 | acid | [powder] | 0.3 | ∅ | ∅ | 02 | `maxHardness: 1` |
| 8 | acid | water | 1 | water | water | 02 | water neutralises acid |
| 9 | acid | lava | 1 | smoke | lava | 02 | acid boils off |
| 10 | water | dirt | 0.4 | ∅ | mud | 03 | water is spent |
| 11 | mud | fire | 1 | dirt | smoke | 03 | fire **dries** |
| 12 | mud | lava | 1 | stone | lava | 03 | lava **bakes** |
| 13 | seed | mud | 1 | moss | mud | 04 | soil is not consumed |

Deliberate non-edges: acid + oil (oil floats on acid and shrugs it off — it is
the container for acid); acid + any gas; acid + stone/obsidian/sulphur (hardness).

### Volume rules

Two cells in, one out, wherever a material is spent:

- `acid + wood → (sulphur, ∅)` — residue on the **acid** side. The cavity is
  genuinely dug and the spent acid leaves the grain. The other arrangement
  (`∅, sulphur`) converts the wall into a sulphur wall and digs nothing.
- Residue is **wood only**, not "organic". Generalising it means acid plugs its
  own hole with a grain it cannot dissolve, and stops being usable as a tool.
  Moss, vine and seed dissolve cleanly via rows 6–7 with no new rows and no new
  tag — they only need hardness 0.
- `water + dirt → (∅, mud)` — same shape.

## 5. Growth (PR 04)

Sprouting is a reaction (row 13). Growth is not, and this is the one place the
reaction table is genuinely the wrong tool.

The pure-reaction version — `moss + water → (moss, vine)`, the water cell that
lands on the plant *becomes* the plant — works, needs no hook, and was rejected
for two reasons: it has **no direction** (water pools sideways and below as
readily as above, so it grows a blob, not a vine) and **no brake** (a vine
dropped in a lake turns the lake into vine; lowering `p` only slows it).

So vine and moss share one `onTick`:

- inspect orthogonal neighbours, **up first**, then the sides
- if one is water, and `rand() < p`, and `ra < BRANCH_BUDGET`:
  `set(neighbour, vine)` and `ra++`

Water is the resource; growth is bounded by how much water reaches the plant.
`ra` caps how many times any single cell may branch, so a cell sitting in a
pool cannot fan out without limit.

**`ra` ownership**: the spec's rule is that the engine's `lifetime` feature owns
`ra`. Moss and vine have no lifetime, so nothing is claiming it and the hook may.
This is the first use of `ra` outside the engine and needs a comment saying
exactly that.

## 6. PR sequence

Strictly linear — there is no parallelising these.

| PR | title | adds | rows | new machinery |
| --- | --- | --- | --- | --- |
| 01 | Fire | wood, oil, fire, smoke, steam | 1–4 | first `gas`, first `lifetime` |
| 02 | Acid | acid, stone, sulphur + hardness pass | 5–9 | first `maxHardness` |
| 03 | Soil | mud | 10–12 | none |
| 04 | Life | seed, moss, vine | 13 | **first `onTick` hook** |

01 carries the engine-exercise risk for gas and lifetime. 04 carries it for
hooks, element-authored neighbour writes, and unbounded growth — its hook gets
its own ticket, separate from its elements.

## 7. Held back

- **Ember / ash.** Wood burning to `ember → ash` rather than straight to fire.
  Nicer, but it changes PR 01's chemistry after it has just been tuned, and
  sulphur already gives the roster a burnable byproduct. Revisit after 01 ships.
- **A genuine probabilistic split** on one pair. Needs an engine change (a
  weighted row list per pair). Nothing in this spec wants it.
- **Explosions, sparks, heat and pressure fields.** Unchanged from
  `.scratch/sand-sim/spec.md` — out of scope, and sparks would force the fifth
  `particle` archetype the v1 spec names as an accepted future cost.

## 8. Watch items

- **The rail fills up.** Paintable goes 4 → 11. `paletteGroups.ts` says the rail
  was "built for a roster that will triple" — that is 12. PR 04 must carry an
  explicit mobile-rail check rather than assuming it still fits.
- **Fire rising off its fuel.** Fire is a gas, so it leaves the wood it is
  burning. `move: 0.3` is there to make it linger; expect to tune it.
- **Row 1 changes shipped behaviour.** Existing saved scenes are unaffected
  (species bytes are pinned) but water-on-lava now yields steam as well as
  obsidian. Accepted deliberately: it makes the water cycle visible.
