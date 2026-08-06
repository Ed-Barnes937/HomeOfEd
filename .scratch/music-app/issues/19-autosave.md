# 19 — Autosave

**What to build:** Closing the tab never loses work. The working grid
(pattern + tempo) is continuously autosaved to localStorage — debounced,
~2 s + lull-check as the reference — and restored on next load. There is no
"unsaved" state a child can be in, and no save button on the critical path.
This ticket defines the versioned creation save format (a list of named
creations, each holding one pattern for now) that My grooves and the share
codec both build on.

**Blocked by:** 13 — First sound grid; 16 — Tempo slider.

**Status:** resolved

- [x] Edits (cells and tempo) autosave debounced to localStorage
- [x] Reload restores the working grid exactly — pattern and tempo
- [x] Save format is versioned and shaped as a list of named creations
      (creation → patterns) so V2 chaining needs no migration
- [x] Corrupt/missing stored state degrades to an empty grid, never an error
- [x] Save format round-trip and versioning unit-tested; a whole-frontend
      test covers edit → reload → restored

## Comments

Resolved 2026-08-06 (agent, Opus). Landed in `e02c906` on `music-app`.
New self-contained `src/persistence/`: `saveFormat.ts` (pure versioned
encode/decode), `storage.ts` (injectable localStorage seam, never throws),
`autosave.ts` (2s lull debounce + 10s ceiling + flush), `useWorkingGrid.ts`
(restore on mount, flush on pagehide/visibilitychange). Save document:
one `boop:save` key, `{ version, working, creations[] }` — creation is the
unit ({ name, kitId, tempo, patterns[] }, one pattern today, V2 chaining
appends); rows are instrument-keyed 16-char bitstrings (position-
independent, ~200B/creation); decode is total and strict (anything wrong ->
EMPTY_DOCUMENT). Decisions in ADR 0025; CONTEXT.md gained Working grid /
Save document. Deviation accepted: 10s debounce ceiling so continuous
editing still saves. Code review fixed a flaky reload iwft, made the
restore-before-mirror ordering a data dependency (`restored` flag), and
skipped the first mirror after restore. Gate re-verified by orchestrator
post-merge: lint/typecheck clean, vitest 96/96 (incl. 13 decode tests),
playwright CT 10/10 (reload test passed 4/4 under --repeat-each 4).
