# Sound engine research

Type: research
Status: resolved
Blocked by: —

## Question

What should power the audio for a browser step sequencer aimed at kids on
tablets/laptops? Specifically:

- Raw Web Audio API vs Tone.js (or other libs) for a sample-accurate,
  continuously looping sequencer — scheduling approach, timing drift, bundle
  cost.
- Sample playback vs synthesis for the instrument palette, evaluated against
  the standing constraint that the palette must be **extensible** (adding
  instruments/kits later without rework).
- Mobile-browser audio constraints: autoplay/gesture unlock, latency and
  reliability on iPad Safari and Android Chrome, backgrounding behaviour.
- How the engine should emit beat events that a visualisation layer consumes
  in sync (lookahead scheduling vs on-beat callbacks).

Findings land on branch `research/sound-engine` as a markdown file.

## Answer

Full findings: `.scratch/music-app/research/sound-engine.md` on branch
`research/sound-engine` (commit `763257e`).

1. **Engine: Tone.js**, tree-shaken (~69 KB gzip vs ~92 KB full) — its
   worker-clocked `Transport` is the lookahead scheduler from "A Tale of Two
   Clocks"; actively maintained. Wrap it behind a small `SequencerEngine`
   interface.
2. **Instruments: sample playback**, one buffer per pad; kits are a JSON
   manifest + audio files, so adding instruments/kits is pure data — zero
   engine rework (`Tone.Sampler` repitching covers future melodic
   instruments; synths can slot in later as another instrument type).
3. **Mobile:** call `Tone.start()` inside the Play-button tap (gesture-gated
   audio on Chrome and WebKit); handle iPad Safari's non-standard
   `interrupted` state via `statechange`/`visibilitychange` plus a "tap to
   resume" UI; keep the default 0.1 s lookAhead.
4. **Backgrounding:** audibly-playing tabs escape Chrome's intensive timer
   throttling; iOS backgrounding interrupts audio outright — recover on
   return, don't fight it.
5. **Visual sync:** engine emits `{ step, audioTime }`; UI reconciles via
   `Tone.Draw` (or rAF against `AudioContext.currentTime`) — never DOM work
   inside scheduler callbacks. Matches the beat-event-bus principle from the
   visualisation research.
