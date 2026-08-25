# Handoff: boop — main screen, identity, and the quiet corners

## Overview

**boop** is a music toy for children aged 6+: a 6-instrument × 16-step drum grid
that loops forever. You tap or drag to paint beats, hear every edit instantly,
and share your boop as a link. No scores, levels, timers, or fail states.
It runs in the browser at `boop.homeofed.com`. Mobile-first; tablet and laptop
are the expected real screens, small phones a supported fallback.

This bundle covers the V1 design brief's deliverables 1–5 and 7: visual
identity, the six instrument voices, main-screen layouts at phone / tablet /
laptop (including the chosen small-phone grid treatment), the preset row, the
"My boops" list with its save / rename / delete / confirm moments, and the
motion spec.

**Not covered — still to design:** the "?" hint-sheet content (deliverable 6)
and the keyboard focus-ring states.

## About the design files

The files in this bundle are **design references created in HTML** — a
prototype showing the intended look and behaviour. They are **not production
code to copy directly.**

The task is to **recreate these designs inside the HomeOfEd monorepo's existing
environment**: a React SPA with TanStack Router + TanStack Query, SCSS modules,
and a `src/styles/tokens.scss` global side-effect stylesheet per app — exactly
the shape `apps/fridge` already has. Create `apps/boop` by copying
`templates/starter` per `docs/how-to/adding-an-app.md`. boop needs no database
for the grid itself (see ADR 0008, apps without a database); sharing a boop
by link will need a store, following the fridge's `board.share` pattern in
`apps/fridge/src/server/handlers/shareBoardHandler.ts`.

Do not port the inline styles from the reference HTML. Translate the values in
**Design tokens** below into `apps/boop/src/styles/tokens.scss` and SCSS
modules, matching the fridge's file organisation.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, shadows and grid
geometry are final and exact — every number in this document is measured from
the reference file, not approximated. Recreate the UI pixel-perfectly.

One exception, called out in full under **Assets**: the six instrument artworks
are open-licensed placeholders, not final art.

---

## Screens / views

### 1. Main screen — laptop (1440 × 900)

**Purpose.** The whole app. Paint beats, play, adjust tempo, load a starter,
save/share.

**Layout.** A single fixed-height column, no page scroll. Frame padding
`0 36px 32px`. Vertical stack, in order:

| Region | Height | Notes |
|---|---|---|
| Top bar | 58px | flex row, `align-items:center`, `gap:14px` |
| Grid well | auto (522px) | `margin-top:16px`, `padding:18px`, radius 24px, `background:#0E1F23`, `box-shadow: inset 0 1px 0 rgba(255,255,255,.05)` |
| Preset row | auto | `margin-top:16px`, flex row, `gap:14px` — **removed by ticket 36**; see "Preset row" below |
| Transport bar | 84px | `margin-top:16px`, radius 20px, `background:rgba(255,255,255,.045)`, `padding:0 22px`, `gap:26px` |

> **Amended by ticket 33 (V1.1 feedback).** "No page scroll" is now *enforced*
> rather than intended, and the stack order above has changed: the **transport
> is last, pinned to the bottom of the frame**, with the preset row moved above
> it. The build only ever set `min-height:100dvh`, so on a short window the
> whole column scrolled and the play button went with it.
>
> The frame is three sections — pinned top bar, a scrolling middle, pinned
> transport — as a `height:100dvh` flex column: the middle is
> `flex:1; min-height:0; overflow-y:auto` and the two bars are `flex:none`.
> **The grid well is the only scrolling region.** The transport is *inset to the
> 1356px column*, keeping the rounded treatment above exactly, plus a drop
> shadow so it reads as sitting over the grid (a full-bleed bar was prototyped
> and rejected — ticket 37). The `32px` bottom frame padding now belongs to the
> transport's own container.
>
> Accepted cost: on a tall window the grid is short and the bar is pinned low,
> so an empty band sits between them. Do not stretch the grid to fill it.

**Top bar, left to right.**
- Back-to-hub arrow. 44 × 44 hit area, `margin-left:-10px` so the glyph optically
  aligns with the wordmark. 22 × 22 SVG, `stroke-width:2`, round caps/joins,
  `color: rgba(242,239,230,.55)`. Paths: `M19 12H5` and `m12 19-7-7 7-7`.
  This is the exact glyph from `apps/fridge/src/features/toolbar/MobileBar.tsx`
  — reuse it, do not redraw.
- Wordmark `boop`. Chivo 900, 31px, `letter-spacing:-.03em`, `#F2EFE6`.
- Spacer (`flex:1`).
- "My boops" — ghost button. `padding:11px 18px`, radius 9px,
  `border:1px solid rgba(242,239,230,.2)`, Chivo 700 14px,
  `color:rgba(242,239,230,.8)`.
- "Share" — primary button. `padding:11px 20px`, radius 9px,
  `background:#F2EFE6`, Chivo 800 14px, `color:#14262A`.
- "?" — 44 × 44 circle, `border:1px solid rgba(242,239,230,.2)`, Chivo 800 17px,
  `color:rgba(242,239,230,.8)`.

> **Amended by ticket 31 (V1.1 feedback).** A **saved/edited indicator** sits
> between the wordmark and the spacer: Chivo 600 13px (12px at ≤1279px),
> `color:rgba(242,239,230,.5)`, ellipsised rather than allowed to push the
> buttons about. It reads `Boop 3` while the grid still matches the saved boop
> it came from, `Boop 3 • edited` once it has diverged, and `Not saved yet`
> when the grid is not a row in "My boops" at all — a starter, a share link, a
> cleared grid. It is quiet chrome, not a status bar, and it never warns about
> losing work: the working grid is autosaved regardless (ADR 0025).

**Grid well.** Two parts: a bar-numeral row, then the grid body.

*Bar-numeral row* — `display:flex; gap:18px; margin-bottom:8px`, preceded by a
`160px` spacer matching the instrument rail. Four cells, each
`width: 4×cellW + 3×gap` (= 272px), containing "1" "2" "3" "4".
Chivo Mono 700 13px. The bar the playhead is currently in is
`rgba(242,239,230,.7)`; the other three are `rgba(242,239,230,.28)`.

*Grid body* — `position:relative`. Contains the playhead column (below) and a
`position:relative; z-index:1` column of 6 rows, `gap:10px`.

Each row is `display:flex; align-items:center; gap:18px`:
- **Instrument rail** — `width:160px; flex:none; display:flex;
  align-items:center; gap:12px`.
  - Artwork plate: 52 × 52, radius 16px, `background:rgba(255,255,255,.06)`,
    centred 40 × 40 artwork tinted to the row colour.
  - Name: Chivo 800 17px, `letter-spacing:-.015em`, `#F2EFE6`, `nowrap`.
- **Steps** — `display:flex; gap:18px` (the group gutter), holding four groups
  of four. Each group is `display:flex; gap:8px`.

**Cell geometry and state.** Cell 62 × 66, radius 14px
(`round(cellW × 0.22)` — see the `cellRadius` token).

| State | Style |
|---|---|
| Empty, even group (bars 1 & 3) | `background:rgba(255,255,255,.045)`; `box-shadow: inset 0 1px 0 rgba(255,255,255,.08)` |
| Empty, odd group (bars 2 & 4) | same, `background:rgba(255,255,255,.075)` |
| Empty, under playhead | same, `background:rgba(255,255,255,.14)` |
| Active | `background:` the row colour; `box-shadow: 0 2px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.38)`; centred 35 × 35 artwork at `rgba(0,0,0,.42)` |
| Active, under playhead | `transform:scale(1.11)`; `box-shadow: 0 0 0 3px rgba(255,255,255,.6), 0 8px 16px rgba(0,0,0,.45)` |

The alternating even/odd group tint plus the 18px group gutter (vs 8px inner
gap) is how bar structure is carried. Both are required — the brief calls this
out as the thing that lets a child keep their place mid-row.

**Playhead column.** Absolutely positioned inside the grid body, `z-index:0`
(behind the cells).
```
pad        = round(cellW × 0.09) + 3            → 8px at laptop
left       = rail + railGap
             + groupIndex × (4×cellW + 3×gap + gutter)
             + colIndex × (cellW + gap)
             − pad
width      = cellW + 2×pad
top/bottom = −pad
radius     = round(cellW × 0.3)                 → 19px at laptop
background = linear-gradient(180deg, rgba(111,224,240,.24), rgba(111,224,240,.07))
box-shadow = 0 0 0 1px rgba(111,224,240,.34)
```

**Transport bar.** One row: play button, tempo block, divider, clear.
- **Play/pause** — 62px circle, `background:#FFD24A`,
  `box-shadow: 0 4px 0 #C79A17, 0 10px 22px rgba(0,0,0,.35)`. Triangle drawn
  with borders: `border-left:21px solid #14262A`, `border-top/bottom:13px solid
  transparent`, `margin-left:6px`. Yellow is reserved for this control and
  nothing else in the app.
- **Tempo** — label "Tempo" Chivo 800 15px `#F2EFE6`; BPM readout Chivo Mono
  600 13px `rgba(242,239,230,.5)` beside it, never on the thumb.
  Below: "Slow" (34px wide) / track / "Fast" (30px, right-aligned), both
  Chivo 600 13px `rgba(242,239,230,.5)`, `gap:14px`.
  Track: 10px tall, radius 5px, `background:rgba(255,255,255,.11)`.
  Fill: `rgba(242,239,230,.4)`, width = the log percentage below.
  Thumb: 30px circle `#F2EFE6`, `box-shadow: 0 3px 8px rgba(0,0,0,.45)`,
  centred on the percentage.
- **Divider** — 1 × 44px, `rgba(255,255,255,.1)`.
- **Clear grid** — `padding:12px 18px`, radius 9px,
  `border:1px dashed rgba(255,138,122,.55)`, Chivo 700 14px, `color:#FF8A7A`.
  The dashed border and coral are deliberate: it must never be mistakable for
  "play from the top".

**Tempo scale.** Logarithmic, so the slow end has room:
```
percent = log(bpm / 60) / log(200 / 60) × 100
```
Range 60–200. Default **100 bpm**, which lands the thumb at 42%.

**Preset row.** A `160px` label column reading "Starters" (Chivo 700 13px,
`rgba(242,239,230,.45)`), then four cards, `gap:14px`.

Card: `width:168px`, `padding:12px`, radius 14px, column layout, `gap:12px`.
- Resting: `background:rgba(255,255,255,.045)`,
  `box-shadow: inset 0 0 0 1px rgba(255,255,255,.08)`; name
  `rgba(242,239,230,.72)`.
- Loaded/active: `background:rgba(255,255,255,.1)`,
  `box-shadow: inset 0 0 0 2px #6FE0F0`; name `#F2EFE6`.
- Name: Chivo 800 14px, `nowrap`.
- Thumbnail: a 16 × 6 dot matrix at 8px pitch, dot size `round(8 × 0.55)` = 4px,
  radius 1px. Dots for active steps take **that row's instrument colour**; empty
  steps are `rgba(255,255,255,.13)`, so the blank preset still shows the shape of
  the grid rather than nothing. (In the reference this is drawn with a long
  `box-shadow` list purely to keep the DOM small — in the real app render an
  SVG or a grid of divs.)

Card order is fixed: **Blank first**, then Wonky Walk, Robot Hiccup, Sunday
Stomp. Blank-first means nobody meets an unexplained void and blank stays one
tap away.

> **Amended by ticket 36 (V1.1 feedback).** **The preset row is no longer a
> main-screen region.** The four cards moved into a **"New boop" dialog**,
> opened from a button in the pinned transport bar; the "Starters" label
> column goes with the row, replaced by the dialog's own title. The layout
> table in §1 loses its "Preset row" line.
>
> The cards keep every number above — 168px / 146px / 118px wide, 12px
> padding, radius 14px, the dot matrix, the fixed order — but take **§4's
> paper palette**, because the dialog reuses §4's shell and §1's
> white-on-dark alphas are invisible on paper: resting
> `background:rgba(20,38,42,.04)`, loaded `background:rgba(11,124,145,.1)` with
> `box-shadow: inset 0 0 0 1.5px rgba(11,124,145,.5)`, name `#14262A`,
> thumbnail in §4's flat-ink tone rather than per-row instrument hues.
>
> The dialog is §4's overlay and paper card, sized to its content
> (`width: fit-content`) rather than §4's clamp, since the cards are fixed
> width and would otherwise leave a wide empty margin. Cards sit in **two
> fixed columns** — a wrapping row would pick 2, 3 or 4 across as the viewport
> moved and land the four cards 3 + 1.
>
> **"New boop" button.** Desktop/tablet: the top bar's ghost treatment
> (`padding:12px 18px`, radius 9px, `border:1px solid rgba(242,239,230,.2)`,
> Chivo 700 14px, `rgba(242,239,230,.8)`), right-aligned in the transport bar
> ahead of the divider and Clear grid — the two form one right-hand group.
> Phone: the same button as a **44 × 44 "+"** beside the tempo block, where
> Clear grid is absent (it lives in the "⋯" menu). The label would cost the
> slider ~80px of track at 360px.
>
> The loaded-card ring is **internal to the dialog**: the main screen never
> names a starter (ticket 31).

### 2. Main screen — tablet (1024 × 768 landscape)

The primary target. Identical structure, smaller numbers. Frame padding
`0 26px 26px`.

| | Laptop | Tablet |
|---|---|---|
| Top bar height | 58px | 54px |
| Wordmark | Chivo 900 31px | Chivo 900 26px |
| Grid well radius / padding | 24 / 18px | 20 / 16px |
| Cell | 62 × 66, radius 14 | 42 × 50, radius 9 |
| Inner gap / group gutter | 8 / 18 | 6 / 14 |
| Instrument rail / rail gap | 160 / 18 | 124 / 14 |
| Row gap | 10px | 8px |
| Artwork plate / artwork | 52 / 40 | 40 / 30 |
| Row label | Chivo 800 17px | Chivo 800 14px |
| In-cell artwork | 35px | 24px |
| Bar numerals | Chivo Mono 700 13px | Chivo Mono 700 10px |
| Playhead pad / radius | 8 / 19 | 7 / 13 |
| Transport height | 84px | 76px |
| Play button / triangle | 62px / 21px | 56px / 19px |
| Preset card | 168px, pitch 8, name 14px | 146px, pitch 7, name 13px |
| Buttons | 11px vertical padding, 14px text | 10px vertical padding, 13px text |
| "?" circle | 44px | 40px |

Total grid width = `rail + railGap + 16×cellW + 12×gap + 3×gutter`
→ 1320px at laptop, 924px at tablet. Both fit their frames with slack, so the
grid never needs to shrink.

### 3. Main screen — small phone (390 × 844)

**The one hard layout problem, and the answer.** The grid stays **6 × 16,
always** — it never silently drops rows or columns. The instrument rail is
pinned; the 16 step columns scroll horizontally inside a window, snapping to
the 4-step groups so a swipe always lands on a bar line and never half a bar.

Two frames are shown in the reference: **A** (bars 1–2 in view, playhead on
screen) and **B** (swiped to bars 3–4, playhead off screen behind you).

**Chrome — the 52px strip.** Ported from
`apps/fridge/src/features/toolbar/MobileBar.tsx` and `MobileBar.module.scss`:
`height:52px`, `padding:0 8px`, `gap:6px`,
`background:rgba(255,255,255,.05)`,
`border-bottom:1px solid rgba(255,255,255,.08)`.
Children: back arrow (44 × 44, radius 9), wordmark `boop` Chivo 900 20px
`flex:1`, save icon (44 × 44), overflow "⋯" (44 × 44). Every tap target ≥ 44px.

Use the fridge's exact glyphs:
- save — `M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z`
  plus `M17 21v-8H7v8M7 3v5h8`
- overflow — three `<circle r="2">` at cx 5 / 12 / 19, cy 12, `fill:currentColor`

**Content padding** 12px. **Grid well** radius 16px, `padding:10px`,
`overflow:hidden`.

> **Amended by ticket 31 (V1.1 feedback).** The **save icon carries a dot
> badge** — 8px, `top:9px; right:9px` inside its 44px button,
> `border:1.5px solid var(--cyan)`, filled cyan when the grid is not a row in
> "My boops" (or has drifted from one) and hollow when it is. The strip has no
> horizontal room for §1's words, and the save icon is the one spot in the
> phone chrome that already means "saving".

> **Amended by ticket 33 (V1.1 feedback).** The phone gets §1's fixed frame
> too: the **52px strip is pinned at the top and the transport at the bottom**,
> with the grid well (and the "whole loop" map under it) the only scrolling
> region between them. The phone is the screen most likely to need scrolling,
> and a play button that scrolls away is the same complaint, worse.
>
> The transport's container carries `padding-bottom: calc(12px +
> env(safe-area-inset-bottom))` so the bar clears the iOS home indicator — the
> bar is inset to the content column, not full-bleed, so clearance is the
> container's job.
>
> The **tempo block must be allowed to shrink**: `min-width:0` on the
> `<input type="range">` and on its track row, with the 11px endpoint labels at
> 28px / 24px. Without it the range keeps its intrinsic width and "Fast" runs
> into the New boop button — 7px clear at 390px, a 23px overlap at 360px
> (ticket 37).

**Phone grid geometry.**
```
cell            32 × 44, radius 7px
inner gap       5px      group gutter  11px
rail            92px     rail gap       8px
row gap         6px
artwork plate   32px     artwork       24px
row label       Chivo 800 11px
bar numerals    Chivo Mono 700 10px   (floored at 10px — do not derive smaller)
strip width     16×32 + 12×5 + 3×11 = 605px
window width    246px    → ~6.9 steps visible; the part-cut cell is the
                           scroll affordance, keep it
snap offsets    0, then +(4×32 + 3×5 + 11) = 154px per group
frame B offset  8×32 + 6×5 + 2×11 = 308px
```

**In-cell artwork is dropped on phone.** `round(32 × 0.56)` = 18px, below the
22px legibility floor, so an active cell is a plain coloured pebble. This is a
known gap against the brief — see **Assets**.

**"Whole loop" map — how the playhead stays findable.** A 34px band directly
under the grid. Label "WHOLE LOOP", Chivo 700 10px,
`letter-spacing:.06em`, `rgba(242,239,230,.4)`, occupying the same 92px as the
rail so it reads as belonging to the grid.

16 ticks, `display:flex; gap:4px; align-items:flex-end`, each `flex:1`,
radius 2px:

| Tick | Height | Colour |
|---|---|---|
| Playhead step | 16px | `#6FE0F0`, `box-shadow: 0 0 8px rgba(111,224,240,.8)` |
| Step with any note | 12px | `rgba(242,239,230,.5)` |
| Empty step | 5px | `rgba(242,239,230,.18)` |

Under the ticks, a **window bracket**: `height:3px`, radius 2px,
`background:rgba(242,239,230,.55)`, `width:50%`, `left:0` when viewing bars 1–2
and `left:50%` for bars 3–4. It shows which half of the loop is on screen.

Because the map always shows all 16 steps, the playhead is never lost — it
moves from the grid to the map. That is the answer to the brief's hard
requirement.

**Off-screen playhead edge glow (frame B).** When the playhead is scrolled out
of view, a marker appears on the side it is on: absolutely positioned at the
window's leading edge, `width:22px`, `top:26px; bottom:10px`,
`background: linear-gradient(90deg, rgba(111,224,240,.35), rgba(111,224,240,0))`,
`border-left:3px solid #6FE0F0`, radius 2px, `pointer-events:none`. It tells a
child which way to swipe back.

**Phone transport.** Play button 72px circle,
`box-shadow: 0 5px 0 #C79A17, 0 12px 24px rgba(0,0,0,.4)`, triangle
`border-left:25px`, `border-top/bottom:16px`. Tempo block to its right,
`gap:14px`: label Chivo 800 14px + Chivo Mono 600 12px readout, then
Slow / 12px track / Fast (Chivo 600 11px), thumb 34px.

**Phone preset row.** Label "Starters" Chivo 700 11px, then cards
`width:118px`, `padding:9px`, thumbnail pitch 6px, name Chivo 800 12px,
in a horizontally scrolling row, `gap:10px`.

> **Amended by ticket 36.** No phone preset row either — the cards keep the
> 118px / 9px / 6px numbers, but inside the "New boop" dialog, two columns at
> `gap:10px`. See the amendment under §1's "Preset row".

Everything else — My boops, Share, help, Clear grid — lives in the "⋯" menu.

### 4. My boops

A light card on the dark stage. `background:#F5F1E8`, radius 16px,
`padding:16px`, `box-shadow: 0 18px 40px -14px rgba(0,0,0,.55)`.
Title "My boops" Chivo 900 19px `#14262A`, `margin-bottom:12px`.
List `gap:8px`. Footer note "Tap a boop to open it. No limit on how many you
keep." Chivo 400 11.5px/1.5 `rgba(20,38,42,.45)`.

**Amendment (ticket 30).** The card's width is no longer a single number:
`clamp(352px, 44vw, 560px)`, still capped by `calc(100vw - 32px)`. 352px is the
phone width and the clamp floor, so phone rendering is unchanged; 560px is what
a thumbnail, a comfortable name and three icon buttons need on one row. The
extra width goes to the name, not the thumbnail. Height stays capped at
`calc(100vh - 64px)` and the card is otherwise as short as its content —
**only the list scrolls**, so the title, the save form and the footer note never
scroll away.

Each row: `display:flex; align-items:center; gap:12px; padding:10px 12px`,
radius 12px.
- Resting: `background:rgba(20,38,42,.04)`.
- Currently loaded: `background:rgba(11,124,145,.1)`,
  `box-shadow: inset 0 0 0 1.5px rgba(11,124,145,.5)`.
- Thumbnail: the same dot matrix, 4px pitch, dots `#14262A` for active steps.
- Name Chivo 800 15px `#14262A`; meta ("Saved today") Chivo 400 11.5px
  `rgba(20,38,42,.45)`.
- Rename — 34 × 34, radius 9px, 17px pencil SVG at `rgba(20,38,42,.4)`.
  Paths: `M12 20h9` and `M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z`.
- Delete — 34 × 34, 17px bin SVG at `rgba(138,74,66,.6)`.
  Paths: `M3 6h18`, `M8 6V4h8v2`, `M6 6l1 14h10l1-14`.
- Export (**amendment, ticket 34**) — a third icon button, same treatment as
  rename: 34 × 34, radius 9px, 17px download SVG at `rgba(20,38,42,.4)`.
  Paths: `M12 3v12`, `m7 11 5 5 5-5`, `M5 21h14`. It renders *that row's*
  pattern and tempo to a WAV. Disabled while it renders.
- Just saved (**amendment, ticket 32**) — for ~1.2s the new row wears the
  currently-loaded treatment (`background:rgba(11,124,145,.1)`, the same inset
  ring) plus one `boopPop`.
- Currently loaded (**built by ticket 31**) — the treatment above is now driven
  by real state rather than left unbuilt. The ring is held for as long as that
  boop is loaded, and carries no animation: it is a standing fact, not an
  event. A load sets it, a save adopts it, a rename keeps it, a delete moves it
  up or ends it, and loading a starter or clearing the grid drops it.

Tap the row to load. No cap on saved boops.

### 5. Save, rename, delete, clear, share

**Save (rewritten — ticket 32).** Save is a small always-on form directly under
the title: the name field, then "Save this boop". The field is prefilled with
the generated name ("Boop 3"), so saving is still one tap with no keyboard and
no typing. Field — `padding:12px 13px`, radius 9px, `border:1.5px solid #0B7C91`,
`background:#fff`, Chivo 700 15px, a 2 × 18px `#0B7C91` caret. Button —
`padding:13px 18px`, radius 9px, `background:#14262A`, Chivo 800 14px, white;
`gap:9px` between the two. Enter saves. The field autofocuses on desktop only —
on a phone that would open the keyboard over the list.

The button is enabled from the start and disables (visibly, `opacity:.35`) only
while the field is empty. After a save the dialog **stays open**, the new row
lands with its brief highlight (§4), and the field re-prefills with the *next*
generated name — the box always holds the name the next press will write, which
is what stops a second press duplicating the first.

The old flow is gone: there is no "Saved it" heading, no "Already saved. Type a
new name if you want one." helper, and the save no longer happens before the
name is shown. Row rename (the pencil) is unchanged — that is still the field +
"Done" pair described above.

**Both confirms** share one shape: title Chivo 800 15px `#14262A`, a one-line
consequence Chivo 400 12.5px `rgba(20,38,42,.5)`, then two equal buttons
`gap:9px`, each `flex:1; text-align:center; padding:13px`, radius 9px,
Chivo 800 14px.
- Safe choice (left, filled): `background:#14262A`, white.
- Destructive (right, outlined): `border:1px solid rgba(138,74,66,.4)`,
  `color:#8A4A42` — the fridge's `--danger-text`.

Delete: "Throw away Boop 2?" / "You can't get it back." → *Keep it* /
*Throw away*.
Clear: "Clear the whole grid?" / "Every step comes off. Saved boops stay." →
*Keep playing* / *Clear it*.

**Share — one action, no modal.**
- Resting (desktop): `padding:12px 22px`, radius 9px, `background:#14262A`,
  Chivo 800 15px, white, label "Share".
- After the tap: `background:#0B7C91`, a 17px check SVG (`m5 13 4 4L19 7`,
  `stroke-width:3`) + "Copied!", `gap:8px`. Holds 1.6s, then reverts.
  Animation: `boopPop .45s cubic-bezier(.34,1.56,.64,1)`.
- On mobile the same button opens the OS share sheet. **No link field, ever.**
- **Retired (ticket 34).** There is no demoted "Save the sound as a file"
  secondary underneath any more. WAV export is the per-row Export button in
  "My boops" (§4): one export path, of a *saved* boop, on every breakpoint.
  Filename is the boop's own name, slugged and lowercased — `boop-3.wav`,
  falling back to `boop.wav` when nothing survives slugging.

**Mobile "⋯" menu.** Card radius 14px, `padding:12px`, items `gap:8px`.
Each item `min-height:44px; padding:10px 12px`, radius 9px, `background:#fff`,
`border:1px solid rgba(20,38,42,.12)`, Chivo 700 14px `#14262A`. In order:
My boops, Share, How boop works. Then "Clear grid" with
`border:1px dashed rgba(138,74,66,.4)` and `color:#8A4A42`.

---

## The six instruments

Rows 1–4 are the rhythm section; 5–6 make patterns sound like music.

| # | Name | Colour | Role | Placeholder artwork |
|---|---|---|---|---|
| 1 | Kick | `#FF6B5C` | The heartbeat. Low and round. | `drum.svg` |
| 2 | Snare | `#FFB03A` | The backbeat. Where the clap lands. | `drum-kit.svg` |
| 3 | Hi-hat | `#DCE85C` | Light, ticking. Keeps time on top. | `gong.svg` |
| 4 | Tom | `#FF7FB0` | Warm thump. The low fill. | `tambourine.svg` |
| 5 | Marimba | `#6FE0A8` | Pitched, woody, melodic. | `xylophone.svg` |
| 6 | Boop | `#B78BFF` | The namesake. Electronic and cheeky. | `boombox.svg` |

Row order is fixed. The six hues are spread across the wheel at similar
lightness and chroma so no row dominates, and all six sit legibly on the dark
stage.

---

## Interactions & behaviour

These are fixed by the product spec — implement them, don't redesign them.

- **Latched drag-paint.** Pointer-down on a cell decides add-or-remove from
  that cell's current state; the whole drag repeats that one decision. Tracked
  **per pointer**, so two fingers can paint independently.
- **Audible edits while stopped.** Toggling a cell on plays its sound
  immediately. The grid is fully explorable without ever pressing play.
- **Loop is unconditional.** One play/pause button is the entire transport —
  no stop, no restart, no record. Nothing that destroys work.
- **Spacebar toggles play** (desktop).
- **Keyboard on the grid.** Arrows move, Enter/Backspace toggle/remove, with
  visible focus rings on keyboard use only. *(Focus-ring visuals not yet
  designed.)*
- **Pinch-zoom on the page keeps working.** Only the grid itself suppresses
  scroll-while-painting (`touch-action:none` on the grid, as
  `FridgePage.module.scss` does for its stage).
- **Phone horizontal scroll** snaps to the 4-step group offsets. While playing,
  it does **not** auto-follow the playhead — the loop map carries that
  information instead, so a child's scroll position is never yanked.
- **Empty cells must read as invitations** — visibly tappable, never dead space.
  That is what the top inset highlight on empty cells is for.

## Motion

Springy and physical. **Hard rule: no strobing, no full-screen flashes** —
boop must never need a photosensitivity warning.

| What | Spec | Behaviour |
|---|---|---|
| Playhead | 1 step per beat | A soft cyan column, hard-cut from step to step. It never fades or pulses — the jump itself is the rhythm. |
| Step hit | squash 1.2 / 0.82, 320ms | The struck cell squashes wide, overshoots once, settles. Keyframes: `0% scale(1,1)` → `8% scale(1.2,.82)` → `30% scale(.94,1.08)` → `55%–100% scale(1,1)`. Spring curve, no glow. |
| Row character | bob 4px, 180ms | The row label nudges down and back on every hit in its row, so a child can see which voice is speaking. |
| Edit while stopped | scale 0.9 → 1, 140ms | A cell you paint pops in as its sound plays. Painting and hearing are one event. |
| Play / pause | press 2px, 90ms | The yellow button loses its bottom shadow on press, like a real key going down. |
| Preset load | stagger 24ms per column | Cells arrive left to right across two beats, so the pattern reads as it lands. |
| Copied! | pop 1.06, 450ms | Label swaps, background goes cyan, reverts after 1.6s. No toast, no modal. |

Honour `@media (prefers-reduced-motion: reduce)` — disable all of the above and
let the playhead move without the squash.

## State management

| State | Shape | Notes |
|---|---|---|
| `pattern` | `boolean[6][16]` | The grid. Persist to `localStorage` like the fridge persists its board. |
| `playing` | `boolean` | Loop is unconditional; this is play/pause only. |
| `step` | `0–15` | Current playhead position; advances on the audio clock, not `setInterval`. |
| `bpm` | `60–200`, default `100` | Slider position is logarithmic; the stored value is linear bpm. |
| `activePreset` | `'blank' \| 'wonky' \| 'robot' \| 'stomp' \| null` | Goes `null` on the first user edit — the card stops looking loaded once it's been changed. |
| `saved` | `{ id, name, pattern, bpm, savedAt }[]` | No cap. `localStorage`, same pattern as `useFridgeBoard`. |
| `paintLatch` | `Map<pointerId, boolean>` | The add-or-remove decision per active pointer. |
| `scrollGroup` | `0–3` (phone) | Which 4-step group starts the visible window. |
| `confirm` | `null \| { kind: 'clear' } \| { kind: 'delete', id }` | Drives the two confirm cards. |
| `shareState` | `'idle' \| 'pending' \| 'copied'` | `'copied'` auto-reverts after 1.6s. |

Sharing a boop needs a server snapshot. Follow
`apps/fridge/src/server/handlers/shareBoardHandler.ts` and `getBoardHandler.ts`
exactly: an immutable snapshot, a short id, a `/g/<id>` route that imports into
the visitor's own copy.

Data fetching: none for the toy itself. `share` and `getBoop` are the only
two calls.

---

## Design tokens

### Colour — stage and chrome

| Token | Value | Use |
|---|---|---|
| `--stage` | `#14262A` | App background, the frame |
| `--well` | `#0E1F23` | The grid well |
| `--ink` | `#F2EFE6` | Text and icons on the stage; the Share button fill |
| `--paper` | `#F5F1E8` | Popovers, My boops, confirms |
| `--paper-input` | `#FFFFFF` | Fields and menu items on paper |
| `--ink-dark` | `#14262A` | Text on paper; the filled safe button |
| `--cyan` | `#6FE0F0` | Playhead, active preset ring, loop-map playhead tick |
| `--cyan-solid` | `#0B7C91` | "Copied!" fill, links, focus border |
| `--play` | `#FFD24A` | Play/pause only |
| `--play-shadow` | `#C79A17` | Its bottom edge |
| `--danger` | `#FF8A7A` | Clear, on the stage |
| `--danger-text` | `#8A4A42` | Destructive text on paper (from the fridge) |

### Colour — instrument hues

`#FF6B5C` · `#FFB03A` · `#DCE85C` · `#FF7FB0` · `#6FE0A8` · `#B78BFF`

Reserved-colour rules, worth enforcing in review: butter yellow is play/pause
and nothing else; cyan belongs to the playhead and "Copied!"; coral appears
only on clear/delete.

### Colour — overlays on the stage

`rgba(255,255,255,.045)` empty cell (even group) · `.075` empty cell (odd
group) · `.14` empty cell under playhead · `.06` artwork plate ·
`.045` transport panel · `.1` divider and active preset card ·
`inset 0 1px 0 rgba(255,255,255,.08)` cell top highlight ·
`inset 0 1px 0 rgba(255,255,255,.05)` well top highlight

Text on stage: `rgba(242,239,230,.55)` back arrow · `.5` slider words and BPM ·
`.45` section labels · `.4` loop-map label · `.35` table headers ·
`.28` inactive bar numerals.
Text on paper: `rgba(20,38,42,.5)` consequence lines · `.45` hints and meta ·
`.4` icons.

### Typography

Chivo (300, 400, 600, 700, 800, 900) and Chivo Mono (400, 600), both Google
Fonts. **Self-host both, per `docs/reference/fridge-magnets/fonts/FONTS.md` —
the house rule is no runtime Google Fonts.** Serve a latin-subset variable
woff2 and declare it in `apps/boop/src/styles/tokens.scss`, matching how the
fridge self-hosts Fredoka.

| Role | Font | Laptop | Tablet | Phone |
|---|---|---|---|---|
| Wordmark | Chivo 900, `-.03em` | 31px | 26px | 20px |
| Row label | Chivo 800, `-.015em` | 17px | 14px | 11px |
| Button | Chivo 800 / 700 | 14px | 13px | 14px |
| Section label | Chivo 700 | 13px | 12px | 11px |
| BPM readout | Chivo Mono 600 | 13px | 12px | 12px |
| Bar numeral | Chivo Mono 700 | 13px | 10px | 10px (floor) |
| Body / notes | Chivo 400, `1.5–1.65` | 12.5–13.5px | — | 12.5px |
| Eyebrow label | Chivo 700 mono, `.06em` | 10.5px | — | 10px |

Minimum on-screen size is **10px**, and only for the mono bar numerals. Nothing
functional goes below it. Long labels must not be clipped: give the rail room
rather than relying on `overflow:hidden` — "Marimba" at Chivo 800 11px needs
48px, so the phone rail is 92px (32 plate + 7 gap + 53 text).

### Radius

| | Laptop | Tablet | Phone |
|---|---|---|---|
| Frame | 22px | 20px | 34px |
| Grid well | 24px | 20px | 16px |
| Transport panel | 20px | 18px | — |
| Cell | 14px | 9px | 7px |
| Artwork plate | 16px | 12px | 10px |
| Preset card | 14px | 14px | 14px |
| Control (buttons, fields, hit areas) | **9px** | 9px | 9px |
| Popover / list card | 16px | — | 14px |
| List row | 12px | — | 12px |

Cell radius is `round(cellWidth × 0.22)`; artwork plate is
`round(plateSize × 0.3)`; playhead column is `round(cellWidth × 0.3)`.
`9px` is the fridge's `--r-control` — keep it, it is the shared house value.

### Spacing

Grid rhythm is derived, not from a scale — use the per-breakpoint tables above.
Everything else uses `4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26 · 30px`.

### Shadow

| Token | Value |
|---|---|
| Frame | `0 24px 60px -24px rgba(20,38,42,.55)` |
| Popover | `0 18px 40px -14px rgba(0,0,0,.55)` |
| Active cell | `0 2px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.38)` |
| Cell under playhead | `0 0 0 3px rgba(255,255,255,.6), 0 8px 16px rgba(0,0,0,.45)` |
| Empty cell | `inset 0 1px 0 rgba(255,255,255,.08)` |
| Play button | `0 4px 0 #C79A17, 0 10px 22px rgba(0,0,0,.35)` (phone: `0 5px 0`, `0 12px 24px rgba(0,0,0,.4)`) |
| Slider thumb | `0 3px 8px rgba(0,0,0,.45)` |
| Playhead column | `0 0 0 1px rgba(111,224,240,.34)` |
| Active preset ring | `inset 0 0 0 2px #6FE0F0` |
| Loop-map playhead tick | `0 0 8px rgba(111,224,240,.8)` |

### Tap targets

Every interactive element clears 44px. Grid cells are as generous as the layout
allows: 62 × 66 laptop, 42 × 50 tablet, 32 × 44 phone. The phone cell is
deliberately below 44 on its short axis — the row band is 44 tall and cells sit
edge to edge, so the effective vertical target is 44px and horizontal
neighbours are same-row cells where a mis-tap is harmless and audible.

---

## Assets

### The six instrument artworks — placeholders, not final art

The SVGs in `assets/instruments/` are from **game-icons.net, CC BY 3.0**.
Attribution is owed to **Delapouite, Lorc, Caro Asercion and Skoll** if any of
them ship. `ATTRIBUTION.txt` in this bundle is the upstream licence file.

They are applied as a **CSS mask** so a single file tints to any colour:
```css
width: 40px; height: 40px;
background: #FF6B5C;                     /* the row colour */
mask: url(drum.svg) center / contain no-repeat;
-webkit-mask: url(drum.svg) center / contain no-repeat;
```
The source files have had their black background rect stripped and their fill
set to `currentColor`, so only the alpha channel matters.

**These do not satisfy the brief and must be replaced.** The brief asks for one
artwork asset that serves as both the row label *and* the note mark inside an
active cell — the survey's strongest labelling pattern. Line art cannot do
both: at 18px inside a phone cell these drawings turn to mush, which is why the
phone note mark is currently a bare coloured pebble.

**What the real set needs, per character:**
1. A **detailed form** for 40–64px row labels.
2. A **single-silhouette form** — one closed shape, no interior lines,
   recognisable at 18px — for the note mark.

Same character, two crops. Six characters with shared DNA, distinguishable by
**outline alone**. Never emoji, never abstract icons.

### Icons

All UI icons are 22px (or 17px in lists) line SVGs, `stroke-width:2`
(3 for the check), round caps and joins, `currentColor`. Back arrow, save and
overflow are lifted verbatim from
`apps/fridge/src/features/toolbar/MobileBar.tsx` — reuse those exact paths so
boop's chrome matches the rest of homeofed. Pencil, bin and check are drawn in
the same idiom; swap them for whatever the codebase already uses if there is a
house set.

### Fonts

Chivo and Chivo Mono. Self-host, do not link Google at runtime.

---

## Copy

31 words on the main screen. Instrument names and "Tempo / Slow / Fast" are
fixed by the brief; everything else is a first draft and open to rewrite. The
full string list — every label, hint, confirm and button, tagged *brief* vs
*mine* — is in section `1f` of the design file. Two rules behind it:

- Real musical vocabulary, used sparingly. "BPM" never appears as a label,
  only as a small numeric readout.
- Never state "now make it yours". Loading a preset makes that implicit.

---

## Files

| File | What it is |
|---|---|
| `boop - design.dc.html` | The design. Open it directly in a browser. Six sections: `1a` laptop, `1b` tablet, `1c` phone (two frames), `1d` My boops + moments, `1e` the six voices + palette + type, `1f` the full copy list + a live motion spec. |
| `support.js` | Runtime the design file needs. Keep it beside the HTML. |
| `assets/instruments/*.svg` | The six placeholder artworks. |
| `ATTRIBUTION.txt` | game-icons.net licence and author list. |

The design file's own header panel states the three assumptions behind it: the
dark stage (a deliberate break from the fridge's warm kitchen — say the word
and it can be tried warm), the placeholder artwork, and what is shared with the
rest of homeofed.

### Upstream files this design was built from

`apps/fridge/src/styles/tokens.scss` ·
`apps/fridge/src/pages/FridgePage.tsx` + `.module.scss` ·
`apps/fridge/src/features/toolbar/MobileBar.tsx` + `.module.scss` ·
`apps/fridge/src/features/toolbar/TopBar.module.scss` ·
`apps/fridge/src/features/toolbar/SavedChips.module.scss` ·
`apps/fridge/src/features/share/ShareButton.tsx` + `.module.scss` ·
`apps/fridge/src/features/board/FridgeDoor.module.scss` ·
`apps/hub/src/pages/HomePage.module.scss` (house type/palette reference only —
boop is intentionally distinct)
