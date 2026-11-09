# 01 - The hub card shows more than the wand

**Status:** needs-triage
**Type:** task
**Blocked by:** armoury gaining a second kind of thing to make (swords, etc.)

**What to build:** once the armoury makes more than wands, update its card on
the hub homescreen so it no longer reads as a wand-only app.

- The card is the `Armoury` entry in `APPS` in `apps/hub/src/pages/HomePage.tsx`,
  with `kind: 'wand'`.
- Its animated preview is `drawWand` in the same file: a single wand on the
  diagonal with a glowing, sparking tip. Rework it (or replace the `'wand'` kind)
  to show the new tools too, e.g. a wand and a sword crossed, or a slow rotation
  through each tool.
- The preview honours reduced motion like every other card; keep that.
- Update `verifyArmouryLink` in `apps/hub/src/testing/HomePagePom.ts` only if
  the card's accessible name changes.

**Context:** raised by Ed on 2026-11-09, when the
armoury went live with wands only.
