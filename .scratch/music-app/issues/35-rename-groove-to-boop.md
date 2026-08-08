# 35 — Rename "Groove" to "Boop" everywhere

**Reported:** V1 feedback (Ed, 2026-08-07) — the concept currently called a
"groove" should be called a "boop" in all cases.

**Scope:** ~350 occurrences of "groove" across `apps/boop`, `docs/adr/0025–0027`,
the design handoff and the tracker. **Ships first**, so no later ticket writes
copy or identifiers twice.

**Decisions (grilled 2026-08-07):**

1. **"Boop" is the domain term *and* the storage-shape term.** `CONTEXT.md`'s
   **Creation** entry is replaced by **Boop**, with both "Groove" and "Creation"
   moved to its _Avoid_ list. Types rename with it: `StoredCreation` →
   `StoredBoop`, `creationFrom` → `boopFrom`, `workingCreation` → `workingBoop`,
   `decodeStoredCreation`, `saveCreation` / `renameCreation` / `deleteCreation`,
   and so on. Three words for one concept is exactly what the vocabulary doc
   exists to prevent.
2. **Stored keys and wire format do NOT change.** The `localStorage` key
   `boop:save`, the save-document field names (`version`, `working`, `creations`)
   and the `#g=` share-link parameter are the ADR 0025/0026 contract — renaming
   any of them breaks every existing save and every link already shared. The
   `creations` field keeps its name deliberately; say so in ADR 0025 and in
   `saveFormat.ts`, or someone will "finish" the rename later.
3. **Existing "Groove N" names on disk are left exactly as they are.** They are
   user-visible names in user data. New saves are "Boop N", and
   `generateBoopName` must find the lowest free number **treating old "Groove N"
   rows as non-candidates** — so an old "Groove 2" does not block or confuse the
   new "Boop 2".
4. **Copy set** (take these strings verbatim):
   - panel title "**My boops**"
   - save button "**Save this boop**"
   - empty state "**No boops saved yet.**"
   - footer "**Tap a boop to open it. No limit on how many you keep.**"
   - delete confirm "**Throw away Boop 2?**" / "You can't get it back."
   - clear confirm unchanged except "Every step comes off. Saved **boops** stay."
   - phone `⋯` menu item "**My boops**"
   - generated names "**Boop 1**", "Boop 2", …
   - (ticket 36 adds "**New boop**")
5. **The hint sheet gets rewritten sentence by sentence, not find-and-replaced.**
   The app is called boop and a saved item is a boop; "Save this boop" reads fine,
   "boop saves your boops automatically" does not. List every sentence changed in
   the ticket comments on resolve.

**Also renaming** (code, mechanical): `features/grooves/` → `features/boops/`,
`GroovesPanel`, `useGrooves`, `grooveNames.ts` / `generateGrooveName`,
`renderGrooveWav`, `exportGrooveWav`, the `groovesPanel` state,
`myGrooves.iwft.tsx`, `HomePagePom`, and every `data-testid`
(`save-groove-button`, `groove-row-N`, `groove-load-N`, …).

**Keep this commit to the rename alone** — no behaviour changes riding along.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] `CONTEXT.md`'s Boop entry replaces Creation; both old words on its avoid list
- [ ] No user-visible "groove" left; `rg -i groove apps/boop/src` returns only the
      deliberately-kept contract names, each with a comment saying why
- [ ] `boop:save`, the save-document field names and `#g=` untouched — proven by
      a test that reads a pre-rename save document and gets its boops back, and
      one that loads a pre-rename share link
- [ ] Existing "Groove N" names untouched; new saves are "Boop N"; the generator
      never collides with an old name (unit-tested with a mixed list)
- [ ] Hint-sheet sentences rewritten individually and listed in the comments
- [ ] Design handoff and ADRs 0025–0027 updated for terminology, with the
      unchanged contract names called out as intentional
- [ ] Full verify loop green: lint, typecheck, vitest, playwright CT
