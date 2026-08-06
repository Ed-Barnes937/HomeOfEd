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

**Status:** claimed

- [ ] Save action snapshots pattern + tempo into the list with a generated
      playful name — no typing required
- [ ] List shows saved grooves; tap loads one into the working grid
- [ ] Rename available but optional; delete requires a confirm
- [ ] No cap on the number of saved grooves
- [ ] Everything reachable by touch
- [ ] Whole-frontend test: save → edit → load → original restored; delete
      confirm honoured
