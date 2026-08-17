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
column — and holds where it was while the transport is stopped, unless a
**`seek(tick)`** moves it.
_Avoid_: Playhead position (fine as UI language, not as the engine method name).

**`seek(tick)`**:
The one way the transport's position moves other than by counting steps: it puts
the playhead at a tick, playing or stopped, and `songPos()` reads that tick at
once. Playing, the next scheduled step sounds from there; stopped, a later
`start()` resumes from there. A seek is neither a start nor a stop, so it emits
no transport event, and audio already scheduled inside the lookahead still
sounds (ADR 0024, as amended).
_Avoid_: Jump, scrub (**Scrub** is the gesture; `seek` is what it calls).

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
A grid of on/off cells, `boolean[6][16]` — exposed by the
engine as one row per kit instrument, in kit order, each carrying its
`instrumentId`. The engine-level term for the raw grid; a pattern with a name
and identity inside a boop is a **Clip**. Always 16 steps / 4 bars — clips are
never variable-length (boop-loops ticket 10).
_Avoid_: Song (a song is an arrangement of clips, not one grid), sequence.

**Clip**:
A named 6×16 pattern within a boop — `{ name, steps }`. Names are automatic
(`Clip 1`, `Clip 2`, …) and renameable inline, never forced. The working grid
always edits exactly one clip; every edit writes straight into it.
_Avoid_: Pattern (the engine-level term for the raw grid), loop, part.

**Tint**:
A clip's colour, one of the fixed list of 5 — how a child recognises a clip
across its chip, its placement squares, the clip header dot, and the grid-well
ring. A tint belongs to the clip for the clip's whole life: reordering or
deleting other clips never recolours it (boop-loops ticket 09). At most one
clip per tint; a new clip takes the lowest unused one.
_Avoid_: Colour (fine casually, but the term of art is tint), theme.

**Sample clip**:
A pre-made, pattern-only clip offered in the "+ New clip" picker (after
Blank) — a single-role, layerable phrase with a plain label ("Slow bass"),
which becomes the new clip's name. Carries no tempo: it plays at the boop's
one bpm. Always two words — a bare *sample* is an audio one-shot. Replaces
the retired **Starter** (boop-loops ticket 07).
_Avoid_: Sample (taken — the audio one-shot), starter, preset, loop.

**Song**:
The arrangement a boop holds: ordered clips, placements, and one bpm for the
whole boop. Played left to right through its placements, looping. Fixed at 16
positions, and holds at most 5 clips — one per tint (boop-loops ticket 01).
_Avoid_: Arrangement, track, sequence.

**Placement**:
One filled square on the lane grid — "play this clip at this position in the
song". A repeat is the same clip placed twice, never a counter.
_Avoid_: Slot (that is the empty square), block, instance.

**Layered position**:
A song position holding more than one placement: every clip in it sounds
together, its patterns overlaid (ADR 0032, amended). Still one position — one
slot in the song, one square in the bars count; the grid shows its topmost
lane while it sounds.
_Avoid_: Stack, chord, overlay (the mechanism, not the thing).

**Lane**:
One clip's row in the song bar: its chip (tint dot, name, ×n count) followed
by its placement squares. Each clip owns exactly one lane.
_Avoid_: Track, row (fine for the grid well; a lane belongs to the song bar).

**Bar**:
A quarter of a clip — 4 steps. A position is 4 bars, and a bar is the
resolution a scrub of the song strip snaps to (boop-playhead ticket 02).
Neither the engine nor `song.ts` knows what a bar is: `song/songTimeline.ts`
owns the arithmetic, deriving it from `STEPS_PER_PATTERN`.
_Avoid_: Measure, beat (a beat is 4 steps of *musical* time; "bar" is the term
of art here), quarter.

**Global bar**:
Where we are on the whole song's timeline, counted over the **placed**
positions only: `place in the timeline × 4 + bar`. The song's own unit of
position, and what both scrub strips move in. A song with 8 placed positions
is 32 global bars, whatever numerals those positions carry on the ruler —
empty positions are drawn but are not on the timeline and cannot be reached.
Converts to an engine **Tick** (`× 4` steps) so a scrub can call
**`seek(tick)`**.
_Avoid_: Song bar (taken — the pinned bar of lanes), absolute bar, beat.

**Scrub**:
Moving the playhead by gesture — a tap or drag on the song strip or the clip
rail. A *view* change and never an edit: a scrub must not mark the boop edited
and must not stop playback, so it takes a path parallel to the song mutations
(boop-playhead spec §2) — `song/songScrub.ts`, the sibling of `HomePage`'s
`updateSong`. Bar-resolution on the song strip, step-resolution on the clip rail.
_Avoid_: Seek (**`seek(tick)`** is the engine call a scrub makes), drag, seek
bar, scrubbing as a synonym for playing.

**Boop**:
A named, saved entry in "My boops" — wraps one song (clips + placements +
bpm). Until the loops feature lands it holds a single-clip song: one pattern
plus tempo, the shape the save format round-trips today. Both the domain term
and the storage-shape term (ticket 35) — one word for one concept.
_Avoid_: Groove (the pre-rename name, ticket 35 — left on old saved rows
but never used going forward), Creation (the type-level name before ticket
35's rename; `creations` survives only as the frozen save-document field
name, see [ADR 0025](../../docs/adr/0025-boop-save-format.md)), save, snapshot.

**Working grid**:
What a child is editing right now — an unnamed boop, continuously autosaved
and restored on the next load. Since boop-loops ticket 14 the slot holds the
whole **song** (clips, placements, one bpm, and which clip is on the grid), so
a reload lands on the clip the child was editing. Distinct from a saved boop:
it is one slot that always exists and is always overwritten, never an entry in
the "My boops" list. Saving into that list copies the working song and gives
it a name. A browser with no working song at all is *seeded* with a one-clip
song built from a sample clip rather than opening empty — see **Sample clip**.
_Avoid_: Current pattern, draft, session.

**Loaded boop**:
The saved boop the working grid came from, while it is still recognisably that
boop — its row in "My boops" plus whether the grid has since diverged
(ticket 31). Set by loading a row, adopted by a save, dropped by "New boop"'s
reset (Clear grid is clip-scoped and counts as an *edit* instead — boop-loops
ticket 07), and never restored on reload: it describes this session's
loading and saving, not what is on disk. It drives the chrome's saved/edited
indicator and the loaded row's ring. "Edited" has exactly one meaning across
the app — any mutation of the song: a cell toggle, a speed change, a placement
change, clip add, clip delete, clip rename, or a lane reorder. See
[ADR 0031](../../docs/adr/0031-boop-saved-state-visibility.md), as amended.
_Avoid_: Unsaved changes, dirty (nothing is ever lost — the working grid is
autosaved), current boop.

**Starter** *(retired — boop-loops ticket 07)*:
The old model: one of four fixed offerings in the "New boop" dialog (Blank,
Wonky Walk, Robot Hiccup, Sunday Stomp), each a whole pattern plus a tempo,
loaded *over* the working grid. Replaced by **Sample clip** — pre-made
content is now a layer you add, not a thing you load over everything —
while "New boop" becomes a plain button resetting to one blank clip.
_Avoid_: Using it for new work; say **Sample clip**.

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
