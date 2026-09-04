# 0050 - silt: acid corrodes living matter to sulphur, and leaves water alone

- **Status:** Accepted
- **Date:** 2026-09-04
- **Related:** `.scratch/silt-discovery-tree/issues/15-acid-eats-life-to-sulphur.md`
  and `.scratch/silt-discovery-tree/issues/16-acid-water-rethink.md` (Ed's triage
  rulings, both binding); `.scratch/silt-materials/spec.md` §3-§4, which this ADR
  **supersedes in two places**. The table is `apps/silt/src/sim/elements.ts`; the
  cases are in `apps/silt/src/sim/acid.test.ts` and `life.test.ts`.

Both rulings came out of the same review of the field-notes chart (PR #128), and
both are the same kind of change - a line in the reaction table that read wrong
once the chart made every interaction visible. One ADR, two sections.

## 1. Acid corrodes all living matter to sulphur

### Context

`acid + wood -> sulphur` was sulphur's only recipe. Every other living thing is
hardness 0, so acid's `[solid]` and `[powder]` rows erased them with no residue:
acid digesting a plank left brimstone, acid digesting a meadow left nothing. Once
the field notes charted the roster, that asymmetry read as an oversight rather
than as a rule, and sulphur's only supply was the paintable wood the player
brings rather than anything the world grows.

The materials spec had already considered and rejected this:

> Residue is **wood only**, not "organic". Generalising it means acid plugs its
> own hole with a grain it cannot dissolve, and stops being usable as a tool.
> Moss, vine and seed dissolve cleanly via rows 6-7 with no new rows and no new
> tag - they only need hardness 0.
>
> - `.scratch/silt-materials/spec.md` §4, *Volume rules*

### Decision

Overturned, on Ed's ruling: acid + each of moss, vine, seed, sprout, stalk, tip,
flower and petal leaves sulphur on the acid side and clears the plant cell, at
p 0.3 - wood's numbers exactly. **Ember and ash keep the plain dissolve**: they
are spent material already, not living tissue. `buried` keeps it too; the roster
Ed confirmed names the eight above and rules on ember and ash, and nothing said
the underground seed should differ from the tag rows it already sat under.

Eight literal rows rather than a `plantMatter` tag. The registry expands tag rows
before anything downstream sees them, so the graph doc and the field-notes
denominators are identical either way; what a tag would add is a membership
question - which future plant part joins, and on whose say-so - in exchange for a
shorter block. Named rows above a tag row is the shape the table already uses for
the `fire + <fuel>` ignition ladder.

**Row order is load-bearing.** All eight sit above `acid + [solid]`/`[powder]`,
because `resolvePairs` keeps the first registration and drops the rest in
silence. Three tests fail on a reorder.

### Consequence, measured - acid is now a weaker tool against a plant wall

The spec's stated objection was real, and it landed. The residue backfills the
cavity, and acid cannot eat sulphur (hardness 2 against `maxHardness: 1`), so
**acid armours the bed it is eating**. Over 30 seeds on the 63-cell reference
bed, a bath now leaves 31-41 cells of moss or vine standing with 12-22 cells of
acid stalled on top of its own brimstone; the old cavity-digging row cleared all
but about 20 and spent nearly every drop. A powder bed still clears (seed: 19-21
survivors), because the grains shift and the acid follows.

This is the trade the ruling buys: sulphur gets a renewable route through the
life loop, and acid stops being a universal solvent for standing plants. It is
pinned in `life.test.ts` rather than smoothed over, so a later re-tune starts
from the number rather than from a surprise. **If it plays wrong, the knob is the
p or the residue side, not the roster.**

## 2. Acid and water coexist

### Context

`acid + water -> water + water` at p 1 (materials spec §3, row 8, "water
neutralises acid") made a single drip a total, instant counter to a whole pool.
In the field notes it also charted as the only entry where two things go in and
one of them comes out unchanged, which is what put it in front of a reader at
all.

### Decision

Remove the row. Acid and water coexist and density decides the layering (acid 35
against water 30), exactly as it does for every other pair of liquids. **Stone
stays the one acid-proof answer**, which is stone's whole job.

Nothing migrates: the field notes' denominators are derived from the registry on
every load, and a stored `react:acid+water` key is carried-but-ignored, as
`fieldNotesStore` already promises for any key the roster no longer holds.

### Alternatives rejected

- **Dilution with a residue** (`-> water + smoke`): keeps the counter mechanic
  and gives the entry a visible product. Rejected because the counter itself is
  what read wrong, not its lack of a puff.
- **Acid taints water** (`-> acid`): dramatic, and chemically honest-ish, but it
  makes acid self-multiplying. That is a real balance change and deserves its own
  play-test rather than a footnote to this one.
