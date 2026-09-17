# 04 - Root samples and registers for the five pitched instruments

**Status:** ready-for-agent (carries a ready-for-human gate: Ed's ear check)
**Blocked by:** 03

**What to build:** Sound content for activation. (1) **Measure** the actual
pitch of the current `marimba.wav` and `boop.wav` - their pitch becomes their
anchor "so" (spec §3, old boops must sound byte-identical). If either is not
close to a C-major-compatible anchor, **stop and raise the cross-instrument
key clash to Ed** (spec §3 resolution rule) - do not retune a shipped sample.
(2) **Source/synthesize** trumpet, bass and piano root one-shots the same
route as the current kit's sounds, pitched at each instrument's mid-range
anchor in C major. (3) Choose each instrument's register by ear (kid-comfy,
ensemble-consonant at 100-200bpm) and record it in the manifest `pitched`
config. Deliver a way for Ed to hear the result (the dev app with a temporary
local flag is fine - nothing ships flagged).

Decisions this implements: R2-2 (anchor = current sample), R2-4 (C major,
registers by ear, Ed ear-checks), research §5 (mid-range root, ±6st max).

Acceptance criteria:

- [ ] Marimba/boop sample pitches measured and written down in this ticket's
      comments; C-major compatibility confirmed or escalated.
- [ ] Three new root samples in `public/kits/launch/sounds/`, loudness-normal
      against the kit (kitLevels-style measurement, before ticket 09's chord
      re-pin).
- [ ] Registers recorded in the manifest config (values inert until
      ticket 10 flips `pitched` on).
- [ ] Repitch quality across the full octave spot-checked at both ends for
      all five (offline render or dev listen); anything gnarly noted for the
      ear check.
- [ ] Ed's ear check requested with concrete listening steps (this ticket
      flips to ready-for-human at that point).

## Comments
