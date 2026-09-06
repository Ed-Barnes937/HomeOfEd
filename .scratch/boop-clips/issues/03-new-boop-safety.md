# 03 - "New boop" must not silently lose a kid's clips

**Status:** ready-for-human
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
- 2026-09-06: **built** on branch `boop-clips-03-new-boop-safety`. Verify loop
  green (`pnpm lint`, `pnpm typecheck`, boop's full suite: 462 vitest + 259
  playwright-ct).

  **What landed.** New boop's button now calls a guarded `requestNewBoop`; the
  reset itself is unchanged. When the reset would really take something away it
  raises the existing `ConfirmCard` shape (the same one clear-grid and
  delete-boop use), with:

  - title **"Keep this boop?"** (Ed's suggestion, verbatim)
  - message **"Save it to My boops, or start fresh and lose it."**
  - **Save it** (filled, left) - one tap: `quickSaveBoop` writes the working
    song into "My boops" under the same automatic "Boop N" the panel's save
    form would have offered, then resets. No name field, no panel.
  - **Start fresh** (outlined, right) - the reset exactly as before.

  No save-format change; `persistence/` is untouched. Recorded as an amendment
  to ADR 0031 (its `beforeunload` ban is unaffected) rather than a new ADR.

  **Judgement calls for your veto:**

  1. **Wording** is all mine bar the title - "and lose it" is deliberately the
     plainest true thing; happy to soften.
  2. **A third condition on when it appears.** The ticket says "unsaved, or
     edited since load". I ANDed a second gate: the song must also *have
     something in it* - a second clip, a placement, a painted step, or rows
     that are no longer the kit's default six (`songHasContent` in
     `song/song.ts`, unit-tested). Without it, New boop on the blank boop the
     last New boop just made asks again about an empty screen. It deliberately
     ignores speed and clip names, which ADR 0031 does count as edits: nudging
     Speed on an empty grid is not worth interrupting a child over. If you'd
     rather it asked on *any* edit, that is a one-line change.
  3. **No "never mind".** Two buttons only, per your decision, so a mis-tap
     cannot back out - but "Save it" is a harmless answer, since the boop is
     then one tap away in "My boops". Say if you want a third way out.
  4. **The first-visit seed trips the card.** A brand-new browser is seeded
     with a sample clip, which has painted steps and is never a row in "My
     boops" - so a child's very first New boop asks, and "Save it" would save
     the app's own seed as "Boop 1". Telling the seed apart from a boop the
     child has played with would need new state; I left it, erring towards
     asking.
  5. **Visuals** are the shared confirm shape untouched: "Start fresh" wears
     the same red-ish outlined treatment as "Clear it" and "Throw away". It is
     the destructive side, so that reads right to me, but it is the one place
     a kid card could want its own look.

  Play check still owed by a human: the card on a real phone (390px) from the
  "⋯" menu, and that "Save it" feels like it did something (the screen simply
  resets - there is no confirmation flash, since the panel is not opened).

- 2026-09-06, Ed (decision sitting): all five judgement calls **pass as
  built** - wording stays ("and lose it" included), the content gate stays
  (speed/rename-only edits do not raise the card), the first-visit seed
  tripping the card is accepted, two buttons only, shared confirm visuals.
  The phone play check is still owed before merge.
