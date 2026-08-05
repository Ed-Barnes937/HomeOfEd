# Wayfinder map: rhythm & music toy

Label: wayfinder:map

## Destination

A spec plus a design brief for a new HomeOfEd app: a kid-friendly (6+) music
toy centred on the step sequencer itself. V1 is **music-first**: the joy is
making and tweaking a groove; there is no reactive visual layer (shelved after
the two visual prototypes — see Decisions). Learning is incidental, fun is the
point. Mobile-first design, tablet/laptop as expected use. Stateless app with
localStorage saves. Built on a beat-event system that a future visual/world
layer (the Rayman homage) can ride in V2 without rework. The map is done when
the spec is sharp enough to hand to planning and the design brief is ready to
paste into a design tool (e.g. Claude design).

*Redrawn 2026-08-02: the original destination had the sequencer driving a
live, beat-synced visualisation as V1's feedback loop; the visualisation and
runner prototypes together retired that premise.*

## Notes

- Inspiration: the music-synced levels in Rayman — the joy is the world moving
  to the music, not a score.
- Fun first; education is incidental, never a curriculum.
- Settled during charting (pre-ticket decisions):
  - Creative-leading: the sequencer sandbox is the home; no gamified rhythm
    game in V1 — the visualisation *is* the feedback loop.
  - Step sequencer core; pitched melody lane is the growth path.
  - Abstract visuals first, on a beat-event system a character layer can ride.
  - Stateless app, localStorage persistence (ADR 0008 pattern); server
    persistence/sharing is a possible later layer.
  - Mobile-first design; tablet/laptop are the expected real screens.
- Standing constraint: the sound engine must support an **extensible sound
  palette** — adding instruments/kits later without rework.
- Skills for tickets: /research (AFK research), /prototype (feel questions),
  /grilling + /domain-modeling (decisions, beat-event contract).
- Prototype tickets are part of this map by explicit user choice — feel
  questions can't be decided on paper.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Sound engine research](issues/01-sound-engine-research.md) — Tone.js
  (tree-shaken) behind a `SequencerEngine` interface; sample-playback kits as
  JSON manifest + audio files (extensible palette = pure data); gesture-gated
  `Tone.start()`, iPad `interrupted`-state handling; visuals sync via
  `{ step, audioTime }` events, never DOM work in scheduler callbacks. Full
  findings on branch `research/sound-engine`.
- [Rhythm visualisation research](issues/02-visualisation-research.md) — give
  every beat event a "body" (per-instrument personality, spring physics);
  drive visuals from a quantised beat-event bus, not audio analysis; three
  candidate directions (Bouncy Shapes / Groove Garden / Rhythm Necklace), with
  Groove Garden the best path to the character layer. Full findings on branch
  `research/rhythm-visualisation`.
- [Sequencer + sound prototype](issues/03-sequencer-sound-prototype.md) —
  core loop and tablet timing feel good; dimensions locked to **6 instruments
  × 16 steps with a tempo slider**; no swing toggle (confusing for
  non-musical folk); instrument labels must be real names/artwork, not emojis
  (design-brief concern). Prototype on branch `prototype/sequencer-sound`.
- [Visualisation prototype](issues/04-visualisation-prototype.md) — abstract
  reactive visuals (all three research directions, fully built with springs,
  personality, beat-event bus) do **not** carry the reward loop; the wanted
  feeling is a *world moving to the music* (line rider / TrackMania), which
  procedurally means a runner — spun out as the
  [runner prototype](issues/09-runner-prototype.md), whose outcome decides
  V1 visual scope and may redraw the destination. The beat-event bus itself
  worked cleanly across three very different consumers. Prototype on branch
  `prototype/beat-visuals`.
- [App name + subdomain](issues/06-app-name.md) — the app is **boop**:
  `apps/boop`, `boop.homeofed.com`, Fly app `hoe-boop`; port row claimed at
  build time.
- [Runner prototype](issues/09-runner-prototype.md) — three procedural-runner
  grammars built and judged; verdict: **shelve the reactive element entirely —
  V1 is music-first, focused on the music interface**. World layer stays a V2
  candidate. Key seam finding: beat-space sync (entities positioned by arrival
  tick) is tempo-proof and is the model a future layer should ride. Prototype
  on branch `prototype/beat-runner`.

- [Beat-event system shape](issues/05-beat-event-system.md) — schedule-time
  events are the canonical seam (draw-time convenience channel for UI);
  payload `{ tick, step, audioTime, hits: [{ instrumentId }] }`, one event per
  step, monotonic tick, plus `songPos()` query re-anchored per beat; transport
  + `tempoChanged` events, pattern as readable state (no edit stream); opaque
  manifest-defined instrument ids with a reserved `role` field; lives as a
  `SequencerEngine` interface inside `apps/boop`.

- [Prior-art survey: kid-facing sequencers](issues/10-prior-art-research.md) —
  twelve products surveyed from primary sources; borrow latched drag-paint,
  audible edits while stopped, empty-as-a-preset, one-lane seed patterns, and
  data-level sound constraints; boop's differentiators are true step
  sequencing, no-account persistence, and the beat-event seam. Flags three
  map decisions for review: the coach-marks tour (nobody in the field ships
  one — content onboards instead), the continuous tempo slider (discrete
  speeds / no numerals is the field norm), and WAV export on tablets (the
  kid-legible artifact is a link, not a file). Full findings on branch
  `research/prior-art`.
- [Write the spec](issues/07-write-spec.md) — **spec delivered at
  [`spec.md`](spec.md)**. Fog resolved by grilling (single pattern in V1,
  chaining the expected V2+ direction; vocab labels + beats grouped in 4s;
  autosave + "My grooves" named list; playful hybrid launch kit, CC0
  one-shots, kit-switching deferred), then three decisions revised on the
  prior-art evidence: content-first onboarding (starter-groove preset row,
  blank first, no tour), logarithmic tempo slider ("Tempo" label, small BPM
  readout, Slow/Fast endpoints), and URL-hash share links primary with WAV
  export demoted (versioned encoding, mobile-Safari verification early,
  first cut candidate).

- [Design brief](issues/08-design-brief.md) — **brief delivered at
  [`design-brief.md`](design-brief.md)**, ready to paste into a design tool:
  tone, the four regions of the single main screen, the six-instrument
  character set, fixed interactions, per-breakpoint layout (small-phone 6×16
  treatment left as the designer's one hard call), bounded motion rules, a
  deliverables list, and prior-art reference points.

## Not yet specified

*(empty — no open tickets. **The map is complete**: the destination — spec +
design brief — is delivered at [`spec.md`](spec.md) and
[`design-brief.md`](design-brief.md).)*

## Out of scope

- Any reactive visual layer in V1 — abstract visuals and the procedural
  runner both prototyped and shelved ([visualisation
  prototype](issues/04-visualisation-prototype.md), [runner
  prototype](issues/09-runner-prototype.md)); V1 only guarantees the
  beat-event seam a V2 layer would ride.
- The character/world layer (Rayman homage proper) — future effort, on top of
  that same seam.
- Server persistence, accounts, and server-backed share links. *(Amended
  2026-08-05: stateless URL-hash share links are in scope — see the prior-art
  survey and the spec ticket's revised decisions; it was server-backed
  sharing this ruling ever excluded.)*
- Any scoring/gamified rhythm-game mode.
