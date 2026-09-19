# Spec: pitched instrument lanes (boop)

Status: **agreed** - grill session completed 2026-09-17 (two rounds, all
frontier questions settled, Ed confirmed the shared understanding). Ready for
implementation via `issues/`.

This document folds the design handoff and every grill-session decision into
one place. It records the deltas from the handoff and everything the handoff
left open; where it cites the handoff, that file holds the visual detail.

**Sources of truth:**

- **Visuals:**
  [`docs/reference/design_handoff_pitched_lane/README.md`](../../docs/reference/design_handoff_pitched_lane/README.md)
  and its `pitched-lane-reference.html`. **Direction-level, not pixel-perfect**
  (see §2 - this is an explicit, Ed-decided exception to
  `apps/boop/CLAUDE.md`'s "recreate pixel-close" rule, scoped to this handoff's
  geometry only; colours, radii, shadows and type remain exact).
- **Data model:** [ADR 0025](../../docs/adr/0025-boop-save-format.md) /
  [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md) - the additive
  `pitches` field (§4) follows their degradable-additive pattern and gets its
  own ADR (ticket 02).
- **Audio feasibility:** the 2026-09-17 Tone.js research (summarised in §5;
  tone 15.1.22 verified). Grill Q&A ledger: `.lavish/pitched-lane-grill-round-1.html`
  (local, not committed).
- **Vocabulary:** `apps/boop/CONTEXT.md` gains **Pitched row**, **Lane**,
  **Pitch index**, **Anchor pitch** (ticket 06).
- **Parked origin:** `.scratch/boop-note-instruments/issues/01` - the idea
  ticket this effort resolves.

---

## 1. Overview

A **pitched row** is an ordinary boop row whose step cells are replaced by a
**lane**: a column of 8 stacked cells per step, where cell height is pitch -
tap high, hear high. Eight cells are one major octave, do to do (the top and
bottom are the same note an octave apart, so runs resolve and known tunes are
playable - the handoff's settled rationale). Same 16 steps, same bars, same
playhead, same add/remove row behaviour; a column can hold several notes (a
chord), exactly as drum columns layer instruments.

Five instruments are pitched at launch: **trumpet, bass, piano** (new) and
**marimba, boop** (converted from one-note). Everything else stays one-note.

## 2. Geometry: the lane adopts the app, not the reverse

The handoff draws a 40px-step world and forces every existing row to narrow to
it. **Ed rejected that** (grill Q7/R2-3): the handoff is well-defined
direction; boop's existing geometry is the fixed frame.

- The lane renders on **boop's existing step columns** at every width: 52px
  cells / 8px gaps on desktop, the 1024-1279 tablet band's 42px, the phone
  window's own sizes. Existing rows do not change at all.
- The handoff's lane-internal numbers **rescale onto those columns**: 8 cells
  per column, cell height ~20px with ~4px gaps (tune to the real column
  width), plate with negative-margin flush trick, hit bands recomputed to the
  real geometry (interior bands centred on their tiles; top/bottom bands
  absorb the plate padding - the handoff's off-by-plate-padding bug warning
  stands).
- Everything non-geometric is **exact as designed**: hue ladder, plate
  colours/shadows, playhead column treatment, the dark-inside/light-outside
  ring (also the focus ring), HIGH/LOW gradient legend, collapsed pebbles,
  label-column variants, type.
- This dissolves the handoff's 1022px card width, bar-strip widths and the
  tablet question entirely; the spec is the record of that policy.

## 3. Roster, conversion, and old saves

- Kit manifest (`kit.json`) gains an additive per-instrument **`pitched`**
  config (exact shape: ticket 03). `role: "melodic"` stays pure picker
  taxonomy and does not imply pitched.
- **Conversion anchor rule (R2-2):** a pitched row's steps that carry no pitch
  data read as the **anchor pitch "so"** (pitch index 4, the middle), and for
  converted instruments the anchor **is the current sample's pitch** - so
  every existing saved boop and share link using marimba/boop **sounds
  byte-identical** and displays its notes mid-lane.
- The same rule sets the sourcing bar for new instruments: root samples are
  recorded/sourced at the lane's **middle** ("so"), keeping repitch within
  ~±6 semitones (research: a bottom root repitches +12st, the
  worst-fidelity direction).
- **Key: C major** (R2-4) for the ensemble. Resolution rule for the built-in
  tension: measure marimba's and boop's actual sample pitch first; if either
  is not (close to) a C-major-compatible anchor, **bring the cross-instrument
  clash back to Ed** - do not silently retune a sample old boops depend on.
- Registers (which octave each instrument's "do" sits in) are per-instrument
  manifest data, chosen by ear during build; **Ed's ear check gates the
  activation merge**.

## 4. Data model

- `StoredRow` gains an optional **`pitches`** field beside `steps`
  (ADR 0025-family additive change; version stays 1):
  - 32 lowercase hex chars - two per step, in step order; each byte is a
    bitmask of pitch indices, **bit 0 (LSB) = pitch index 0 = bottom = do**,
    bit 7 = top = high do. Regex `^[0-9a-f]{32}$`.
  - `steps` remains the `[01]` **any-note projection**: `steps[s] === '1'`
    iff the pitch byte for step s is non-zero. The encoder derives `steps`
    from `pitches` for pitched rows; decode treats a mismatch, bad length or
    bad charset as an invalid boop (strict all-or-nothing, per ADR 0025).
  - A row **without** `pitches` on a pitched instrument is the degrade path:
    every on step reads as the anchor pitch (§3). A stale build reading a
    pitched document validates fine, plays the rhythm on the base sample, and
    drops `pitches` if it re-saves - the accepted ADR 0032 stale-build class,
    without the document-destroying version bump.
- Share links inherit all of this for free (same codec, ADR 0026). Size is a
  non-issue (+~44 base64url chars per pitched row).
- `collapsed` is UI-only state, **not** persisted (Q8): rows start expanded,
  reset on reload, per-row chevron only.
- Engine `Pattern` rows carry the pitch sets in memory (shape: ticket 01);
  `pitchIndex` 0-7 counts **from the bottom** app-wide (the handoff's state
  section; the hue ladder's table happens to index from the top - convert at
  the ladder, nowhere else).

## 5. Audio

- **Mechanism (Q10 + research):** one root sample per pitched instrument; a
  pitched hit creates one `ToneBufferSource` per note with
  `playbackRate = 2^(semitones/12)`, scheduled at the hit's `audioTime` -
  the driver's existing one-source-per-hit pattern, extended with a pitch.
  An 8-note chord is 8 sources on one buffer (canonical Web Audio; buffers
  are shared, sources are cheap, no voice limit). `Tone.Sampler` was
  evaluated and **rejected**: internally the identical mechanism, wrapped in
  note-name/envelope/buffer-ownership machinery the driver seam doesn't want.
  `GrainPlayer` rejected for short one-shots (grain artifacts, single-voice).
- The `AudioDriver` seam change is engine-side and typed; Tone stays confined
  to `toneAudioDriver.ts` (ADR 0024 holds). Audition-on-toggle carries the
  tapped pitch.
- **Accepted sampler physics:** note length scales with pitch (low = longer,
  high = snappier). Never double-schedule the same pitch of the same
  instrument at the same time (sample-exact +6dB unison).
- **Loudness budget must be re-measured (research finding):**
  `MASTER_GAIN = 0.3` and `kitLevels.test.ts` assume at most one voice per
  instrument per step; an 8-note chord breaks that invariant and the
  `Limiter(-1)` cannot catch it. Ticket 09 re-measures the pitched worst case
  and re-pins - expected shape is per-chord gain scaling (~1/sqrt(n), via the
  source's gain), not another global gain cut.

## 6. Interactions

Per the handoff, on the rescaled geometry:

- **Tap** paints a note at that pitch; tapping another cell in the column
  **adds** (chords), never replaces.
- **Drag** fills every cell it crosses - a vertical cluster, no line-drawing,
  no replace semantics. Built on/beside `useDragPaint`'s latched model; on
  phone it must obey PhoneGrid's paint-vs-scroll rules (browser owns
  horizontal pans; a drag paints only after crossing a cell boundary).
- **Hit bands:** the column carries the hit, split into 8 bands centred on
  their tiles; top/bottom bands extend through the plate padding.
- **Collapse** to the ~56px pebble summary (positions by pitch); collapsed
  rows still receive the playhead column. Expand/collapse is the 44px chevron.
- **Playback** unchanged: every painted note in the column sounds on the step.

## 7. Accessibility

- **Solfège is what a pitch is called out loud** (Q6): do, re, mi, fa, so, la,
  ti, high do. Screen readers announce cell = "<solfège>, step N" (exact copy:
  ticket 06); the octave duplicate is "high do".
- **Letter names are what the lane shows**, in a gutter down the left of the
  cells (ticket 15, ADR 0066): one per tile, no octave number, derived from the
  instrument's `rootNote` through `pitch.ts` so the manifest's key is the only
  key. It is `aria-hidden` - the cells already announce themselves, and a label
  per tile would read every cell twice. The gutter takes the rail's last column
  at every width and **replaces the HIGH/LOW gradient legend**, which said less
  about the same thing. A second scheme (solfège in the gutter, on a preference)
  is an array swap, and is deliberately not built.
- Focus follows the existing grid keyboard model, extended vertically within
  a lane column; the handoff's ring is the focus ring.
- Pitch is conveyed by position; the hue ladder stays secondary. Do not
  darken the ladder or lighten labels (measured AA in the handoff).
- Every control ≥44px except lane cells, which the column hit bands cover.

## 8. Phone

In the epic, engineering-led (Q2): the lane joins PhoneGrid's pinned rail +
snap-scrolling step window on the phone's own column sizes. **Tripwire:** if
the 8-cell lane structurally fights the strips model (not merely "needs
care"), stop and kick phone back to the design project rather than inventing
a novel phone UI. The no-scroll-during-playback rules (ADR 0042) and the
fixed-frame rules (ADR 0030/0035) are unbreakable.

## 9. Artwork & sounds

- Trumpet, bass, piano artwork: agent-drawn SVG in the kit's existing flat
  style (Q4), **Ed approves by eye** before activation.
- Root samples for the three new instruments sourced the same route as the
  current kit's sounds, at the mid-range anchor (§3). Ed's ear check gates.

## 10. Out of scope

- Chord affordances beyond stacking taps (the originating design file's
  turn 7 - explicitly not in the handoff).
- User-settable octave/register, scales other than major, more than 8 cells.
- Choosing between naming schemes. Note names in the UI **were** out of scope;
  Ed reversed that and ticket 15 built the gutter (§7, ADR 0066). What stays out
  is the preferences switch between letters and solfège - later, additive.
- Persisting collapse state (additive later if wanted).
- Converting any further one-note instruments (cheap follow-ups once the
  lane exists).

## 11. Rollout shape

Tickets 01-09 land capability that is **dormant on main** (no manifest entry
is pitched yet, so nothing user-visible changes per PR). Ticket 10 is the
activation: new instruments + conversions flip on together, gated on Ed's ear
check and art approval. Every PR passes the standard verify loop; anything
that persists or shares goes through `saveFormat.ts` only.
