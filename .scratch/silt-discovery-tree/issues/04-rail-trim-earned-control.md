# 04 - Rail trim: mud out of PAINTABLE_IDS, EARNED control in

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 03
**Spec:** [../spec.md](../spec.md) §9 decisions 5-6, 8; §6 "The unlock"

The app change under the metagame: the rail launches with 10 base elements,
and mastered unlockables appear in an EARNED control at the rail's foot.

## Design

- Remove `MUD` from `PAINTABLE_IDS` (`features/palette/paletteGroups.ts`).
  Do NOT trim anything else: wood's only recipe needs ember which needs wood
  (decision 5) - leave a comment carrying that trap.
- Rerun `pnpm --filter silt run graph` in the same change - the paintable
  flag flips mud to a hexagon in the generated doc and the drift test gates
  it.
- The rail becomes **base + earned**: `buildRailPalette` (or its caller)
  takes the unlocked ids from ticket 03's seam. Hotkeys 1-9 are untouched;
  the tag-group sections stay as they are.
- **EARNED control** (decision 8, mockup 10b): a labelled control at the
  rail's foot, present only when at least one element is unlocked. It opens
  a small popover (scenes-popover chrome) listing earned elements; selecting
  one selects it for painting exactly like a rail entry. One control,
  however many unlocks follow - never inline rail insertion.
- An unlocked element is fully paintable: brush, and spawners too (spec §3).
- Scenes: a pre-trim scene containing painted mud still restores (scenes
  remap by name; mud remains a species) - restoring it does not unlock mud
  (spec §3).

## Tests

- Unit: `buildRailPalette` with no unlocks yields 10 entries and no mud;
  with mud unlocked yields it via the earned path, not the base groups.
- iwft (state-through-UI, keep it thin): fresh app shows 10 rail elements
  and no EARNED control; with a progression store seeded to mud-unlocked,
  the EARNED control appears, opens, and selecting mud paints mud.
- Existing hotkey iwft stays green (digits 1-9 unchanged).
- Drift test green after regeneration.
