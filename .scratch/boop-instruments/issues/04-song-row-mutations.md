# 04 - Song mutations: add, remove, and swap rows

**What to build:** The pure domain operations the UI wires up: in
`song/song.ts`, three new mutations on the active clip - **add row**
(append an instrument with empty steps), **remove row** (delete a row and its
painted steps; refused at 1 row), **swap row instrument** (the row keeps its
painted steps - same rhythm, new sound). All three return a new song and are
"edited" per ADR 0031 as amended by ticket 02's ADR - callers pair them with
`afterEdit` like every other mutation.

Rules enforced here, not in the UI: no duplicate instrument within a clip
(add/swap refuse an id the clip already has), row count 1..roster, unknown
ids refused against the kit. A new clip (Blank, or a sample clip's resolved
rows) defaults to the roster's first six.

Wire the engine boundary: switching clips already flows through
`setPattern`; verify a clip switch carries each clip's own row set to the
engine and back, so clip 1's instrument choices survive visiting clip 2 with
nothing painted (the spec §5 scenario at the state level - the `.iwft`
version lands with the picker in ticket 05).

Spec: §1 (model), §4 (swap keeps steps), §5, §7 (edited definition).

**Blocked by:** 02, 03.

**Status:** ready-for-agent

- [ ] `addRow`/`removeRow`/`swapRowInstrument` unit-tested: happy paths, duplicate-id refusal, the 1-row floor, roster cap, unknown-id refusal
- [ ] Swap preserves the row's steps; remove discards them; add appends empty at the bottom
- [ ] Each mutation marks the song edited exactly like existing mutations (ADR 0031 pairing)
- [ ] Clip switch round-trips per-clip row sets through the engine (unit test over the seam)
- [ ] Blank and sample-clip creation produce the default first-six rows
