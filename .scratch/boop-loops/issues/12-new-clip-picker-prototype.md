# "+ New clip" picker prototype

Type: prototype
Status: closed
Assignee: ed-barnes937
Blocked by: 07

## Question

Prototype the layering journey decided in
[Starters and New boop vs clips](07-starters-and-new-boop.md): tap
"+ New clip" → a picker opens (Blank first, then the sample clips) → a
sample clip lands as a new clip, named after its plain label, playing at
the boop's one bpm → the child layers it via placements.

Also author the launch roster of sample clips *here*, where they can be
heard and layered: a handful of single-role, layerable patterns with plain
labels ("Slow bass", "Tap tap hat" — that sort of thing). Sized for
layering, not all-in-one starters.

The picker reuses the starter-card visual language from the New boop
dialog (thumbnails, names). At the 5-clip cap "+ New clip" is disabled
(ticket 01), so the picker is unreachable when full.

## Comments

**2026-08-13 — prototype built, awaiting Ed's reaction.** The full journey runs
on the real engine (laptop only, dev builds only): `pnpm dev --filter=boop`,
then flip picker variants with the floating pink pill or `?variant=` —

- **a — dialog**: the New boop paper card, a 3-column grid of starter-style
  cards (Blank first).
- **b — shelf**: the "+ New clip" row expands in place inside the song bar —
  no modal, cards in a sideways strip.
- **c — popover**: a compact list anchored on the "+ New clip" button.

Picking a sample clip lands it as a new lane (named after its label, lowest
unused tint), puts it on the grid, and starts it playing at the boop's bpm;
Blank lands silent. Placements paint on the lanes and the Song button plays
them gapless via ticket 03's conductor — so candidates can be heard *in a
song*, not just solo.

**Candidate roster** (authored in
`apps/boop/src/features/pickerproto/sampleClipsProto.ts`, deliberately
over-provisioned — the launch roster is a cull of these eight): Slow bass,
Bouncy bass, Tap tap hat, Sneaky hat, Boom clap, Tumble toms, Twinkle tune,
Boop boop. All single-role except **Boom clap** and **Twinkle tune**, which
carry a light second row on purpose — a comparison point for the key
question: *does a strictly one-row clip sound too thin when a whole song
position is just it?*

Prototype-only affordances, not proposals: the yellow ▶ on each card
(ear-only audition — whether a preview ships is a spec call) and the dashed ×
on each chip (delete, so culling never jams on the 5-clip cap).

To judge: (1) which picker shape, (2) which candidates make the launch
roster (and whether single-role holds up in sequence), (3) whether the
card preview earns a place in the spec.

Code: `apps/boop/src/features/pickerproto/` + small mounts in
`HomePage.tsx`, currently uncommitted on the working tree; moves to a
`prototype/12-…` branch at resolution. All 82 boop tests still pass.

## Resolution

**2026-08-13 — Ed decided all three questions.**

- **Picker shape: the dialog (variant a).** The New boop paper card shell,
  starter-style cards in a grid, Blank first. The popover was liked but the
  dialog wins because the same shape works on mobile.
- **Roster: all eight sample clips ship.** Slow bass (kick 1·9), Bouncy bass
  (kick 1·4·9·12), Tap tap hat (hat eighths), Sneaky hat (hat off-beats),
  Boom clap (kick 1·9 + snare 5·13), Tumble toms (tom 7·8·15·16), Twinkle
  tune (marimba 1·4·7·11·13 + boop 15), Boop boop (boop 5·6·13·14). The
  mixed roster stands as authored — mostly single-role, with Boom clap and
  Twinkle tune carrying a light second row. Data lives in the prototype's
  `sampleClipsProto.ts`, to be lifted verbatim into the real feature.
- **No preview affordance.** The per-card ▶ audition was review scaffolding
  only; the real picker's cards just have thumbnail + name, exactly the
  starter-card language. Picking is the way you hear a sample clip.

Prototype (all three variants + the audition/delete scaffolding, the
primary source): branch `prototype/12-new-clip-picker` —
`apps/boop/src/features/pickerproto/` mounted from `HomePage.tsx`.
