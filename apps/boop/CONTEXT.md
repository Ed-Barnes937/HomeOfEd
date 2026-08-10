# boop

A kid-friendly music toy: a 6-instrument x 16-step step-sequencer that loops
forever. The domain is small — one pattern, one kit, one clock — but the
vocabulary matters because it is shared between the audio engine, the grid UI,
and the future visual layer riding the beat-event seam.

## Language

**Tick**:
A monotonic count of scheduled beats since the engine started; never wraps at
the pattern boundary, unlike `step`.
_Avoid_: Beat count, frame.

**Step**:
A position in the pattern, `tick mod 16` — one of the 16 columns in the grid.
Distinct from `tick`: two different ticks can land on the same step once the
loop has gone around once.
_Avoid_: Beat, column (when referring to the index; "column" is fine as UI
layout language).

**Beat event**:
The canonical, schedule-time notification the `SequencerEngine` emits once per
step (empty steps included), carrying `{ tick, step, audioTime, hits }`. Fires
at scheduling time with lookahead, not at the moment of playback — the seam
future consumers (a visual layer, a world/character layer) hook into.
_Avoid_: Tick event, note event.

**Hit**:
One instrument sounding on a given step — an entry in a beat event's `hits`
array, `{ instrumentId }`. A step can carry zero or several hits (one per
active instrument row).
_Avoid_: Note, trigger.

**`songPos()`**:
A continuous query on the `SequencerEngine` for the current playhead position,
re-anchored at each scheduled beat. Distinct from `step`: `step` is discrete
(which column), `songPos()` is continuous (where within the loop right now).
It reads in **tick space** — a fractional tick, so `songPos() % 16` is the grid
column — and freezes where it was while the transport is stopped.
_Avoid_: Playhead position (fine as UI language, not as the engine method name).

**Audition**:
The single sample the engine plays when a cell is turned **on while stopped**,
so an edit is always heard. Engine-internal: callers toggle cells and never
trigger sound themselves. Turning a cell off, or editing while the loop runs,
does not audition (the step itself will sound it).
_Avoid_: Preview, echo.

**`AudioDriver`**:
The seam between the engine's logic (ticks, hits, anchoring, event fan-out) and
the audio library (AudioContext, the sixteenth-note clock, sample playback).
`ToneAudioDriver` is the only file that imports Tone.js; `FakeAudioDriver` is
the hand-cranked clock the contract tests run against.
_Avoid_: Audio backend, adapter.

**Audio state**:
Whether the engine can be heard: `locked` (no unlocking gesture yet),
`running`, or `interrupted` — iPadOS Safari's non-standard state after a call
or a lock, which needs another `start()` gesture. Entering a non-running state
while playing stops the transport, so the UI never shows a silent playhead.
_Avoid_: Muted, suspended.

**Kit manifest**:
The pure-data JSON description of a kit: one entry per instrument with its
`instrumentId`, display name, artwork, sound file, and optional `role`. Kits
are swappable by shipping a new manifest — V1 ships exactly one.
_Avoid_: Instrument list, sound pack.

**Role**:
An optional semantic tag on a kit-manifest instrument entry (kick / snare /
hat / perc / melodic). V1 ignores it entirely; it exists as a reserved seam
for a future layer (e.g. a world/character layer) to map behaviour onto
instruments without the engine ever enumerating them.
_Avoid_: Category, type.

**`instrumentId`**:
An opaque, manifest-defined identifier for one instrument/row. The
`SequencerEngine` contract never enumerates instruments by name — it only
ever carries this id.
_Avoid_: Instrument name, row id.

**Pattern**:
The single working grid of on/off cells, `boolean[6][16]` — exposed by the
engine as one row per kit instrument, in kit order, each carrying its
`instrumentId`. V1 has exactly one
pattern per boop; chaining several patterns into a song is the confirmed
V2 direction the save format is already shaped for.
_Avoid_: Song (a pattern is not yet a song in V1), sequence.

**Boop**:
A named, saved entry in "My boops" — currently wraps one pattern (plus
tempo), shaped so a V2 boop can grow to hold several chained patterns
without a storage migration. Both the domain term and the storage-shape
term (ticket 35) — one word for one concept.
_Avoid_: Groove (the pre-rename name, ticket 35 — left on old saved rows
but never used going forward), Creation (the type-level name before ticket
35's rename; `creations` survives only as the frozen save-document field
name, see [ADR 0025](../../docs/adr/0025-boop-save-format.md)), save, snapshot.

**Working grid**:
The pattern and tempo a child is editing right now — an unnamed boop,
continuously autosaved and restored on the next load. Distinct from a saved
boop: it is one slot that always exists and is always overwritten, never an
entry in the "My boops" list. Saving into that list copies the working grid
and gives it a name. A browser with no working grid at all is *seeded* with a
starter rather than opening empty (ticket 36) — see **Starter**.
_Avoid_: Current pattern, draft, session.

**Loaded boop**:
The saved boop the working grid came from, while it is still recognisably that
boop — its row in "My boops" plus whether the grid has since diverged
(ticket 31). Set by loading a row, adopted by a save, dropped by Clear grid and
by loading a starter, and never restored on reload: it describes this session's
loading and saving, not what is on disk. It drives the chrome's saved/edited
indicator and the loaded row's ring. "Edited" has exactly one meaning across
the app — a cell toggle *or* a tempo change. See
[ADR 0031](../../docs/adr/0031-boop-saved-state-visibility.md).
_Avoid_: Unsaved changes, dirty (nothing is ever lost — the working grid is
autosaved), current boop.

**Starter**:
One of the four fixed offerings in the "New boop" dialog — Blank, Wonky Walk,
Robot Hiccup, Sunday Stomp. Pure data, position-only rows plus a tempo, loaded
into the working grid on a tap. A starter has no identity once loaded: it is
never a saved boop, and the ring saying which one is loaded is internal to the
dialog. `Wonky Walk` is also the **first-visit seed**, which is what a browser
with no working grid opens on.
_Avoid_: Preset (the code's name for the same thing — `presets.ts`, `PresetId`
— kept because the design handoff says "preset row"; prefer "starter" in
product copy and prose), template, demo.

**Step window**:
On a phone, the horizontally scrolling viewport over the 16 step columns —
about 6.9 of them at the 390px reference width, snapping to the four 4-step
groups so it always settles on a bar line. It is a *view* onto the pattern, not
a smaller pattern: the grid is still 6 x 16 and the instrument rail beside it
never scrolls.
_Avoid_: Viewport (that is the browser's), page, visible grid.

**Loop map**:
The 16-tick "WHOLE LOOP" band under the phone grid — one tick per step, reading
playhead / has-notes / empty, with a bracket showing which half of the loop the
step window is on. Because it never scrolls, the playhead is never lost: it
moves from the grid to the map. Distinct from a preset **thumbnail**, which
shows a whole 16 x 6 pattern rather than the loop's 16 steps.
_Avoid_: Minimap, overview, scrollbar.

**Save document**:
The single versioned JSON object boop keeps in `localStorage` (key `boop:save`)
— `{ version, working, creations }`. The one place the save format's version
lives, and the shape the share-link codec is derived from. Decoding it is
total: anything corrupt or future-versioned reads as an empty document.
See [ADR 0025](../../docs/adr/0025-boop-save-format.md).
_Avoid_: Save file, state blob, storage schema.
