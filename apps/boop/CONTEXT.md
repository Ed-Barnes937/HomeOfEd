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
_Avoid_: Playhead position (fine as UI language, not as the engine method name).

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
The single working grid of on/off cells, `boolean[6][16]`. V1 has exactly one
pattern per creation; chaining several patterns into a song is the confirmed
V2 direction the save format is already shaped for.
_Avoid_: Song (a pattern is not yet a song in V1), sequence.

**Creation**:
A named, saved entry in "My grooves" — currently wraps one pattern (plus
tempo), shaped so a V2 creation can grow to hold several chained patterns
without a storage migration.
_Avoid_: Groove (used informally/in copy for the same thing, but "creation" is
the storage-shape term), save, snapshot.
