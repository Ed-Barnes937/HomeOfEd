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

**Status:** resolved

- [x] `CONTEXT.md`'s Boop entry replaces Creation; both old words on its avoid list
- [x] No user-visible "groove" left; `rg -i groove apps/boop/src` returns only the
      deliberately-kept contract names, each with a comment saying why
- [x] `boop:save`, the save-document field names and `#g=` untouched — proven by
      a test that reads a pre-rename save document and gets its boops back, and
      one that loads a pre-rename share link
- [x] Existing "Groove N" names untouched; new saves are "Boop N"; the generator
      never collides with an old name (unit-tested with a mixed list)
- [x] Hint-sheet sentences rewritten individually and listed in the comments
      *(none needed — see comments)*
- [x] Design handoff and ADRs 0025–0027 updated for terminology, with the
      unchanged contract names called out as intentional
- [x] Full verify loop green: lint, typecheck, vitest, playwright CT

## Comments

Resolved 2026-08-08 (agent, Sonnet). Branch `boop/35-rename-groove-to-boop`,
PR #64 against `main`.

**Rename.** Mechanical across `apps/boop/src`: `features/grooves/` →
`features/boops/`, `GroovesPanel` → `BoopsPanel`, `useGrooves` → `useBoops`,
`grooveNames.ts`/`generateGrooveName` → `boopNames.ts`/`generateBoopName`,
`renderGrooveWav` → `renderBoopWav`, `exportGrooveWav` → `exportBoopWav`,
`useShareGroove`/`shareGrooveUrl` → `useShareBoop`/`shareBoopUrl`,
`StoredCreation` → `StoredBoop`, `creationFrom` → `boopFrom`,
`workingCreation` → `workingBoop`, `decodeStoredCreation` →
`decodeStoredBoop`, `saveCreation`/`renameCreation`/`deleteCreation` →
`saveBoop`/`renameBoop`/`deleteBoop`, `myGrooves.iwft.tsx` →
`myBoops.iwft.tsx`, every `data-testid` (`save-groove-button` →
`save-boop-button`, `groove-row-N` → `boop-row-N`, etc.), and
`HomePagePom`'s methods. `useBoops`'s own returned field also renamed
`creations` → `boops` (in-memory, not the frozen storage field) since it's
domain-facing, not the storage shape.

**Fixed on review (team-lead pass):** ticket comment's `PR #TBD` → `#64`;
leftover `creation` locals that were not frozen names renamed to `boop` in
`presetRow.iwft.tsx` (`savedCreation` → `savedBoop`), `saveFormat.test.ts`
(`const creation` → `const boop`), and `storage.test.ts` (`const creation` →
`const boop`, with the shadowing second `const boop` in the `saveBoop`
describe block renamed to `saved` instead — the blind rename would otherwise
have referenced itself in its own initializer). `SharePayload.creation` and
`SaveDocument.creations` left exactly as they are, per the frozen-contract
decision above.

**Frozen contract, left alone with a comment at each site:** the
`localStorage` key `boop:save`; the save document's `version`/`working`/
`creations` fields (`SaveDocument.creations`, ADR 0025); the `#g=`
share-link prefix and its `{ version, creation }` payload shape (ADR 0026)
— `creation` stays as the field name there too, since it is serialized into
every link already sent. Proven, not just asserted: `saveFormat.test.ts`
has a new "pre-rename compatibility" test decoding a hand-written
pre-rename save document; `shareLink.test.ts` has the equivalent for a
hand-built pre-rename `#g=` token.

**Generator (decision 3).** `generateBoopName` previously guessed a
starting number from `existingNames.length + 1` — with only same-format
names this always finds a free slot, but it is thrown off by any mixed-in
non-"Boop N" name (old "Groove N" rows, custom renames): it can skip past
free low numbers it should have found first. Rewrote it to scan from 1 for
the true lowest free "Boop N", so a legacy "Groove 2" cannot suppress a new
"Boop 2" or push the next generated name higher than necessary. Flagging
this as a deliberate behaviour tweak the ticket's decision 3 required, not
scope creep: the old heuristic could not satisfy "does not block or
confuse" for a mixed list, and decision 3 explicitly asks for a mixed-list
unit test — `boopNames.test.ts` has one (`['Groove 1', 'Groove 2', 'Boop
1']` → `'Boop 2'`), plus a new "fills a gap" test the corrected scan needed.

**Hint sheet (decision 5).** Read every sentence in `HintSheet.tsx`: none of
the four hints ("Tap the grid to paint sounds", "Press play to hear your
loop", "Tempo makes it faster or slower", "Share sends your loop to a
friend") ever said "groove" — the V1 hint sheet has no save-related hint at
all yet. Nothing to rewrite; noting this so it doesn't read as skipped.

**Docs.** `CONTEXT.md`'s **Creation** entry replaced by **Boop**, with
"Groove" and "Creation" both on its avoid list (Creation's note points at
ADR 0025 for why `creations` survives as the field name). `apps/boop/
CLAUDE.md` and `README.md` updated for the same terminology. ADRs 0025,
0026, 0027 updated prose-wide, each with an explicit "ticket 35 note"
calling out its frozen name(s) and why. `docs/reference/boop-design/
README.md` (the handoff prose) updated throughout; the raw `boop - design.
dc.html` prototype asset is left untouched — it's a reference artifact, not
production copy, and the README already says so.

**Deliberately left alone:**
- `.scratch/music-app/map.md` and the closed tickets under `issues/*.md`
  (including 20 and 22, which this ticket's own decisions reference) — these
  are dated historical record of what was true when they were written and
  resolved; rewriting their bodies would falsify the record. The map's own
  entry for this ticket already reads correctly.
- `docs/adr/0019` and `0020` — unrelated karesansui "groove" hits, per the
  brief.
- "Groove Pizza" in `autosave.ts` — an external product citation, not this
  app's domain term.

**Verify loop:** lint clean, typecheck clean, vitest 199/199, playwright CT
50/50.
