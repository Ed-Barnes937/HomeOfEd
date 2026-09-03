# Spec: boop instruments (dynamic clip rows + the big roster)

Status: **agreed** - drafted and all open questions resolved with the owner
2026-09-02 (§10). Ready for `/to-tickets`.

Boop grows from a fixed 6-instrument grid to a 20-instrument roster with
dynamic rows: a clip shows 6 rows by default, the child can add rows (the grid
overflows vertically), remove rows, and swap any row's instrument by tapping
its rail icon. Pitched variants (e.g. Marimba low/high) are explicitly a
follow-up, not this effort.

**Sources of truth:**

- **Audio seam:** [ADR 0024](../../docs/adr/0024-boop-sequencer-engine-seam.md) -
  the `SequencerEngine` contract; this effort amends its `Pattern` wording.
- **Grid geometry:** [ADR 0027](../../docs/adr/0027-boop-small-phone-layout.md)
  ("the grid never shrinks") and [ADR 0030](../../docs/adr/0030-boop-fixed-frame-one-scroller.md)
  (the fixed frame; the well's nested rows scroller). Amended, not repealed - see §7.
- **Save format:** [ADR 0025](../../docs/adr/0025-boop-save-format.md) /
  [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md). **No shape change**
  and no version bump - see §5.
- **Vocabulary:** [`apps/boop/CONTEXT.md`](../../apps/boop/CONTEXT.md). New
  terms of art this spec adds: **Roster** (the kit manifest's full instrument
  list), **Row** (one clip lane on the grid: an instrument choice + 16 cells).

---

## 1. The model

- The **kit manifest is the roster**: all 20 instruments live in
  `public/kits/launch/kit.json`, still the only enumeration of instrument ids
  ("kits are pure data" stands unchanged).
- A **clip owns its rows**: an ordered list of (instrumentId, 16 cells).
  Default for a new/blank clip: the roster's first six (the classic
  kick/snare/hat/tom/marimba/boop, which stay first in the manifest).
- **Row count: min 1, max = roster size.** No duplicate instrument within a
  clip (cells are addressed by `instrumentId` throughout the engine and save
  format, so uniqueness is structural, not taste). The picker enforces it by
  disabling instruments the clip already has.
- Steps stay fixed at 16. Two clips in one song may have entirely different
  rows; layered placements just sound their union.

## 2. The roster (6 existing + 14 new)

Picker groups and order. Names are the child-facing copy.

| Group | Instruments |
|---|---|
| **Drums** (10) | Kick, Snare, Hi-hat, Tom, Clap, Shaker, Cowbell, Woodblock, Triangle, Cymbal |
| **Notes** (6) | Marimba, Boop, Bass, Bell, Chime, Pluck |
| **Silly** (4) | Boing, Pop, Zap, Drip |

Sound character (all synthesized - see §3):

- **Clap** - three staggered noise bursts, tight.
- **Shaker** - soft high-passed noise pair, quieter than the hat.
- **Cowbell** - two inharmonic mid partials, fast decay, honky.
- **Woodblock** - short resonant mid tick with a click transient.
- **Triangle** - high inharmonic partial stack, shimmery, short tail.
- **Cymbal** - bright noise with the longest tail the kit's 400 ms duration
  cap allows (see §10.3: noise tails add incoherently, so this passes the
  200 bpm retrigger rule; trim the tail if the real test disagrees).
- **Bass** - low sine pluck (~90 Hz), the low anchor the kit lacks.
- **Bell** - glockenspiel-like: fundamental + inharmonic upper partial, above
  the marimba's register.
- **Chime** - sparkly stacked partials, softer attack.
- **Pluck** - bright string-ish pluck: harmonic partials with staggered decays.
- **Boing** - springy pitch wobble (needs a vibrato voice added to the
  generator).
- **Pop** - tiny upward sine blip, ~40 ms, bubble-wrap.
- **Zap** - fast 2 kHz→200 Hz laser sweep.
- **Drip** - short upward water-drop chirp.

## 3. Sounds and artwork

- **Sounds are synthesized**, extending
  `apps/boop/scripts/generatePlaceholderSamples.mjs` in its own idiom (sweeps,
  noise, partial mixes; new building blocks: vibrato, staggered bursts). Same
  reasons as ticket 18 (CC0 one-shots not fetchable from the agent
  environment; no third-party audio in the repo), same per-voice budget
  (peak 0.5, short tails). `ATTRIBUTION.txt` gains the 14 new voice
  descriptions; `kitLevels.test.ts` extends to all 20 (peak, duration,
  200 bpm retrigger).
- **Gain budget re-verified, not assumed.** The `MASTER_GAIN`/limiter comment
  was tuned against 6 voices; the worst case is now the biggest simultaneous
  union across layered clips. Measure and retune `MASTER_GAIN` if needed;
  the limiter stays the backstop.
- **Artwork** continues the ticket-18 pattern: game-icons.net CC BY 3.0 SVGs,
  per-icon authorship verified and recorded in `ATTRIBUTION.txt`. Real artwork
  remains ticket 28, whose scope grows to 20 - flag this on that ticket.

## 4. UX

### The rail icon is the instrument button

- Every row's rail artwork becomes a button (both `Grid` and `PhoneGrid`;
  the phone rail is pinned, so it is always reachable).
- Tapping it opens the **instrument picker**: a paper-card dialog in the
  `NewClipPicker` idiom, sectioned Drums / Notes / Silly, each entry icon +
  name in the row hue.
- **Tap an instrument = audition + apply live**: the sound plays and the row
  swaps to it immediately (painted steps are kept - same rhythm, new sound).
  The dialog stays open so the child can browse by tapping through sounds;
  dismiss is ✕ / tap outside / Esc. This deliberately differs from
  NewClipPicker's choose-and-close: this dialog is for finding a sound by ear.
- Instruments already in the clip are shown disabled ("already in this clip").
- The picker footer carries **"Remove this row"** (hidden/disabled at 1 row).
  No confirm: it is one tap to re-add and the toy has no confirms anywhere.

### Adding a row

- An **"+ Add a sound"** button sits under the last row, inside the well's
  scrolling rows box (so it scrolls with the rows; the clip play footer stays
  pinned). It opens the same picker; choosing appends the row and closes -
  this one does close, since "add" is a single decision, not browsing.
  Disabled when the clip holds the whole roster.
- New rows append at the bottom. Row reordering is **out of scope** (§9).

### Colour

- Row hue stays **positional**, cycling: `ROW_COLOR_VARS[rowIndex % 6]`.
  Rows read top-to-bottom in a stable rainbow whatever the instruments;
  deleting a row recolours the rows below it, which is accepted (the
  alternative - a colour field per manifest instrument - is recorded as
  rejected for now; revisit if the cycling reads badly with 10+ rows).

### Geometry

- **Laptop/tablet**: more rows grow the well; the well's existing nested rows
  scroller (ADR 0030 as amended by ticket 23) absorbs the overflow with the
  clip play footer pinned. No new scroller.
- **Phone**: the pinned rail and step window gain rows the same way; the
  region scrolls to pay for them, as today. The three-rows-plus-loop-map
  `min-height` floor becomes `min(3, rowCount)` rows plus the loop map.
- Playback never auto-scrolls a row into view (ADR 0027's rule, extended to
  the vertical axis).
- Thumbnails (`PatternThumbnail`) and the loop map render the clip's actual
  row count; dot size scales down as rows grow (detail for the ticket).
- Aria copy becomes dynamic: "N by 16 step grid".

## 5. Persistence - the "come back to clip 1" question

**A clip's instrument selection IS its pattern's row list.** `StoredPattern.rows`
is already an ordered list of `{ instrumentId, steps }`, and an all-off row
still stores `{ instrumentId, steps: "0000000000000000" }`. So a child who
picks instruments on clip 1 without painting anything, visits clip 2, and
comes back, sees exactly their rows: the selection was never separate state -
it round-trips through `Song.clips[i].pattern`, the autosave, "My boops", and
share links with **no new field**.

What changes is semantics, not shape (still `SAVE_FORMAT_VERSION` 1):

- `storedToPattern` stops rebuilding one-row-per-kit-instrument and instead
  honours the stored rows verbatim (membership and order), dropping ids the
  kit no longer knows. Old documents wrote exactly the launch six in kit
  order, so they decode identically.
- `decodePattern` gains: at least 1 row, no duplicate `instrumentId`.
  (Row-count max is the roster's size at decode time; a doc naming unknown
  ids still decodes - the unknown rows drop, per the existing tolerance.)
- **Stale-build story** (same class ADR 0032 accepted for layering): an old
  build reading a new boop with, say, a Cowbell row shows the classic six
  with that row's steps silently absent. Degrades, never rejects.
- `sampleClips.ts` stays position-keyed over the roster's first six - the
  authored clips are unchanged and always resolvable.

## 6. Engine contract changes (ADR 0024 amendment)

- `Pattern` is redefined: **the clip's rows** - ordered, unique
  `instrumentId`s, 1..roster length - not "one row per kit instrument, in kit
  order". `setCell`/`setPattern`/`getPattern` signatures are unchanged.
- New method: **`audition(instrumentId): void`** - play one instrument's
  sample now (from a user gesture; a no-op while `locked` is being unlocked,
  mirroring audition-on-toggle's behaviour). The picker is its only caller.
  Audition-on-toggle stays engine-internal as today.
- The driver preloads the whole roster's samples up front (20 short wavs),
  regardless of which rows any clip uses.
- Export (`renderSequence`/`renderBoopWav`) iterates pattern rows already;
  verify it against uneven row sets across clips, no redesign expected.

## 7. Rules and ADR bookkeeping

One new ADR ("boop dynamic clip rows") records the model and amends:

- **ADR 0027**: "6 x 16, always" becomes "16 steps always; the rows are the
  clip's own, default six, minimum one - and no breakpoint may drop a row or
  a step". The spirit (layout never hides music) is unchanged.
- **ADR 0024**: the `Pattern` wording and the `audition` addition (§6).
- **ADR 0031** ("edited"): row add, row remove, and instrument swap are song
  mutations, going through the same `afterEdit` pairing.
- ADR 0030 needs **no** amendment: the rows scroller it already sanctioned is
  what absorbs the vertical overflow.

## 8. Testing

House style per `apps/boop/CLAUDE.md`: pure logic under Vitest (row
mutations in `song.ts`, save-format decode rules, kit parse, kitLevels for
all 20 voices), whole-frontend `.iwft` kept thin: pick-swap-persist across a
clip switch (the §5 scenario, verbatim), add/remove row, the disabled states,
and one phone-layout pass.

## 9. Out of scope

- Pitched variants of melodic instruments (agreed follow-up).
- Row reordering (drag or otherwise).
- Per-instrument manifest colours.
- New kits / kit switching UI; sourcing recorded (CC0) audio.
- Real artwork (ticket 28, scope note in §3).

## 10. Resolved questions (owner, 2026-09-02)

1. **Picker interaction: live-apply, stay open** (as §4 specifies). Tap
   auditions and swaps the row immediately; the dialog stays open for
   browsing by ear. The add-row flow still closes on choose.
2. **Positional hues confirmed**; recolour-on-delete accepted.
3. **Cymbal: full 400 ms noise tail at an unchanged 200 bpm cap.** The
   retrigger rule measures the summed waveform against 1.4x a single hit;
   coherent (tonal) tails would force ~110-185 bpm depending on ring length,
   but noise tails add incoherently (~in power), so a 400 ms noise cymbal
   builds to only ~1.16x at 200 bpm. Verify against the real kitLevels test;
   if it fails, trim the tail - **never lower `MAX_BPM`**: `decodeStoredBoop`
   rejects any boop whose tempo exceeds it and one invalid boop discards the
   whole save document, so lowering the cap would wipe existing saves.
