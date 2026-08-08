# 36 — Starters move into a "New boop" dialog

**Reported:** V1 feedback (Ed, 2026-08-07) — move the pre-seeded starter
templates into a "New boop" dialog, opened from a button in the sticky bottom bar.

Split out of ticket 33 (grilled): different files, and its own onboarding
decision.

**This changes the spec's onboarding premise.** The spec put starters on the main
screen — Blank first, no tour — *because the prior-art survey found nobody
onboards with a tour and content does the job* (`map.md`, tickets 07 and 10).
Behind a dialog, a first-time child would meet an empty grid and no suggestion.

**Decisions (grilled 2026-08-07):**

1. **A first visit is seeded with a starter, not left empty.** `Wonky Walk` loads
   automatically when there is no working grid — the first non-blank card in the
   fixed order, and the prior-art finding favoured one-lane seeds. This keeps the
   spec's principle (content onboards) without a modal and without a save-format
   change. Auto-opening the dialog on first visit was rejected.
2. **A first visit is detectable without touching the save format**:
   `loadSaveDocument` returns `working: null` for a fresh browser. No new field,
   no version bump — which matters, because `parseSaveDocument` hard-rejects an
   unknown `version`.
3. **The seed autosaves immediately**, like any other load, so a reload shows the
   same thing. Leaving it "pristine until touched" would make boop
   non-deterministic on reload for no gain. Per ticket 31 the seeded grid reads
   `Not saved yet`, which is true.
4. **Blank stays first in the dialog.** Its original justification (nobody meets
   an unexplained void) is gone now that a first visit is seeded — but "New boop →
   Blank" is the discoverable way to start fresh, while "Clear grid" is the
   dashed-coral warning-shaped one. The *justification* changes; the order
   doesn't. Record that on resolve.
5. **The card ring stays inside the dialog.** Which starter is loaded is now only
   the dialog's concern — the main-screen indicator never names a starter (ticket
   31). Note that ticket 31 removes the old "a tempo change doesn't drop the ring"
   exemption, so the ring drops on any change.

**What to build:**
- `PresetRow` leaves the main screen; the four cards (Blank, Wonky Walk, Robot
  Hiccup, Sunday Stomp) move into a dialog in the handoff's card treatment
  (§1 preset row: 168px card, 12px padding, radius 14px, dot-matrix thumbnail).
  Reuse the overlay/card shell "My boops" uses.
- A "New boop" button in the sticky bottom bar (desktop: right-aligned beside
  Clear grid; phone: a compact 44px button beside tempo) opens it. Picking a card
  loads it and closes the dialog.
- Loading a starter over an edited grid must interact sanely with ticket 31's
  indicator — it clears the loaded-boop identity, so the indicator drops to
  `Not saved yet`. No confirm (Clear grid is the destructive-feeling one; picking
  a starter is a creative act, and nothing is lost that wasn't already autosaved
  over).
- First-visit seeding lives with the working-grid restore in `useWorkingGrid`, not
  in the dialog — the dialog is one way to load a starter, not the owner of the
  concept.

**Design:** the starter cards keep their handoff geometry; the dialog is new
surface (reuse the §4 card shell). Handoff amendment: the preset row is no longer
a main-screen region. The spec's onboarding paragraph is amended and ticket 22's
placement AC noted as superseded.

**Blocked by:** 33 — the bottom bar the button lives in; 31 — the indicator it
interacts with

**Status:** ready-for-agent (after 33)

- [ ] "New boop" button in the bottom bar, desktop and phone, opens the dialog
- [ ] Four starter cards in the fixed order, Blank first, handoff geometry
- [ ] Picking a card loads it and closes the dialog; the loaded-card ring is
      internal to the dialog
- [ ] Preset row gone from the main screen
- [ ] A fresh browser (no `working`) is seeded with Wonky Walk and autosaves it;
      a returning browser is never re-seeded
- [ ] Save-format shape and version untouched
- [ ] Handoff amended; spec onboarding paragraph amended; ticket 22's superseded
      AC noted there
- [ ] Whole-frontend tests: starter loaded from the dialog; fresh-storage boot
      lands on Wonky Walk; second boot restores what was there
