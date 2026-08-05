# boop — design brief (V1)

Status: ready-for-human
Produced by: [wayfinder map](map.md), ticket [08](issues/08-design-brief.md), 2026-08-05.
Companion to the [product spec](spec.md), which defines *what* exists. This
brief describes it for visual design — paste it into a design tool as-is.

## The product in one paragraph

**boop** is a music toy for kids aged 6 and up: a 6-instrument × 16-step drum
grid that loops forever. You tap or drag to paint beats, hear every edit
instantly, and share your groove as a link. There are no scores, levels,
timers, or fail states — nothing can sound bad, and nothing interrupts play.
It runs in the browser at `boop.homeofed.com`. Mobile-first design; **tablet
and laptop are the expected real screens**, with small phones a supported
fallback.

## Tone & personality

- **Playful, warm, and confident — not babyish.** The audience reads (that's
  the licence to use words at all), but words are used sparingly and are
  always real musical vocabulary: "Tempo", real instrument names. Never
  jargon ("BPM" appears only as a small numeric readout, never as a label).
- **Toy, not tool.** The reference feeling is Toca Boca / Yatatoy ("no
  failing, no goal, no wrong or right") with slightly older, cheekier energy.
  The app is named after a synth "boop" sound — the brand can be that silly.
- **Nothing flashes.** Feedback is motion — bounce, squash, ripple — never
  strobe or full-screen flash.
- Everything reachable by touch; no typing on any critical path.

## The single main screen

boop is essentially one screen. Regions, in priority order:

### 1. The grid (the hero — most of the screen)

- **6 instrument rows × 16 step columns. Always.** The grid never shrinks or
  drops rows/columns at any screen size (see Layout below for the small-phone
  question).
- Steps are **visually grouped in 4s** — a wider gutter or alternating shade
  every 4 columns, so bar structure is absorbed by looking and a child keeps
  their place mid-row.
- **Each row is fronted by its instrument: artwork + real name** (e.g.
  "Kick", "Snare"). The same artwork asset **is the note mark** inside an
  active cell — a filled cell looks like a small version of its row's
  character, not an abstract dot. (This is the survey's strongest labelling
  pattern — CML Rhythm.) Never emojis, never abstract icons.
- **Playhead:** a moving column highlight while playing. When the playhead
  crosses an active cell, that cell reacts with motion (see Motion).
- Empty cells must still read as *invitations* — visibly tappable, not dead
  space.

### 2. Transport & tempo (one compact bar)

- **One play/pause button.** It's the only transport control — loop is
  unconditional, there is no stop/restart/record. Make it the most inviting
  single control on screen.
- **Tempo slider**, labelled **"Tempo"**, with **"Slow"** and **"Fast"** word
  endpoints and a small live BPM number beside the label (not on the thumb).
  Logarithmic feel — the slow end has room. Range ~60–200.
- **Clear-all** control with a confirm step. Visually distinct from
  play/pause so it can never be mistaken for "play from the top".

### 3. Starter-groove preset row

- A visible row of **3–4 named preset grooves, with the blank canvas as the
  first item** in the row (Groove Pizza's pattern). The app opens on the
  empty grid with this row visible — nobody meets an unexplained void, and
  blank stays one tap away.
- Each preset should preview its pattern visually (a tiny thumbnail of the
  grid shape) as well as carry a playful name. Loading one drops it in the
  grid ready to play and tweak — "now make it yours" is implicit, never
  stated.

### 4. Save, share, help (quiet corners)

- **"My grooves":** a save action that snapshots the grid under a prefilled
  playful generated name ("Groove 3") — typing optional, rename available.
  Opens a simple named list: tap to load, delete behind a confirm. No cap.
- **Share:** one action. On mobile it opens the system share sheet; on
  desktop it copies a link and the button label flips to "Copied!" for a
  moment. No modal, no "copy this text" field. A demoted secondary action
  underneath offers audio (WAV) export.
- **"?"** opens a single static hint sheet — one screen, few words, mostly
  pictures. No tours, no coach marks, no tooltips machinery.

## The six instruments

The launch kit is a **playful hybrid**, six voices — each needs a name and a
character/artwork that works at both row-label size and in-cell note-mark
size:

1. **Kick** — the heartbeat, low and round
2. **Snare / clap** — the backbeat
3. **Hi-hat** — light, ticking
4. **Low perc / tom** — warm thump
5. **Marimba hit** — pitched, woody, melodic
6. **Synth "boop"** — the brand's namesake; electronic, cheeky

Rows 1–4 are the rhythm section; 5–6 make patterns sound like music. The
artwork set is the core of the visual identity — six characters or objects
with shared DNA, distinguishable at ~24px, delightful at 64px.

## Interactions (fixed by spec — design around them)

- **Latched drag-paint:** pointer-down on a cell decides add-or-remove from
  that cell's state; the whole drag repeats that decision; tracked per
  pointer so two fingers can paint independently.
- **Audible edits while stopped:** toggling a cell on plays its sound
  immediately. The grid is explorable without ever pressing play.
- **Spacebar toggles play** (desktop).
- Keyboard on the grid: arrows move, Enter/Backspace toggle/remove — with
  visible focus rings on keyboard use.
- Pinch-zoom on the page keeps working; only the grid itself suppresses
  scroll-while-painting.

## Layout

- **Mobile-first, three real targets:** small phone (~360–430px), tablet
  (~768–1180px, the primary), laptop (1280px+).
- **Tablet/laptop:** the full 6×16 grid fits comfortably; landscape is the
  natural orientation. Grid takes the majority of the viewport; transport
  and preset row never crowd it.
- **Small phone — the one hard layout problem, designer's call:** the grid
  is always 6×16 (never silently shrinks — the field's worst trap), so pick
  a treatment: horizontal scroll/swipe with the 4-step groups as snap
  anchors, a paged two-screens-of-8 view, or another answer. Whichever wins,
  the child must always know where the playhead is, even off-screen.
- **Touch targets:** kid-sized throughout — designer to set exact sizes, but
  every interactive element comfortably over the 44px floor, and grid cells
  as generous as the layout allows.

## Motion design (designer's call, bounded)

- Step-hit feedback: when the playhead strikes an active cell, that cell
  (and/or its row character) reacts — squash-and-stretch, a bounce, a small
  ripple. Springy and physical, never a flash of light.
- Play/pause, preset loading, and "Copied!" all deserve small moments of
  delight. Everything else stays calm — the groove is the show.
- **Hard rule: no strobing, no full-screen flashes** (photosensitivity —
  Patatap publishes a warning for exactly this; boop must never need one).

## Deliverables wanted from design

1. Visual identity: palette, type, overall art direction.
2. The six instrument characters/artworks (row-label + note-mark sizes).
3. Main screen layouts at phone / tablet / laptop, including the chosen
   small-phone grid treatment.
4. Preset-row presentation (blank-first, thumbnails, names).
5. "My grooves" list and the save/rename/delete/confirm moments.
6. Hint-sheet content (one screen, picture-led).
7. Motion specs for playhead, step hits, and the share "Copied!" moment.

## Reference points (from the prior-art survey)

- **CML Rhythm** — artwork-as-note-glyph, characters bobbing to the beat.
- **Groove Pizza** — blank-as-first-preset, pattern thumbnails, per-kit
  colour identity that tints the whole page.
- **ToneMatrix** — restraint: ripple feedback, 12 words of copy total.
- **Toca Boca / Yatatoy (Bandimal)** — the no-fail, no-text-pressure tone.
- **Chrome Music Lab Song Maker** — what to avoid: sterile grid, unlabeled
  controls, a "Restart" that destroys work.

Full survey: [prior-art ticket](issues/10-prior-art-research.md), findings on
branch `research/prior-art`.
