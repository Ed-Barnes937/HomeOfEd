# 15 - Acid + plant matter leaves sulphur, like wood does

**Status:** needs-triage
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04) - "acid + wood is the only
way to make sulphur - maybe we should make acid + [life] (wood/vine/flower/etc)
too?". Phrased as a maybe, so triage before building; recommendation: yes.
**Spec:** sim content, not panel - `.scratch/silt-materials/spec.md` is the
acid/hardness context; the field notes derivation picks the rows up
automatically (discovery-tree spec §2).

Today `acid + wood -> sulphur` (`elements.ts:742`) is sulphur's only recipe.
Every other living thing is hardness 0, so acid's `[solid]`/`[powder]` rows
(`elements.ts:745-746`) erase it with no residue - acid digesting a meadow
leaves nothing, digesting a plank leaves brimstone. Thematically the wood row's
own rationale (spent acid leaves a grain behind) applies to all organic matter,
and it gives sulphur a renewable route through the life loop instead of only
through the paintable wood supply.

## Design (proposed)

- Explicit rows `acid + <plant> -> sulphur` (acid side becomes sulphur, plant
  side null, p 0.3 - wood's numbers) for the living roster: moss, vine, seed,
  sprout, stalk, tip, flower, petal. Ember and ash stay residue-free: they are
  already spent material (the ash comment at `elements.ts:374` rules this).
- **Row order is load-bearing**: every one of these must sit above acid's
  `[solid]`/`[powder]` tag rows or it silently never fires - the exact trap the
  `elements.ts:734` comment and `acid.test.ts` pin for wood. Consider a
  `plantMatter` tag + one tag row above the generic pair instead of eight
  literal rows - implementer's call; the tag reads better but touches every
  plant def.
- Regenerate the graph doc (`pnpm --filter silt run graph`) in the same change;
  the drift test gates it. Field notes denominators move automatically; with
  ticket 08's grouping the eight rows chart as roughly one `acid + flower` and
  friends, which keeps sulphur's ring sane - a reason to land 08 first, though
  nothing breaks if this goes first.

## Open question for Ed

Confirm the roster above (in or out: seed? petal?) and that ember/ash stay
excluded.

## Tests

- acid.test.ts additions in the wood-row pattern: acid on each plant species
  leaves sulphur; acid on ash still leaves nothing; row-order regression (tag
  row does not shadow the new rows).
- Graph drift test green after regen; determinism test green.
