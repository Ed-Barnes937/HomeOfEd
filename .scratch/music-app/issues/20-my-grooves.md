# 20 — My grooves

**What to build:** A named list of saved creations. Save snapshots the working
grid under a prefilled playful generated name ("Groove 3") — typing optional;
tap an entry to load it; rename is available; delete sits behind a confirm.
No cap on list size.

**Design:** the handoff (`docs/reference/boop-design/README.md`) specifies
the light paper card on the dark stage, list rows with dot-matrix
thumbnails, rename/delete icon buttons, the delete confirm copy ("Throw away
Groove 2?" / "You can't get it back.") in the shared confirm shape, and the
save moment: the card reads "Saved it" with the generated name in a focused
field — **the save has already happened; the field is a rename, not a
gate**.

**Blocked by:** 19 — Autosave (the creation save format).

**Status:** resolved — save flow superseded by [ticket 32](32-save-as-a-form.md)

> **Superseded 2026-08-07 (V1.1 feedback, grilled with Ed).** The "save first,
> rename after" shape and the "no typing required" AC below are replaced by
> [ticket 32](32-save-as-a-form.md): the name field is present *before* the save,
> prefilled with the generated name, and a Save button commits. Saving is still
> one tap with no keyboard — the intent this ticket was protecting — but the save
> no longer happens before the name is shown. "Groove" is renamed to "Boop"
> throughout by [ticket 35](35-rename-groove-to-boop.md). The two scope calls in
> the comments below are now covered: the currently-loaded row ring lands with
> [ticket 31](31-saved-state-visibility.md).

- [x] Save action snapshots pattern + tempo into the list with a generated
      playful name — no typing required *(superseded — see above)*
- [x] List shows saved grooves; tap loads one into the working grid
- [x] Rename available but optional; delete requires a confirm
- [x] No cap on the number of saved grooves
- [x] Everything reachable by touch
- [x] Whole-frontend test: save → edit → load → original restored; delete
      confirm honoured

## Comments

Resolved 2026-08-06 (agent, Sonnet). Landed in `5eef0a1` on `music-app`.
GroovesPanel per design: Save saves IMMEDIATELY then shows the "Saved it"
moment with a focused prefilled rename field (rename is a rename, never a
gate); `generateGrooveName` returns the lowest free "Groove N"; tap-to-load;
delete behind the shared ConfirmCard with the exact copy; no cap (unit-
tested to 30, iwft to 12). Storage ops (save/rename/delete creation) added
to the persistence seam without changing the ADR 0025 stored shape;
PresetThumbnail gained a paper tone for the light card. Real bug caught by
iwft mid-build: ConfirmCard inside the panel backdrop bubbled "Keep it"
into a panel close — moved outside. Documented scope calls: no "Saved
today" meta (no timestamp in the stored shape) and no currently-loaded row
ring (not in AC) — both candidates for a design follow-up ticket.
Gate re-verified by orchestrator: lint/typecheck clean, vitest 150/150,
playwright CT 29/29 (33 after the ticket 24 merge).
