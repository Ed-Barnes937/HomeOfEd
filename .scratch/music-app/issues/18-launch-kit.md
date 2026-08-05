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

**Status:** claimed

- [ ] Six CC0 / openly-licensed one-shots sourced, licences recorded
- [ ] Short one-shots, no long tails, clean at 200 BPM
- [ ] Levels balanced so a dense 6-row pattern doesn't clip
- [ ] Manifest carries the design's fixed names, colours, and the reserved
      `role` field (kick / snare / hat / perc / melodic) per instrument
- [ ] Placeholder artwork wired from the design bundle via CSS mask; the
      required "Icons made by {author}" CC BY attribution ships with it
      (Delapouite, Lorc, Caro Asercion, Skoll)
- [ ] Rows 1–4 read as the rhythm section, 5–6 as the musical voices
