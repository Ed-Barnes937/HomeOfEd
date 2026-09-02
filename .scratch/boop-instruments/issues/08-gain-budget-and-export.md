# 08 - Gain budget re-verification and export over uneven rows

**What to build:** The two whole-system checks the row model changes.

**Gain.** `ToneAudioDriver`'s `MASTER_GAIN` (0.6) + Limiter(-1) were tuned
against six voices at peak 0.5 summing to ~1.83 raw. The worst case is now
the biggest simultaneous union of instruments across **layered clips** (up to
5 clips, each with its own rows, sounding the same step) - potentially far
more than six voices. Measure the realistic worst case (spec §3: measured,
not assumed), retune `MASTER_GAIN` if the limiter would pump audibly, and
rewrite the `kitLevels` dense-hit budget test to assert the **new** stated
budget (coordinating with ticket 01's interim change so the test never
silently weakens). Record the tuning rationale where the current one lives
(the driver comment + kitLevels).

**Export.** `renderSequence`/`renderBoopWav` iterate pattern rows already;
verify WAV export against a song whose clips have uneven row sets (different
counts, different instruments, layered placements) and against a
picked-but-unpainted clip. No redesign expected - this is a verification
ticket that fixes what it finds.

Spec: §3 (gain), §6 (export).

**Blocked by:** 01 (the 20 voices), 03 (mixed-row songs decode); layering
worst cases also want 04.

**Status:** done - **except the ear check, which is handed to the human**
(box 3 below). Everything measurable was measured offline; only the literal
listen at 200 bpm is outstanding.

- [x] The worst-case simultaneous union is stated (with the measurement method) in the driver comment, and `MASTER_GAIN` is retuned or confirmed against it
- [x] `kitLevels` budget test asserts the new stated budget over the new worst case
- [ ] An ear check at 200 bpm with a deliberately dense layered song: no audible pumping or clipping (note the result in this ticket)
      - **for the human.** The computational equivalent is in the comment
      below: pumping is now impossible by construction (the limiter applies no
      measurable reduction at the worst case), and the clipping that *was*
      there at the old gain is gone. But nobody has listened.
- [x] WAV export unit tests cover uneven row sets across layered clips and an all-off row; output matches live playback's row semantics

## Comments

**2026-09-02 (agent, implementation):** Done bar the ear check. The headline:
the worst case is **3.035 raw** and `MASTER_GAIN` went **0.60 -> 0.30**,
because measurement showed the old gain was clipping - and that the
`Limiter(-1)` never was the backstop its comment claimed.

**The worst case.** Because `mergePatterns` unions layered clips by
`instrumentId`, the most voices that can land on one step is the whole
20-instrument roster - one voice per instrument, however many of the 5 clips
are stacked, so the same instrument sounding from two clips is still one voice.
That union, painted solid and retriggering on every 16th at MAX_BPM 200 (tails
overlapping), measures **3.035** raw. The same union on a single step is
**2.970**, so all that tail overlap is worth only **0.26 dB** - the tails add
incoherently, as ticket 01 found. The classic six solid measures 2.072. The
budget is pinned at **3.1** in `kitLevels.test.ts`.

**Method** (spec §3: measured, not assumed). The 20 shipped one-shots were
summed offline at 200 bpm 16ths and rendered through the *real* master bus -
`Gain` then `DynamicsCompressorNode` - inside a Chromium
`OfflineAudioContext` driven by Playwright, reading back the output peak and
the count of samples over full scale. Scratchpad node scripts only; nothing
uncommitted is needed to reproduce the committed assertions.

**The finding that drove the retune.** Tone's `Limiter` never sets `knee`, so
it inherits `Compressor`'s default **30 dB** knee. A swept-sine static curve
through the real node measures its gain reduction at **1.22 dB when 12 dB over
threshold** - it is a backstop, not a peak controller, and it cannot catch 20
one-shot attacks landing in the same sample. Consequences at the old 0.60:
the worst case rendered a **1.794** peak with **2.93% of samples hard-clipped**
at the destination (153 ms per 5 s, i.e. on every step), and even the
pre-roster classic six clipped at **1.239**. So boop has been clipping since
before this epic; the 20-voice roster made it far worse. Tightening the limiter
was tried and rejected on measurement: at knee 0, even threshold -3 with gain
0.40 still rendered 1.131. No threshold/knee setting rescued it, so the gain
has to hold the raw sum under full scale on its own.

**The retune.** 0.30 x 3.035 = **0.911 peak, zero samples over full scale**, in
every case measured. 0.32 was the last clean step (0.971) and 0.33 clipped
(1.002), so 0.30 is the largest round gain that is clean and it keeps the
pinned 3.1 budget clean too (0.93). The limiter now applies no measurable
reduction at the worst case, which is what makes the ear check's answer
predictable: **pumping is impossible by construction** - a limiter that never
engages cannot pump. The cost is deliberate and worth stating: sparse
patterns, which were never clipping, are now quieter. Recovering that
loudness needs per-voice headroom or a true look-ahead limiter in an
`AudioWorklet` - a redesign, not a constant, and not this ticket.

**The export bug this turned up.** `renderSequence.ts` applied a per-voice
**0.5** on top of its own master 0.6, on the assumption that decoded samples
were full scale. They are not - the kit normalises every one-shot to 0.5
itself. So **every exported WAV has been exactly 6 dB quieter than the app**.
Fixed by deleting the per-voice gain, which leaves rendered files
**bit-identical** (verified: 0 float diffs and 0 pcm16 diffs over the dense
worst case, peak 0.910364 both ways - because 0.5 x 0.6 == 0.30 exactly in
binary floating point) and brings *playback* down to meet export. The two
paths now read **one** `MASTER_GAIN`, rehoused in the Tone-free seam
`engine/audioDriver.ts` so neither path can drift from the other and
`kitLevels.test.ts` can assert the budget closes: `3.1 * MASTER_GAIN <= 1`.
That last assertion is the one that makes the budget mean something - a new or
re-tuned voice that inflates the sum now forces the gain down instead of
quietly clipping.

**Export row semantics: verified, no redesign needed.** Both the live
conductor and `renderBoopWav` already route layering through the same
`mergePatterns`, so the row semantics were correct; the tests now pin that.
Added: layered clips with uneven row sets render their `instrumentId` union
(one row + three rows sharing one instrument = **3** voices, not 4 - the shared
instrument sounds once, and a kit instrument in neither clip never sounds); a
placed-but-unpainted clip renders a silent slot that still holds its 16 steps;
an all-off row contributes nothing; passes whose row sets differ in count and
in instrument each sound their own.

**Ear check - handed to the human.** I cannot listen. Play a deliberately
dense layered song at 200 bpm (5 placements stacked, many rows painted) and
confirm no pumping and no crackle. Also worth a subjective call I could not
make: **is 0.30 loud enough?** It is 6 dB below the old gain on sparse
patterns. If it feels too quiet, the fix is the per-voice-headroom or
look-ahead-limiter redesign above, not turning this constant back up - 0.33
and higher clip measurably.

Verified: `pnpm lint` green, `pnpm typecheck` green, **433** boop unit tests
green (up 7), **232** `.iwft` tests green.
