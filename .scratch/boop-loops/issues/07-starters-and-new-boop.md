# Starters and New boop vs clips

Type: grilling
Status: resolved
Blocked by: 01

## Question

Starters (Blank, Wonky Walk, Robot Hiccup, Sunday Stomp) are single 6×16
patterns; "New boop" now lives in the top bar and the handoff's "+ New clip"
drops the child on a blank grid. Decide how the two compose:

- Loading a starter: replace the whole song (one-clip song), or just the
  active clip on the grid?
- What does "New boop" reset to — one blank clip, no placements?
- Is the first-visit seed (Wonky Walk) now a one-clip song?
- Does the New boop dialog need any song-awareness, or does it stay exactly
  as ticket 36 built it?

## Answer

**Starters are retired, replaced by sample clips.** Clips layer up like a
loop pedal, so pre-made content moves from "a thing you load over
everything" to "a thing you add as a layer".

- **Sample clip** (always two words — bare "sample" stays an audio one-shot):
  a pre-made, pattern-only clip offered when adding a new clip. No tempo —
  it plays at the boop's one bpm.
- **"+ New clip" becomes a picker**: Blank first, then the sample clips. A
  deliberate exception to "no new controls beyond the handoff" — the map's
  Notes are amended. The picker reuses the starter-card visual language
  (thumbnails, names).
- **Roster**: a handful of single-role, layerable patterns with plain labels
  ("Slow bass", "Tap tap hat" — that sort of thing). The old starter patterns
  do not survive verbatim; content is authored fresh, sized for layering,
  during the prototype ([12](12-new-clip-picker-prototype.md)). Pure data,
  additive forever.
- **A sample clip keeps its plain label as the clip's name** (renameable as
  ever — it is just ADR 0032's optional `name` field).
- **"New boop" becomes a plain button** — no dialog, resets the working slot
  to a one-blank-clip song at default tempo, drops the loaded boop, no
  confirm. Most of ticket 36's dialog is deleted.
- **Clear grid is clip-scoped** — clears only the grid clip; it is an edit
  (marks edited, per ticket 08's one definition) and no longer drops the
  loaded boop.
- **First visit seeds a one-clip song** whose clip is a sample clip, so it
  still sounds like something and demos the model.
