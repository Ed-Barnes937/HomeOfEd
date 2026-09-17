# 10 - Activation: five pitched instruments go live

**Status:** ready-for-agent (merge gated ready-for-human: ear check + art eye)
**Blocked by:** 02, 04, 05, 06, 07, 08, 09

**What to build:** The switch-flip. `kit.json` gains trumpet, bass and piano
(group `notes`, ticket 05 artwork, ticket 04 sounds and registers) and flags
them plus marimba and boop as `pitched`. The instrument picker's Notes group
now offers five pitched sounds; audition in the picker plays the anchor
pitch. Conversion acceptance is the heart of the ticket: existing saved boops
and share links using marimba/boop must sound **byte-identical** (anchor =
current sample, spec §3) and display their old hits at "so", mid-lane.

Decisions this implements: R2-1 roster, R2-2 conversion rule, grill Q3.

Acceptance criteria:

- [ ] A pre-epic save-document fixture (built from today's `saveFormat`
      output with marimba/boop rows) loads with every old hit at the anchor
      pitch; an offline render of that boop is sample-identical (or
      measured-identical) to the pre-epic render.
- [ ] Old share links round-trip the same way.
- [ ] Fresh-grid defaults, sample clips and the first-visit seed still make
      sense (default rows unchanged unless deliberately revisited - if
      revisited, that is a decision to note here for Ed).
- [ ] Picker: five pitched instruments appear in Notes with artwork; adding
      one to a clip renders the lane; audition sounds the anchor.
- [ ] Ear check (ticket 04's gate) and art eye check (ticket 05's gate)
      both passed by Ed - this PR does not merge before both.
- [ ] Full verify loop plus a play-check script for Ed (what to tap, what to
      listen for), per the house merge ritual.

## Comments
