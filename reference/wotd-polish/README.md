# Handoff: Word of the Day (WOTD) — paper & ink direction

## Overview
WOTD shows one new word per day at four difficulty levels (KS1–KS4). The app is two screens:
a **level picker**, and a **word screen** with a guess-then-reveal mechanic — the word, its type and
pronunciation are shown first, the definition is hidden behind a "Show Definition" action.
A persistent "Yesterday" strip shows the previous day's word.

This handoff covers the chosen direction ("paper & ink, playground edition") in **light and dark
mode**, at **mobile (390×720)** and **desktop (1280×800)**.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended
look and behaviour, not production code to copy directly. The task is to **recreate these designs in
the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its
established patterns and component libraries. If no environment exists yet, pick the most
appropriate framework for the project and implement the designs there.

Both HTML files are canvases holding many frames side by side; each fixed-size frame (390×720 or
1280×800) represents one screen state, not a page of the app.

## Fidelity
**High-fidelity.** Colours, typography, spacing, radii and copy are final. Recreate pixel-accurately
using the codebase's own primitives. The only deliberately unresolved areas are the audio
("Hear it") implementation, the "Past words" destination, and real word data.

## Screens / Views

### 1. Level picker — mobile (390×720)
**Purpose:** choose a difficulty level; see yesterday's word.

Layout: column. Top bar 18px 20px padding, 2px bottom rule. Body padding 24px 20px 18px.
- **Top bar:** 34px circular back button (2px border, 17px arrow icon) · centred label "Word of the Day"
  (Nunito 800, 12px, .14em tracking, uppercase, muted) · **theme toggle** on the right.
- **Date:** "Tue 11 Aug" — Nunito 700, 12px, .1em, uppercase, dim.
- **Headline:** "Pick a level,\nany level!" — Newsreader 400, 38px/1.06, −0.015em.
  Beneath it an 88×5px rounded rule in the amber accent (light `oklch(0.72 0.16 70)`, dark `oklch(0.82 0.15 70)`).
- **Level list:** vertical flex, 10px gap. Each row: 14px 16px padding, 18px radius, 2px border,
  tinted fill; 36px rounded-square (12px radius) number badge in the level colour; name in
  Newsreader 400 23px; sub-label "Typically KS1" in Nunito 600 12.5px; 18px chevron.
  Rows are links; hover deepens the fill one step.
- **Yesterday strip:** `margin-top:auto`, 13px 16px, 16px radius, **2px dashed** border.
  "YESTERDAY" (Nunito 800 11px .1em) · word in Newsreader 400 18px · type in Newsreader italic 14px ·
  right chevron pushed with `margin-left:auto`.

### 2. Word, before the reveal — mobile
Top bar: "Levels" back link (Nunito 800 12px uppercase) · level pill (tinted, with the number badge
inside) pushed right with `margin-left:auto` · theme toggle (10px to its right).
Body padding 44px 20px 18px.
- Date line, then the word: **Newsreader 400, 56px/1, −0.03em**.
- Below: type in Newsreader **italic** 19px muted + respelling "ih·FEM·er·uhl" in Nunito 600 14px dim.
- "Hear it" button: self-start pill, min-height 46px, 2px border, white/#1D1B15 fill, speaker icon + label (Nunito 700 14px).
- 40px down: 2px rule, then the prompt "Have a guess first — what do you think it means?" (Nunito 600 15px/1.5)
  and the primary button — full width, min-height 56px, **18px radius**, solid level colour, Nunito 800 16px.
- Yesterday strip as above.

### 3. Revealed — mobile
Same header. Word drops to 44px, type row gains a 36px circular audio button on the right.
The entry sits in a card: 20px padding, 20px radius, 2px border, white (light) / #1D1B15 (dark), 20px gaps.
- **Definition** — label Nunito 800 11px .14em uppercase; body Newsreader 400 21px/1.4.
- **Example** — Newsreader italic 17px/1.5, 14px left padding, **4px** left border in the level colour.
- **Synonyms** — pills: 7px 14px, 2px border, tinted fill, Nunito 700 14px.
- "Hide Definition": full width, 50px, 18px radius, 2px border, transparent fill.

### 4. Level picker — desktop (1280×800)
Top bar full width (20px 40px, 2px rule): "W" mark (28px, 9px radius, inverted fill) + wordmark ·
right group (22px gap): date, "Past words" pill (2px border), theme toggle.
Content column `max-width:1120px`, centred, padding 56px 40px 32px.
- Headline row: "Pick a level, any level!" Newsreader 58px/1.02 with the 120×6px accent rule, and a
  right-aligned 34ch intro paragraph (Nunito 600 15px/1.55).
- **Levels: 4-column grid, 20px gap**, 44px above. Each card: 24px 22px 22px, 22px radius, 2px border,
  tinted fill; 44px number badge (14px radius); name Newsreader 30px; sub-label; "START →" in
  Nunito 800 12.5px uppercase.
- Yesterday strip pinned to the bottom (`margin-top:auto`), same dashed treatment plus the
  definition inline ("great merriment or laughter").

### 5. Word, before the reveal — desktop
Header: "All levels" back link · date · level pill · toggle.
Body: **grid `1.05fr 0.95fr`, 64px gap**, padding 72px 40px 32px, items start-aligned.
- Left: word at **Newsreader 400, 92px/0.98, −0.035em**; type (italic 24px) + respelling (16px); "Hear it" pill (48px).
- Right: guess card — 34px 32px, 24px radius, **2px dashed** border, faint fill.
  Prompt in Newsreader 28px/1.3, sub-line in Nunito 600 15px, then the primary button (58px, 18px radius).
- Yesterday strip spans the content column beneath the grid.

### 6. Revealed — desktop
Left column keeps the 92px word and gains a second button ("Hide definition") beside "Hear it", then a
2px rule and the **Synonyms** pills (9px 16px, Nunito 700 15px).
Right column becomes the entry card (solid border, 2px, 24px radius, 28px gaps):
**Definition** Newsreader 30px/1.32 · **Example** Newsreader italic 21px/1.5 with a 5px left border ·
**Where it comes from** Nunito 600 16px/1.6 with the root word set in Newsreader italic 18px.

### Theme toggle (all screens)
A two-segment pill in the top bar: 3px padding, 2px border, pill radius; two 26px circular segments
(sun, moon; 15px stroked icons, stroke-width 2). The active segment is filled — **light:** sun filled
#1B1A17 on #FDFBF4, inactive #A89F86, shell #fff / 2px #E8DFC9. **Dark:** moon filled #F4F0E4 on
#15140F, inactive #7C7566, shell #1D1B15 / 2px #322F26.

## Interactions & Behavior
- Level card → word screen for that level; back link → picker. Level colour carries through the whole
  word screen (badge, primary button, example rule, synonym pills).
- "Show Definition" reveals the entry in place. Mobile: the card expands below the word (word shrinks
  56px → 44px). Desktop: the right-hand guess card is replaced by the entry card; the word does not move.
  Suggested transition: 200ms ease-out fade + 8px rise; respect `prefers-reduced-motion`.
- "Hide Definition" returns to the pre-reveal state.
- "Hear it" plays the pronunciation; needs a playing state (not designed — suggest animating the speaker icon).
- Yesterday strip is tappable and opens the previous day's entry.
- Theme toggle switches light/dark; persist the choice and default to the system setting.
- Hover: level rows/cards deepen their tint; outline buttons take the faint surface fill; primary
  buttons lighten in dark mode and darken in light mode.
- Hit targets are ≥44px throughout; keep that when re-implementing.
- Responsive: single column below ~720px (mobile layouts); the desktop grid can collapse to one
  column with the entry card below the word on tablet.

## State Management
- `level` — 1–4, null on the picker.
- `revealed` — boolean, resets on word/level change.
- `theme` — 'light' | 'dark', persisted; initialised from `prefers-color-scheme`.
- `word` — { word, type, respelling, definition, example, synonyms[], origin?, audioUrl }.
- `yesterday` — { word, type, definition }.
- Data: one fetch per level per day; cache the day's words so the reveal is instant.

## Design Tokens

### Light
| Token | Value |
|---|---|
| Page | `#FDFBF4` |
| Surface (cards) | `#FFFFFF` / `#FBF7EC` (guess card) |
| Ink | `#1B1A17` |
| Body muted | `#7C7669` |
| Label dim | `#A89F86` |
| Secondary text | `#8A867C` |
| Rules / borders | `#E8DFC9` (2px), `#EFE7D4` (card), `#E4DAC2` (dashed) |
| Button hover fill | `#F3EDDD` |

### Dark
| Token | Value |
|---|---|
| Page | `#15140F` |
| Surface (cards) | `#1D1B15`, `#1B1A14` (guess card) |
| Text | `#F4F0E4` |
| Body muted | `#A29B8A` |
| Label dim | `#7C7566` |
| Secondary text | `#9A9384` |
| Rules / borders | `#322F26` (2px), `#3A3629` (dashed) |
| Button fill / hover | `#1D1B15` / `#262319` |
| Example body text | `#D8D2C2` |

### Level colours (OKLCH)
| Level | Light solid | Light border / fill | Dark solid | Dark border / fill |
|---|---|---|---|---|
| 1 Beginner (green, h 155) | `oklch(0.55 0.13 155)` | `oklch(0.86 0.075 155)` / `oklch(0.965 0.03 155)` | `oklch(0.78 0.14 155)` | `oklch(0.42 0.06 155)` / `oklch(0.28 0.035 155)` |
| 2 Intermediate (blue, h 265) | `oklch(0.55 0.13 265)` | `oklch(0.86 0.075 265)` / `oklch(0.965 0.03 265)` | `oklch(0.74 0.14 265)` | `oklch(0.42 0.07 265)` / `oklch(0.28 0.04 265)` |
| 3 Advanced (amber, h 70) | `oklch(0.58 0.13 70)` | `oklch(0.86 0.075 70)` / `oklch(0.965 0.03 70)` | `oklch(0.82 0.14 70)` | `oklch(0.44 0.07 70)` / `oklch(0.29 0.04 70)` |
| 4 Expert (red, h 20) | `oklch(0.55 0.16 20)` | `oklch(0.86 0.075 20)` / `oklch(0.965 0.03 20)` | `oklch(0.72 0.16 20)` | `oklch(0.43 0.08 20)` / `oklch(0.29 0.05 20)` |

Hover fills add roughly +0.02 chroma and −0.025 lightness (light) / +0.06 lightness (dark) — exact
values are in the HTML. Level-name text: light `oklch(0.35 0.09 h)`, dark `oklch(0.9 0.09 h)`.
Number-badge text is the near-black of its own hue (e.g. `#1A0D0B` on the expert red).
Accent rule under the headline: light `oklch(0.72 0.16 70)`, dark `oklch(0.82 0.15 70)`.

### Typography
- **Display / word / level names:** Newsreader (Google), weight 400, italic 400 for word type and examples.
  Sizes: 92 (desktop word), 58 (desktop headline), 56 / 44 (mobile word), 38 (mobile headline), 30, 28, 23, 22, 21, 18.
  Tracking: −0.035em at 92, −0.03em at 44–56, −0.02em at 58, −0.015em at 38.
- **UI / labels:** Nunito (Google), 600 for body and sub-labels, 700 for buttons, **800** for
  eyebrow labels, badges and primary buttons. Label style: 11–13px, .1–.16em tracking, uppercase.
- Line-height: 1 for labels, 1.2 for sub-labels, 1.4–1.6 for body, 0.98–1.06 for display.
- Body copy uses `text-wrap: pretty`.

### Spacing, radii, borders
- Spacing scale in use: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 34, 40, 44, 56, 64, 72.
- Radii: 7–9 (small badges), 12–14 (number badges), 16 (yesterday strip), 18 (level rows, primary
  buttons), 20–24 (cards), 999 (pills, circular buttons).
- Borders are **2px** almost everywhere (this is the direction's signature); dashed 2px for the
  yesterday strip and the desktop guess card. Example quote rules: 4px (mobile) / 5px (desktop).
- Desktop content column: `max-width:1120px`, 40px side padding.
- Only one shadow appears in the family (a soft card shadow in the discarded 2b direction) — this
  direction is **shadow-free**; depth comes from borders and fills.

## Assets
No image assets. All icons are inline stroked SVGs on a 24×24 viewBox (arrow-left, arrow-right,
chevron, speaker, sun, moon), stroke-width 1.5–2.4, `currentColor`. Replace with the codebase's icon
set where equivalents exist. Fonts are Google Fonts: Newsreader and Nunito.

## Files
- `WOTD - Dark Mode.html` — the final direction: six screens, each paired **dark beside light**
  (5a–5c mobile, 5d–5f desktop), with the theme toggle in every top bar. **Primary reference.**
- `WOTD - Directions.html` — the exploration this came from. Section 3 is the desktop light-mode
  design at full size; section 2 holds the mobile iterations (2a is the chosen one); section 1 is the
  three original directions, kept for context only — **do not build from 1a/1b/1c or 2b/2c**.

Open either file in a browser; they are self-contained apart from the Google Fonts link.
