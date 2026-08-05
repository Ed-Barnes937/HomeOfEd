# 18 — Launch kit content

**What to build:** Replace the placeholder sounds with the real playful-hybrid
launch kit, so patterns sound like music: kick, snare/clap, hi-hat, low
perc/tom, a marimba-ish pitched hit, and the synth "boop". Pure data — the
manifest and audio files change, no engine code.

**Design:** the handoff (`docs/reference/boop-design/README.md`) fixes the
six names, row order, and colours — Kick `#FF6B5C`, Snare `#FFB03A`, Hi-hat
`#DCE85C`, Tom `#FF7FB0`, Marimba `#6FE0A8`, Boop `#B78BFF` — and supplies
placeholder artwork SVGs (`docs/reference/boop-design/assets/instruments/`,
game-icons.net CC BY 3.0) applied as CSS masks tinted to the row colour.
Final artwork is ticket 28.

**Blocked by:** 12 — SequencerEngine + Tone.js implementation.

**Status:** resolved

- [x] Six CC0 / openly-licensed one-shots sourced, licences recorded
      *(deviation: synthesized in-repo, not sourced — see Comments)*
- [x] Short one-shots, no long tails, clean at 200 BPM
- [x] Levels balanced so a dense 6-row pattern doesn't clip
- [x] Manifest carries the design's fixed names, colours, and the reserved
      `role` field (kick / snare / hat / perc / melodic) per instrument
- [x] Placeholder artwork wired from the design bundle via CSS mask; the
      required "Icons made by {author}" CC BY attribution ships with it
      (Delapouite, Lorc, Caro Asercion, Skoll)
- [x] Rows 1–4 read as the rhythm section, 5–6 as the musical voices

## Comments

Resolved 2026-08-05 (agent, Sonnet, worktree branch `t18-launch-kit-content`,
merged as `162fd42`). Commits `b935f28` + `3b3706f`.

The six placeholder one-shots are replaced with a properly synthesized
playful-hybrid kit (layered synthesis: pitch sweeps, inharmonic partials,
attack clicks), levels matched to the engine's gain-staging budget
(combined worst-case peak 1.813 raw vs the ~1.83 the driver was tuned for).
A committed test (`kitLevels.test.ts`) proves duration < 400ms, the peak
budget, and no buildup at 200 BPM retriggering.

Deviations, all documented in `ATTRIBUTION.txt`:
1. **Synthesized, not sourced** — freesound downloads are login-gated,
   opengameart/kenney had no suitable content; ticket's fallback clause
   used. In-repo synthesis means we own the audio outright.
2. **Colours not in the manifest** — `kitManifest.ts` has no colour field
   and engine code was out of this ticket's scope; the design colours live
   exactly in `tokens.scss` and the grid maps them positionally (flagged in
   ticket 13 too). Follow-up candidate if kit-switching (V2) lands.
3. **Attribution names corrected** — verified against game-icons source:
   Delapouite + Caro Asercion are the actual authors of the six shipped
   icons; Lorc/Skoll (named in the AC) are not, so they are not credited.

Gate re-verified by orchestrator post-merge: lint/typecheck clean, vitest
51/51, playwright CT 4/4.
