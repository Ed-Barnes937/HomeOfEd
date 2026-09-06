# 03 - "New boop" must not silently lose a kid's clips

**Status:** ready-for-agent
**Type:** task
**Reported:** 2026-09-06, Ed (spun out of ticket 02's grilling session -
[ADR 0056](../../../docs/adr/0056-boop-clips-stay-local.md) §5)

Today "New boop" resets the working song to one blank clip. If the current
song was never saved into "My boops" (or has diverged from its saved row), its
clips are gone - the one path besides explicit clip delete that destroys a
clip. Ed: "kids losing content is a major feel bad."

This is a UX change, not a persistence change (ADR 0056 decision 5). Relevant
grounding: `savedState.ts` already knows whether the working song is saved /
edited (ADR 0031), and ADR 0031's dialog stance is about `beforeunload`
specifically - an in-app, kid-readable confirm is not banned, but the app's
philosophy leans "nothing is ever lost" over "are you sure?".

## Question for Ed (the needs-info)

Which shape?

1. **Confirm first**: New boop asks before wiping, only when something would
   actually be lost (unsaved, or edited since load). Kid-readable wording is
   the hard part.
2. **Auto-stash**: New boop first saves the current working song into
   "My boops" under an automatic name - nothing is ever lost, no dialog, at
   the cost of the list gathering auto-saves.
3. **Undo**: keep the previous working song in the save document (additive
   field) and offer a one-shot "bring it back" after a New boop.

## Decision (2026-09-06, Ed)

Option **1 - confirm first**, as a two-big-button kid card, not prose:

- Appears **only** when something would actually be lost - the working song is
  unsaved, or edited since load (`savedState.ts` already knows both).
- Suggested card: title "Keep this boop?", buttons **Save it** (one tap: saves
  the working song into "My boops" under an automatic name, then resets) and
  **Start fresh** (resets as today). Wording/visuals are suggestions - Ed
  vetoes at review.
- No save-format change. ADR 0031's dialog ban is `beforeunload`-specific; an
  in-app card with two labelled actions is fine, but keep the words readable
  by a 6-year-old.

## Comments

- 2026-09-06: shape settled in the ticket-02 grilling session; ready-for-agent.
