# 19 — Autosave

**What to build:** Closing the tab never loses work. The working grid
(pattern + tempo) is continuously autosaved to localStorage — debounced,
~2 s + lull-check as the reference — and restored on next load. There is no
"unsaved" state a child can be in, and no save button on the critical path.
This ticket defines the versioned creation save format (a list of named
creations, each holding one pattern for now) that My grooves and the share
codec both build on.

**Blocked by:** 13 — First sound grid; 16 — Tempo slider.

**Status:** claimed

- [ ] Edits (cells and tempo) autosave debounced to localStorage
- [ ] Reload restores the working grid exactly — pattern and tempo
- [ ] Save format is versioned and shaped as a list of named creations
      (creation → patterns) so V2 chaining needs no migration
- [ ] Corrupt/missing stored state degrades to an empty grid, never an error
- [ ] Save format round-trip and versioning unit-tested; a whole-frontend
      test covers edit → reload → restored
