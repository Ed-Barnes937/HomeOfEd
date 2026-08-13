# Handoff: Clip lanes (loops for boop)

## Overview
Adds a **loops** feature to boop. The existing 4-bar / 6×16 grid stays exactly as it is, but it is now always editing one **clip**. Clips are arranged into a **song** on a lane grid pinned below the grid well: each clip owns a lane, each column is a position in the song, and a filled square means "play this clip here". Repeats need no new control — the same square placed twice plays twice.

Design id in the source file: **2a Clip lanes** (`data-screen-label="2a Clip lanes polished"`). Turn-1 explorations `1a`, `1b`, `1c` are also in the file for context; only 2a is being handed off.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behaviour, not production code to copy. The boop app is React + TypeScript + CSS Modules (SCSS); implement this by recreating the design inside that existing environment, following its established patterns (feature folders under `apps/boop/src/features/`, one `*.module.scss` per component, tokens from `src/styles/tokens.scss`). Do not port the prototype's inline styles.

## Fidelity
**High-fidelity.** Every geometry number below was lifted from the app's own SCSS (`tokens.scss`, `Grid.module.scss`, `Transport.module.scss`, `TopBar.module.scss`, `HomePage.module.scss`) so the new chrome sits on the existing grid. Recreate pixel-perfectly at the laptop breakpoint (≥1280px). The tablet (≤1279px) and phone (≤1023px) layouts are **not designed yet** — see "Open questions".

## Screens / Views

### Main screen — laptop
Purpose: paint a 4-bar clip on the grid, arrange clips into a song, play either.

Frame is unchanged from today: `height: 100dvh` flex column, `--stage` background, `padding-inline: 36px` per section, inner column `max-width: var(--column-width)` (1356px) centred.

Stack, top to bottom:

1. **Top bar** — unchanged (58px) except one addition: a **New boop** ghost button moved here, before "My boops". Order is now: back arrow, `boop` wordmark, saved-state text, spacer, New boop, My boops, Share, `?`. New boop uses the existing `.ghost` treatment (`padding: 11px 18px`, `1px solid rgba(242,239,230,.2)`, radius `--r-control` 9px, 700 14px Chivo, `rgba(242,239,230,.8)`).

2. **Clip header row** — new. Inside the scrolling region, above the grid well. `margin-top: 14px`, flex row, `align-items: center`, `gap: 12px`.
   - `You're changing` — 700 13px Chivo, `rgba(242,239,230,.45)`.
   - Clip tint dot — 14px circle, background = that clip's tint.
   - Clip name — 800 17px Chivo, `letter-spacing: -0.015em`, `--ink`, followed by a **rename button**: 32px circle, `1px solid rgba(242,239,230,.2)`, transparent fill, 15px pencil icon at `rgba(242,239,230,.7)` (2.2 stroke, round caps), 8px gap after the name. Both the button and the name itself open rename; the button is there so the affordance is visible rather than discovered. It is hidden while editing. Rename swaps the name for a text input (`padding: 5px 9px`, `1px solid var(--cyan)`, radius 8px, background `--well`, 800 16px Chivo). Enter or blur commits.
   - Spacer, then **Make a copy** (ghost, `padding: 9px 14px`, 700 13px) and **Delete clip** (dashed coral: `1px dashed rgba(255,138,122,.55)`, radius 9px, `--danger` text). Delete is disabled/no-op at one clip remaining.

3. **Grid well** — unchanged geometry (`padding: 18px`, radius 24px, `--well`), with one addition: an inner tint ring, `inset 0 0 0 2px <clipTint>40` alongside the existing `inset 0 1px 0 rgba(255,255,255,.05)`. `margin-top: 12px` (was 16px) to absorb the new header row. Bar numerals, rail (160px), 6 rows of 16 cells (62×66, radius 14, 8px within a bar, 18px between bars, 10px between rows), the playhead column and all hit motion are exactly as they are today.

4. **Clip control** — new, and it lives **inside** the grid well, below the rows: `margin-top: 16px`, height 72px, `padding: 0 18px`, radius 16px, `background: rgba(255,255,255,.05)`, flex row, `gap: 16px`.
   - Play button — 56px yellow circle (`--play`, `box-shadow: 0 4px 0 #c79a17, 0 10px 22px rgba(0,0,0,.35)`), same triangle/pause glyph as the current transport at 56px scale.
   - Label stack — `Play this clip` / `Stop` (800 15px Chivo) over `Just these 4 bars, round and round` (400 13px, `rgba(242,239,230,.45)`).
   - Spacer, then **Clear grid** — the existing dashed coral button, unchanged. It clears the current clip only.

5. **Song bar** — new, pinned (a `flex: none` sibling of the scroller, same pattern as the transport dock). `margin-top: 14px`, `padding: 0 18px 14px`, radius 20px, `background: rgba(255,255,255,.045)`, flex column.
   - **Header row** — height 64px, flex row, `gap: 14px`, `border-bottom: 1px solid rgba(255,255,255,.07)`.
     - `Your boop` — 900 17px Chivo, `letter-spacing: -0.02em`.
     - Song length — 600 13px Chivo Mono, `rgba(242,239,230,.4)`, format `<n> bars` (placed squares × 4).
     - Spacer.
     - `Speed` — 800 15px Chivo. Readout — 600 13px Chivo Mono, `rgba(242,239,230,.5)`, fixed 64px width so the row does not jitter, format `<n> BPM`.
     - `Slow` / `Fast` endpoints — 600 13px Chivo, `rgba(242,239,230,.5)`.
     - Slider — 280×10px track, radius 5, `rgba(255,255,255,.11)`; fill `rgba(242,239,230,.4)`; thumb 30px circle `--ink` with `--shadow-slider-thumb`. Same visual as today's tempo slider, moved here.
   - **Body row** — `padding-top: 14px`, flex row, `align-items: flex-start`, `gap: 18px`.
     - **Song play column** — `padding-top: 24px`, centred column, `gap: 7px`: a 56px circle in `--cyan` (`box-shadow: 0 4px 0 rgba(0,0,0,.28), 0 10px 22px rgba(0,0,0,.3)`), dark triangle glyph; when playing it flips to `--ink` fill with a pause glyph. Label below: `Song` / `Stop`, 800 12px Chivo, `rgba(242,239,230,.6)`.
     - 1px vertical divider, `rgba(255,255,255,.1)`, stretched.
     - **Lane grid** — column, `gap: 8px`, `overflow-x: auto`.
       - Ruler row: 184px left inset (176px chip + 8px gap), then one 56px-wide numeral per position, centred, 700 12px Chivo Mono. `rgba(242,239,230,.3)`, or `--cyan` for the position currently playing.
       - One row per clip, `gap: 8px`:
         - Clip chip — 176×46, `padding: 0 14px`, radius 12, `rgba(255,255,255,.05)` (`.11` when it is the clip on the grid, plus `inset 0 0 0 2px var(--cyan)`). Contents: 12px tint dot, name (800 14px Chivo, truncating), and a `×<n>` count in the clip tint (800 12px Chivo Mono) showing how many times it appears in the song. Tapping the chip puts that clip on the grid.
         - 16 square slots — 56×46, radius 11. Empty: `rgba(255,255,255,.045)`, `inset 0 1px 0 rgba(255,255,255,.07)`. Filled: clip tint, `0 2px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.3)`. Currently playing: `transform: scale(1.06)` with `0 0 0 3px rgba(255,255,255,.65), 0 8px 16px rgba(0,0,0,.45)` — the same "under the playhead" language the grid cells use. Next free square on the active clip's lane: `2px dashed <clipTint>80` over the empty fill.
       - **+ New clip** row — 176×46 dashed button (`2px dashed rgba(242,239,230,.22)`, radius 12, 800 14px Chivo, `rgba(242,239,230,.5)`), with the hint `Starts you on an empty grid` beside it (400 13px, `rgba(242,239,230,.3)`).

6. **Bottom gutter** — 32px, as today. The old transport bar is gone: its play button became the clip control, its tempo became Speed in the song bar, New boop went to the top bar, Clear grid went into the clip control.

Clip tints cycle: `#6fe0f0`, `#6fe0a8`, `#b78bff`, `#ffb03a`, `#ff7fb0`.

## Interactions & Behavior

- **Tap a clip chip** → the grid becomes that clip immediately. No save step, no confirm. Every grid edit writes straight into the clip that is on screen.
- **Tap/drag lane squares** → press-and-drag paints placements exactly like grid cells: pointerdown decides place-or-remove from that square's current state, and pointerenter repeats that decision across the drag. One clip per position — placing in a column that already holds another clip replaces it.
- **Repeats** are just the same clip in two columns. There is no repeat counter.
- **Play this clip** (yellow) loops the 4 bars of the clip on the grid. The grid playhead sweeps as it does today.
- **Song** (cyan) plays the placements left to right, looping the whole song. As each position starts, the grid switches to that clip and the lane square gets the playing ring — so the child can watch the song move through the lanes. Tapping a chip while the song plays stops the song (you are now editing, not listening). Only one of the two can play at a time.
- **Speed** drags 60–180 BPM, drives both playback modes, and is a property of the whole boop (persisted with the song, not per clip). Step duration is `15000 / bpm` ms for a 16th.
- **+ New clip** appends an empty clip, selects it, and drops the child on a blank grid. It does not place it in the song — that is a separate tap.
- **Make a copy** duplicates the current clip's pattern into a new clip and selects it.
- **Delete clip** removes the clip and any placements of it; later clips shift down.
- **Rename**: names are automatic (`Clip 1`, `Clip 2`, …). The pencil button beside the name in the clip header opens an inline input, as does tapping the name. Enter or blur commits; Escape-free by design. No naming prompt is ever forced — a child who never renames anything still has a working song.
- Motion: the existing cell squash (320ms), edit pop (140ms), row bob (180ms) and load stagger are unchanged. The playing lane square uses the same hard-cut timing as the grid playhead — no transition on position.

## State Management

```
Song {
  bpm: number            // 60–180, whole song
  clips: Clip[]          // ordered; index is identity within a song
  activeClipIndex: number
  placements: (number | null)[]   // one entry per song position; clip index or empty
}
Clip { name: string; steps: boolean[6][16] }
```

Transient UI state: `play: { mode: 'clip' | 'song', step: 0–15, pos } | null`, `editingName: boolean`, `paintMode: 'place' | 'remove' | null`.

Derived: song sequence = `placements.filter(p => p !== null)`; song length in bars = that length × 4; per-clip count for the `×n` chip.

Notes for implementation: the sequencer engine already owns a 16-step pattern and a draw-time playhead channel — song mode is that engine restarted with the next clip's pattern at each 16-step wrap, so the existing `usePlayheadMotion` / strike-epoch plumbing carries over unchanged. Placement paint should reuse `useDragPaint`. Persistence: extend the save format so a boop holds an array of patterns plus the placement list and bpm; a single-clip boop must still round-trip as it does today (see ADR 0025).

## Design Tokens
All existing, from `src/styles/tokens.scss` — no new tokens are strictly required:
`--stage #14262a`, `--well #0e1f23`, `--ink #f2efe6`, `--ink-dark #14262a`, `--cyan #6fe0f0`, `--cyan-solid #0b7c91`, `--play #ffd24a`, `--play-shadow #c79a17`, `--danger #ff8a7a`; instrument hues `#ff6b5c #ffb03a #dce85c #ff7fb0 #6fe0a8 #b78bff`; radii `--r-frame 22 / --r-well 24 / --r-transport 20 / --r-cell 14 / --r-plate 16 / --r-control 9`; `--column-width 1356px`; shadows `--shadow-play`, `--shadow-slider-thumb`, `--shadow-cell-active`, `--shadow-cell-playhead`, `--shadow-preset-active`.

New values introduced by this design, worth adding as tokens if you prefer: lane square `56×46 / radius 11`, clip chip `176×46 / radius 12`, song-bar radius 20, clip-control height 72 / radius 16, clip-tint ring alpha `40` (25%), clip tint list above.

Type: Chivo (display, 300–900) and Chivo Mono, self-hosted, as today.

## Assets
None new. The prototype uses the repo's own launch-kit artwork (`public/kits/launch/artwork/*.svg`, applied as CSS masks) and the self-hosted Chivo woff2 files. Copies are included in this bundle only so the HTML renders offline.

## Files
- `Boop loops.dc.html` — the prototype. Open it in a browser. The handoff design is the **2a Clip lanes** frame at the top; `1a`/`1b`/`1c` below it are the earlier explorations (clip shelf, song ribbon, first lane sketch) and are context only.
- `support.js` — runtime for the prototype file. Not part of the design.
- `apps/boop/public/…` — fonts and kit artwork, at the paths the prototype expects.

Source read while building, for reference: `apps/boop/src/styles/tokens.scss`, `src/pages/HomePage.module.scss`, `src/features/grid/Grid.tsx` + `Grid.module.scss`, `src/features/transport/Transport.module.scss`, `src/features/topbar/TopBar.tsx` + `TopBar.module.scss`, `public/kits/launch/kit.json`.

## Open questions
- Tablet (≤1279px) and phone (≤1023px) lane layouts are undesigned. The phone build uses `PhoneGrid`; the lane grid will need its own treatment there.
- Song length is currently a fixed 16 positions in the prototype. Decide whether positions grow on demand.
- Reordering clips (lane order) and dragging a placement sideways are not designed.
- Accessibility: lane squares need labels (`Clip 2, position 5, on`) and keyboard placement; the grid's existing arrow-key model is the obvious pattern to extend.
