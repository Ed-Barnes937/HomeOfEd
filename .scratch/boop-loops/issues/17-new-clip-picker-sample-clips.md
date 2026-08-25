# 17 — The "+ New clip" picker and sample clips

**What to build:** Tapping "+ New clip" opens a picker dialog instead of
creating a blank directly: the New boop paper-card shell, starter-style cards
(thumbnail + name) in a grid, **Blank first**, then the eight sample clips.
No per-card preview — picking is how you hear one. Picking lands the choice
as a new clip: named after its plain label (Blank gets the automatic
"Clip N"), lowest unused tint, put on the grid, **not** placed in the song.
A sample clip's name is renameable like any other; it is pattern-only and
plays at the boop's bpm.

The launch roster is the eight sample clips authored on the
`prototype/12-new-clip-picker` branch (`sampleClipsProto.ts`), lifted
verbatim (steps 1-based): Slow bass (kick 1·9), Bouncy bass (kick 1·4·9·12),
Tap tap hat (hat eighths), Sneaky hat (hat off-beats), Boom clap (kick 1·9 +
snare 5·13), Tumble toms (tom 7·8·15·16), Twinkle tune (marimba 1·4·7·11·13 +
boop 15), Boop boop (boop 5·6·13·14).

With this, the **starters are retired**: the old starter data and the New
boop dialog are deleted (New boop is already a plain reset from ticket 15).
The **first-visit seed** becomes a one-clip song whose clip is a sample clip —
it still sounds like something and demos the model. Sample clips get no
identity in the saved-state model: adding one is an edit like any other clip
add.

Spec: §6 (picker and sample clips), §7 (first visit), §14 (the dialog follows
the existing dialog focus/dismiss behaviour).

**Blocked by:** 15 — Laptop clip lanes.

**Status:** ready-for-human

- [x] "+ New clip" opens the picker dialog (Blank first, then the eight sample clips); it stays disabled at the 5-clip cap
- [x] Picking Blank or a sample clip creates the clip per the rules above and closes the dialog; nothing is placed in the song. Landing a sample clip also starts clip playback — "picking is how you hear one", the prototype's resolved behaviour, now stated in spec §6
- [x] All eight roster patterns match the prototype data (unit-tested step for step in `sampleClips.test.ts`)
- [x] Starters and the old New boop dialog are gone; no dead code from the retirement remains (`features/presets/` deleted, `--shadow-preset-active` removed; the tablet/phone "New boop" button is now the plain reset)
- [x] A fresh browser is seeded with a one-clip song built from a sample clip (Boom clap — the roster's fullest single layer — at the default speed)
- [x] Dialog focus/dismiss matches the existing dialog behaviour (× + backdrop, as `BoopsPanel`); covered by `newClipPicker.iwft.tsx` and `firstVisit.iwft.tsx`
