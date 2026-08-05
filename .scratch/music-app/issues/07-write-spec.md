# Write the spec

Type: task
Status: resolved
Blocked by: 03, 04, 05, 06, 09, 10

## Question

Write `.scratch/music-app/spec.md`: the product spec sharp enough to hand to
planning. Pulls together every decision on the map — music-first core loop
(no reactive visual layer in V1), sequencer dimensions, beat-event seam,
sound palette + extensibility, persistence (localStorage), mobile-first
constraints, app name/subdomain/ports — and resolves any remaining fog
(pattern chaining, educational touches, save-slot UX, sound aesthetic) or
explicitly defers it.

## Comments

**2026-08-05 — remaining fog resolved by grilling; spec now waits only on the
[prior-art survey](10-prior-art-research.md):**

- **Pattern chaining:** single pattern in V1. Chaining into songs is the
  *expected* V2+ direction (not a maybe) — note this in future grillings and
  in the spec's future-work section. Save format is a list of named creations
  so a creation can later grow to several patterns without migration.
- **Educational touches:** real vocabulary on labels (Tempo + live BPM, real
  instrument names), 16 steps visually grouped in 4s. Plus an opt-in
  coach-marks tour (3–4 tooltip steps: tap a square → press play → tempo
  slider) that ends by dropping a simple starter beat onto the grid and
  handing over ("now make it yours"). Never forced; small "?"/"Show me"
  button, gently highlighted on first visit. No other active teaching.
- **Saves:** continuous autosave of the working grid + "My grooves" named
  list — prefilled generated names (typing optional), tap-to-load,
  confirm-on-delete, no cap. Export-to-audio: offline render of the pattern
  looped ~4×, WAV baseline (compressed format is a later enhancement), Web
  Share API share sheet on mobile, download fallback on desktop. No import.
- **Sound aesthetic:** playful hybrid launch kit — kick, snare/clap, hi-hat,
  low perc/tom, marimba-ish pitched hit, synth "boop". CC0/openly licensed
  samples only; short one-shots that stay clean at high tempo. Manifest
  supports multiple kits; V1 ships one, kit-switching UI deferred.

**2026-08-05 — three decisions revised after the
[prior-art survey](10-prior-art-research.md) flagged them:**

- **Onboarding (replaces the coach-marks tour):** content-first, matching the
  field — no guided tour. A row of 3–4 named starter grooves with the blank
  canvas as the first item; optional "?" opens a single static hint sheet.
  No first-load seeding — the app opens on an empty grid with the preset row
  visible.
- **Tempo control:** keep the slider (prototype-earned) but logarithmic
  mapping (equal travel = equal tempo ratio), label "Tempo" with the live BPM
  number small beside the label (not on the thumb), Slow/Fast word endpoints.
  Never the term "BPM" as a label.
- **Sharing/export:** URL-hash share links are the primary share affordance
  (whole pattern + tempo + kit id encoded in the hash; zero backend; share
  sheet on mobile, copy-link with "Copied!" feedback on desktop). Encoding is
  versioned and derived from the save format so added instruments/kits/
  future chaining extend it without breaking old links; bad links degrade to
  an empty grid. WAV export stays but demoted to a secondary option behind
  the share action — verify on mobile Safari early; first candidate to cut.

## Answer

Spec written at [`spec.md`](../spec.md) (2026-08-05), incorporating every
map decision, the grilled fog resolutions above, and the three prior-art
revisions (content-first onboarding, log tempo slider with small BPM
readout, hash-links primary / WAV demoted). Deliberately delegated to the
design brief (ticket 08): visual identity, instrument artwork, small-phone
treatment of the fixed 6×16 grid, touch-target sizes, preset-row
presentation, hint-sheet content, motion design.
