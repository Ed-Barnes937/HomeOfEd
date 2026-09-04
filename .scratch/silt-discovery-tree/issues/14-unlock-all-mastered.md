# 14 - Every mastered non-base element joins the EARNED control

**Status:** done (built on ticket-14-unlock-all-mastered, 2026-09-04)
**Type:** task
**Blocked by:** 08 (the unlock predicate must run over *charted* elements -
without the grouping, "master tip, paint tip" and "master buried, paint buried"
are the nonsense this ticket would ship)
**Source:** PR #128 review feedback (Ed, 2026-09-04) - "only mud has been added
to the element picker - we should add any element the user has starred and
isn't a base element". Starred = the mastery star (spec §6 node states).
**Spec:** [../spec.md](../spec.md) §1 "Unlockable", decision 6 (amended by this
ticket).

Decision 6 made mud v1's only unlockable; `entries.ts:81` hardcodes
`UNLOCKABLE_NAMES = ['mud']`. Ed's ruling generalises it: mastery of any
discoverable is the unlock, full stop.

## Design

- Replace the hardcoded list with a derivation: unlockable = every charted
  element (post-08) that is not in the base rail. No per-element opt-in flag
  unless a real exclusion shows up - the predicate is the design.
- A grouped charted element paints its **own canonical species** (flower paints
  flower; the stages stay engine-internal). `buried` disappears as a charted
  element under 08, so it never arises here.
- Everything downstream is already derived and should move for free - verify
  rather than build: the picker's `n/m to unlock` chip on every discoverable
  row (today it may be mud-only), `moreToEarn` in the EARNED popover
  (true while any unlockable is unmastered), the unlock moment card, and
  spawners (an earned element is fully paintable, spawners included).
- Pacing note for the spec amendment: mud stops being special but stays the
  natural first unlock (its edges gate on the char chain). Easy elements like
  steam/obsidian will unlock early - that is fine; painting a gas is a toy,
  not an economy break, and the silhouette policy is untouched.
- Amend spec §1 and decision 6 in the same change.

## Tests

- entries: mastering obsidian's edge set unlocks obsidian; the unlocked list
  is in a stable, documented order (unlock order, as the EARNED control
  already expects); base elements never appear in it.
- fieldNotesView regression fixture: denominator of unlockables equals charted
  non-base count.
- iwft (thin): seed a store with all of steam's edges witnessed; EARNED shows
  steam; painting it paints steam.
