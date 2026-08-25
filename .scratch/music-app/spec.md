# boop — product spec (V1)

Status: ready-for-agent
Produced by: [wayfinder map](map.md), ticket [07](issues/07-write-spec.md), 2026-08-05.

## What it is

**boop** is a kid-friendly (6+) music toy: a 6-instrument × 16-step step
sequencer that makes making a groove joyful. Music-first — there is no
reactive visual layer in V1 (prototyped and shelved; see
[Out of scope](#out-of-scope--future-direction)). Fun is the point; learning
is incidental. Mobile-first design; tablet and laptop are the expected real
screens.

- App: `apps/boop` · Subdomain: `boop.homeofed.com` · Fly app: `hoe-boop`
- Stateless app (no database — ADR 0008 pattern); persistence is
  localStorage, sharing is URL-encoded.
- Port row: claim the next free row in the port registry at build time
  (per `docs/how-to/adding-an-app.md`).

## Principles

1. **Fun first.** No scores, levels, timers, or fail states. Education is
   incidental — correct words on labels, never a curriculum.
2. **Nothing can sound bad.** Constraints live in the data (curated kit,
   short one-shots), not in warnings.
3. **A 6-year-old drives it alone.** No typing on the critical path, no
   file-system concepts, every action reachable by touch.
4. **Extensible by data.** Instruments/kits are manifest-defined; the
   beat-event seam lets a future visual layer ride without rework.

## Core experience

### The grid

- **6 instrument rows × 16 steps**, one always-looping pattern (locked by the
  [sequencer prototype](issues/03-sequencer-sound-prototype.md)). Single
  pattern in V1; chaining patterns into songs is the expected V2 direction.
- Steps are **visually grouped in 4s** (wider gap or shade every 4 steps) —
  bar structure absorbed by looking, and it keeps your place in the row.
- **Row labels are real instrument names + artwork**, never emojis or
  abstract icons. Go further: the artwork used for the row label is the same
  asset used as the note mark in the cell (the survey's strongest labelling
  pattern — CML Rhythm).
- **Touch model — latched drag-paint, per pointer:** pointer-down on a cell
  decides add-or-remove from that cell's current state; the whole drag
  repeats that decision; mode is tracked per pointer id so multi-touch
  painting works.
- **Audible edits while stopped:** toggling a cell on plays its sample
  immediately (engine-internal audition), so the grid is explorable without
  pressing play.
- **Clear-all** has a touch path and a confirm step. No keyboard-only
  destructive actions.
- Step-hit feedback is motion, never strobe/flash.
- The grid never silently shrinks on small screens (Song Maker's trap). The
  small-phone layout treatment (scroll with 4-group anchors, paging, …) is a
  design-brief question; the constraint is fixed here: always 6 × 16.

### Transport & tempo

- **Play/stop** is the one transport control. Loop is unconditional; there
  is no play-once mode and no record. There is no pause either: play always
  starts at the beginning (boop-loops ticket 22, [ADR 0024](../../docs/adr/0024-boop-sequencer-engine-seam.md)
  as amended) — the rewind moves the playhead only, never the pattern. The
  beginning is wherever the child has put the playhead, which is the start of
  the song until they scrub it somewhere else (boop-playhead).
- No button that resets the pattern while looking like "play from the top"
  (Song Maker's Restart trap). If a return-to-step-1 affordance exists, it
  must not touch the pattern.
- **Spacebar toggles play** globally (with `preventDefault`).
- **Tempo: a slider with logarithmic mapping** (equal travel = equal tempo
  ratio), labelled **"Tempo"** — never "BPM" — with the live BPM number
  rendered small beside the label (not on the thumb), and **Slow / Fast**
  word endpoints. Range on the order of 60–200; integer BPM after rounding.
- **No swing control** (prototype verdict: confusing for non-musical folk).

## Sound

- **Engine:** Tone.js (tree-shaken) behind a `SequencerEngine` TypeScript
  interface inside `apps/boop` (details below). Gesture-gated
  `Tone.start()`; handle iPad's `interrupted` AudioContext state; no DOM
  work in scheduler callbacks (all from the
  [sound-engine research](issues/01-sound-engine-research.md)).
- **Kits are pure data:** a JSON manifest + audio files per kit. The
  manifest defines each instrument's opaque `instrumentId`, display name,
  artwork, sound file, and an optional reserved semantic `role`
  (kick / snare / hat / perc / melodic) that V1 ignores but a V2 world layer
  can map behaviour onto.
- **Launch kit — playful hybrid**, six voices: kick, snare/clap, hi-hat,
  low perc/tom, a marimba-ish pitched hit, and a synth "boop" (on brand).
  Rows 1–4 are the rhythm section; the two pitched voices make a pattern
  sound like music without a melody lane.
- **Sample rules:** CC0/openly licensed only; short one-shots with no long
  tails, clean at 200 BPM; levels balanced so a dense 6-row pattern doesn't
  clip.
- The manifest supports multiple kits; **V1 ships exactly one** and no
  kit-switching UI.

## Persistence

- **Continuous autosave** of the working grid (pattern + tempo) to
  localStorage — debounced (Groove Pizza's 2 s + lull-check is the
  reference). Closing the tab never loses work. There is no "unsaved"
  state a child can be in.
- **"My grooves"** — a named list of saved creations:
  - Save snapshots the working grid into the list with a **prefilled
    generated name** (playful, e.g. "Groove 3") — typing is optional,
    rename available.
  - Tap to load; delete requires a confirm; **no cap** on list size
    (pattern JSON is tiny).
  - Storage shape is a **list of named creations**, where a creation holds
    (for now) one pattern — so V2 chaining grows a creation to several
    patterns without migration.

## Sharing & export

- **Primary: URL-hash share links.** The whole creation — pattern, tempo,
  kit id — is encoded in the URL fragment; no server, no account. Opening a
  link opens boop with the groove loaded and ready to play.
  - The **encoding is versioned** and derived from the save format, so
    added instruments, new kits, and future pattern chaining extend it
    without breaking old links.
  - Decode is defensive: a mangled or future-versioned link degrades to an
    empty grid, never an error.
  - Affordance: one Share action — **Web Share API sheet on mobile**,
    copy-to-clipboard with a "Copied!" label flip on desktop. No modal, no
    "copy this text" field.
- **Secondary: export to audio** (kids like owning their creations) —
  offline render of the pattern looped ~4× to a **WAV** file, offered
  behind/below the share action, via share sheet on mobile and download on
  desktop. No import.
  - **Verify on mobile Safari early** — the field gates or omits mobile
    audio export (Groove Pizza hides it on mobile), so this is the
    highest-risk feature and the **first candidate to cut** from V1.
  - A compressed format (mp3/AAC) is a later enhancement, not a V1 promise.
- No public gallery, feed, or community layer of any kind.

## Onboarding & light education

- **No guided tour** (revised after the
  [prior-art survey](issues/10-prior-art-research.md): zero of twelve
  surveyed products ships one — content does the onboarding everywhere).
- **Starter grooves:** 3–4 named preset grooves, with the **blank canvas
  presented first** among them (Groove Pizza's pattern). Loading a preset
  drops it in the grid ready to play and tweak — "now make it yours" is
  implicit.
- The app opens on an **empty grid** with the preset row visible (no
  first-load seeding).

  > **Amended by ticket 36 (V1.1 feedback).** Both halves of that sentence
  > change, together. The starters now live behind a **"New boop" dialog**
  > opened from the bottom bar, not in a row on the main screen — so an empty
  > opening grid would be a void with no suggestion in sight. Instead a
  > browser with no autosaved working grid **is seeded with `Wonky Walk`**,
  > the first non-blank starter, and that seed autosaves like any other load.
  > A browser that has been here before is never re-seeded, however empty its
  > grid. This keeps the principle above — content onboards, no tour, no modal
  > — and changes nothing about the save format. Blank stays first in the
  > dialog: not because nobody may meet a void any more, but because "New boop
  > → Blank" is the discoverable way to start fresh, while "Clear grid" is the
  > destructive-feeling one.
- An optional **"?"** opens a single static hint sheet (one screen, few
  words). No tooltips machinery, no forced steps.
- Education is carried by vocabulary and structure only: "Tempo" + live BPM
  number, real instrument names, steps grouped in 4s. Nothing interrupts
  play.

## Accessibility & input

- Grid container gets `role="application"` and a **self-describing
  `aria-label`** stating the keyboard contract (Song Maker's pattern);
  arrow keys move, Enter/Backspace toggle/remove, Space plays.
- Focus rings on keyboard use; touch-action prevention **scoped to the grid
  element** — never `user-scalable=no` or document-level
  `preventDefault` (keeps pinch-zoom working).
- All controls meet kid-sized touch targets (design brief to set sizes).
- No flashing imagery.

## Architecture

- **Stack:** SPA (TanStack Router + Query + tRPC client) per repo default;
  single container; stateless app with a shallow `/health` (no Store) —
  ADR 0008. Copy base `templates/starter`.
- **`SequencerEngine` interface** (inside `apps/boop`, Tone.js
  implementation behind it — no `packages/*` extraction). The full contract
  is in the [beat-event system ticket](issues/05-beat-event-system.md);
  binding summary:
  - **Schedule-time beat events are the canonical seam** (fire at
    scheduling, ~0.1 s lookahead, carrying `audioTime`); a **draw-time
    convenience subscription** (Tone.Draw semantics) serves V1's playhead
    and hit flashes.
  - Payload, one event per step (empty steps included):
    `{ tick, step, audioTime, hits: [{ instrumentId }] }` — `tick`
    monotonic (never wraps at the pattern boundary), `step` = tick mod 16,
    `hits` entries are objects so future fields (e.g. `note`) are additive.
  - **`songPos()`** continuous query, re-anchored each scheduled beat.
  - Transport events `started`/`stopped` and `tempoChanged { bpm }`.
  - **Pattern edits are not an event stream** — the pattern is readable
    state; consumers re-derive. Audition-on-toggle is engine-internal.
  - `instrumentId` is opaque, manifest-defined; the contract never
    enumerates instruments.
- Domain terms (beat event, tick vs step, hit, `songPos()`, kit manifest,
  role) land in `apps/boop/CONTEXT.md` at build time.
- Tests per repo rules: TDD, `*.test` for engine/encoding logic (the hash
  codec and save format are prime unit-test targets), `*.iwft` for the
  whole-frontend loop.

## Out of scope / future direction

Out of scope for V1 (from the [map](map.md)):

- Any reactive visual layer — abstract visuals and the procedural runner
  were both prototyped and shelved. V1's only obligation to that future is
  the beat-event seam above.
- The character/world layer (Rayman homage) — V2 candidate riding the seam;
  beat-space positioning (entities placed by arrival tick) is the model.
- Server persistence, accounts, server-backed share links, and any social/
  community layer.
- Scoring or gamified rhythm-game modes.

Expected V2+ directions (design for, don't build):

- **Pattern chaining into songs** — the confirmed next step; the
  creation save format and hash encoding are already shaped for it.
- **Pitched melody lane** — when it comes, ship it scale-quantised with the
  scale chooser hidden (constraint-in-the-data, per the survey).
- **Kit switching** — manifest already supports it; pure content + a
  switcher UI.
- Compressed audio export.

## Design-brief handoff (ticket 08)

Questions this spec deliberately leaves to the design brief: visual
identity and instrument artwork; the small-phone treatment of the fixed
6 × 16 grid; touch-target sizes; preset-row presentation; hint-sheet
content; playhead/hit-flash motion design. The
[prior-art survey](issues/10-prior-art-research.md) (full findings on
branch `research/prior-art`) is required reading for it.
