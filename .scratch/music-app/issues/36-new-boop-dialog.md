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

**Status:** resolved

- [x] "New boop" button in the bottom bar, desktop and phone, opens the dialog
- [x] Four starter cards in the fixed order, Blank first, handoff geometry
- [x] Picking a card loads it and closes the dialog; the loaded-card ring is
      internal to the dialog
- [x] Preset row gone from the main screen
- [x] A fresh browser (no `working`) is seeded with Wonky Walk and autosaves it;
      a returning browser is never re-seeded
- [x] Save-format shape and version untouched
- [x] Handoff amended; spec onboarding paragraph amended; ticket 22's superseded
      AC noted there
- [x] Whole-frontend tests: starter loaded from the dialog; fresh-storage boot
      lands on Wonky Walk; second boot restores what was there
- [x] **Carried over from 33** — "Fast" clears the phone New boop button at
      390px *and* 360px. Ticket 33 landed the shrink fix (`min-width: 0` on
      `.tempoSlider` and `.tempoTrackRow`, 11px endpoints at 28/24px) but could
      not verify the clearance, because the button it collides with is this
      ticket's. Assert the gap once the button is in the bar.
- [x] Preset row removal: the frame's horizontal padding lives on the three
      sections of `.stage`, not on `.stage` itself (ADR 0030), because the
      preset strip's `-12px` phone bleed would otherwise overflow the scrolling
      region. Removing the strip does not make that wrong, but it does make it
      unmotivated — leave it or move it deliberately, don't drift.

## Comments

Resolved 2026-08-09 (agent, Opus). Choices made while building:

1. **The seed does not light the dialog's ring.** `activePreset` has never
   survived a reload, so a seeded first visit behaves exactly like reloading
   onto a starter you loaded yesterday: the grid is Wonky Walk, no card is
   ringed. The ring means "you picked this, just now".
2. **The starter cards take §4's paper palette**, keeping §1's geometry. The
   dialog reuses "My boops"'s paper shell, where §1's white-on-dark alphas are
   invisible. Loaded state is §4's `rgba(11,124,145,.1)` + 1.5px ring, and the
   thumbnail's dots are flat ink rather than instrument hues. That leaves
   `PresetThumbnail` with one tone, so its `tone` prop and the stage variant
   behind it went with the preset row — nothing rendered them any more.
3. **Two fixed columns, and the card is `width: fit-content`.** "My boops"'s
   `clamp(352px, 44vw, 560px)` left ~180px of empty margin either side of
   four fixed-width cards, and a wrapping row picked 2, 3 or 4 across
   depending on the viewport, landing them 3 + 1.
4. **The shell CSS is restated, not shared.** Each feature owns its SCSS module
   in this app and there is no `@use` partial anywhere in the repo; a two-dialog
   shell did not justify inventing that convention. Extract on the third dialog.
5. **A mangled share link now opens on the seed**, not an empty grid — nothing
   decodable in the fragment and nothing in storage *is* a first visit.
   `share.iwft` was updated to assert that.
6. **Every .iwft suite that assumed an empty opening grid now says where it
   starts**, via a new `root.startBlank()` — New boop → Blank, the two taps a
   child would use, rather than faking storage. `stickyBottomBar`'s phone
   viewport dropped 640 → 560 tall: without the preset row the grid fits a
   640px window, and a suite about scrolling needs something that does not fit.
