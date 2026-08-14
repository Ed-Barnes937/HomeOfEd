# Song-mode playback mechanics

Type: prototype
Status: resolved

## Question

The handoff asserts song mode is "the engine restarted with the next clip's
pattern at each 16-step wrap". Prove it: prototype gapless clip-switching on
the real `SequencerEngine` (against `FakeAudioDriver` and by ear) and answer:

- Can the pattern swap at the wrap without an audible seam or a dropped
  lookahead beat, given the schedule-time lookahead?
- Does the existing `usePlayheadMotion` / strike-epoch plumbing really carry
  over unchanged, including the grid switching clips mid-play?
- Does the `SequencerEngine` contract need to grow (e.g. a song position
  channel, a `setPattern` guarantee at wrap), or can song mode live entirely
  above the existing seam?

Output: a throwaway prototype linked from this ticket, plus the contract
verdict. Any contract change graduates from the map's fog into its own ticket.

## Answer

Confirmed, deterministically and by ear (2026-08-13): song mode is exactly
"swap the engine's pattern at each 16-step wrap", and it lives **entirely
above the existing `SequencerEngine` seam** — no new methods, events, or
guarantees. The contract does not grow.

- A ~30-line conductor subscribes to `onBeat`; at step 15 it calls
  `setPattern` with the next slot's clip. `onScheduledStep` reads the rows
  fresh each step and `onBeat` fires synchronously inside the step-15
  callback, so the swap always lands before tick 16 is scheduled — gapless by
  construction. Verified over `FakeAudioDriver` (no dropped hit, even gaps
  across wraps, right clip per slot) and by ear on the real `ToneAudioDriver`.
- `songPos()`, tick monotonicity, and `usePlayheadMotion` carry over
  unchanged.
- **Spec note**: the swap happens at *schedule* time, one lookahead
  (~0.1–0.15 s) before the wrap sounds. The UI must derive the sounding
  clip/slot from the draw channel (`onDrawBeat`), never by re-reading
  `getPattern()` at swap time, or the grid flashes the next clip early.

Prototype captured on branch `prototype/03-song-mode`
(`apps/boop/prototype-song-mode.html`, `apps/boop/src/PROTOTYPE-song-mode.ts`,
`.scratch/boop-loops/proto-03/`). The conductor in
`PROTOTYPE-song-mode.ts` is the liftable shape for the real implementation.

## Comments

**2026-08-12 (agent)** — Prototype built and the deterministic half is proven;
awaiting the by-ear check before this resolves.

Assets (working tree, to be captured to a throwaway branch on resolution):

- `apps/boop/prototype-song-mode.html` + `apps/boop/src/PROTOTYPE-song-mode.ts`
  — the by-ear prototype: real engine + `ToneAudioDriver` + launch kit, a
  4-slot song (clips A A B C), draw-time "sounding slot" display, and an
  in-page deterministic check. Run `pnpm dev --filter=boop`, open
  `http://localhost:3008/prototype-song-mode.html`.
- `.scratch/boop-loops/proto-03/wrap-check.mts` — the same check standalone
  (`npx tsx .scratch/boop-loops/proto-03/wrap-check.mts`).
- `.scratch/boop-loops/proto-03/page-smoke.mjs` — headless boot + check runner.

Deterministic findings, on the real `BoopSequencerEngine` over `FakeAudioDriver`
(50 steps, two wraps, per-step lookahead cranked exactly like Tone's `16n`
`scheduleRepeat`):

- Calling `setPattern(nextClip)` from an `onBeat` listener at step 15 swaps
  the pattern for the wrap step: no dropped hit (50/50), every inter-hit gap
  exactly one step across both wraps, every hit from the clip that owns its
  slot. `onScheduledStep` reads the rows fresh each step and `onBeat` fires
  synchronously inside the step-15 callback, so the swap always lands before
  tick 16 is scheduled — gapless by construction, not by luck.
- `songPos()` / tick monotonicity / anchor re-seeding carry across the swap
  untouched; `usePlayheadMotion` needs no change.
- **One real wrinkle**: the swap happens at *schedule* time, one lookahead
  (~0.1–0.15 s) before the wrap is audible. A UI that re-reads `getPattern()`
  naively would flash the next clip early. The prototype's conductor tracks
  the *sounding* slot separately via `onDrawBeat` (step 0) — display state
  must come from the draw channel, exactly as the existing plumbing already
  does.

Provisional contract verdict (pending the by-ear check): **song mode lives
entirely above the existing seam** — the whole conductor is ~30 lines over
`onBeat` + `setPattern` + `onDrawBeat`, no new `SequencerEngine` methods or
events, so nothing graduates from the map's engine-contract fog.

To confirm by ear: play the song on the prototype page and listen to the
slot joins (A→A, A→B, B→C, C→A wrap) for any seam, flam, or dropped beat.
