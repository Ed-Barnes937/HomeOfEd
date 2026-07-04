# Handoff: HomeOfEd — "Index" homepage (option 2b)

## Overview
A calm, minimal single-screen homepage for **HomeOfEd**, a small personal
studio/portal that links out to a handful of apps. This is the **"Index"**
direction: an editorial two-column layout — a wordmark + short lede on the
left, a quiet list of apps on the right, separated by a hairline rule. It
supports light and dark themes (defaults to the visitor's system preference,
with a manual toggle) and a one-time playful animation of the word "of"
hopping across the letters of "home" before coming to rest in the wordmark.

The tone is deliberately understated: the app links must **not shout**. Live
apps get a subtle accent; unreleased ones are muted and marked "SOON".

## About the Design Files
The files in this bundle are **design references created in HTML** — a
prototype showing the intended look and behavior, **not production code to ship
directly**. The task is to **recreate this design in the target codebase's
existing environment** (React, Vue, Svelte, SwiftUI, plain HTML, etc.) using
that project's established components, tokens, and patterns. If there is no
codebase yet, pick the most appropriate stack for a tiny content site (a static
framework like Astro/11ty or plain HTML/CSS is more than enough) and implement
it there.

`2b-reference.html` is fully self-contained (only an external Google Font) and
runs offline in any browser — open it to see exact spacing, colors, the theme
toggle, and the animation timing. Treat it as the source of truth.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and the animation are
final. Recreate the UI to match, substituting the codebase's own primitives
where sensible (e.g. an existing `<Link>`, theme provider, or icon button).

## Screens / Views

### Screen: Home (single view)
- **Purpose:** Landing page. Visitor reads who this is and taps through to an app.
- **Canvas in the prototype:** 1000 × 640 px card. In production this is the
  **full viewport** — the left `intro` column flexes to fill, the right `apps`
  column is a fixed 340 px rail. Both columns vertically center their content.
- **Layout:** Horizontal flex.
  - **Left column (`.intro`)** — `flex: 1`, `padding: 0 58px`, vertical flex,
    `justify-content: center`, `gap: 20px`. Contains eyebrow → wordmark → lede.
  - **Divider** — the right column's `border-left: 1px solid var(--line)`.
  - **Right column (`.apps`)** — `width: 340px`, `padding: 0 40px`, vertical
    flex, centered. Contains the four app rows.
  - **Theme toggle** — absolutely positioned, `top: 24px; right: 26px`.

#### Components

**Theme toggle button**
- 34 × 34 px circle, `border: 1px solid var(--line)`, transparent background.
- Glyph: `☾` in light mode, `☀` in dark mode. Color `var(--muted)`.
- Position: absolute top-right (24/26 px). `cursor: pointer`.
- Behavior: flips `data-theme` on the root element. `color` transitions 0.4s.

**Eyebrow**
- Text: `01 — index`
- 12px / weight 600 / `letter-spacing: .22em` / uppercase / color `var(--faint)`.

**Wordmark ("home of ed")**
- Reads **"home of ed"**: the word `of` is a separate absolutely-positioned
  span (accent color) that animates over the top of `home`.
- Font: Familjen Grotesk, weight **700**, size **76px**, `letter-spacing: -.04em`,
  `line-height: 1`. Color `var(--fg)`; the `of` is `var(--accent)`.
- Structure (needed for the animation): each of h, o, m, e is its own
  `<span class="letter">`, then a `.gap` spacer (`width: .62em`), then a static
  `ed`, then the animated `.of` (absolute, `left:0; bottom:.06em`,
  `transform-origin: center bottom`, starts `opacity:0`).
- `aria-label="home of ed"` on the `<h1>`; the visual letter spans are
  `aria-hidden`.

**Lede**
- Text: `A quiet index of the things I build, and the ones still taking shape.`
- 15px / `line-height: 1.55` / color `var(--muted)` / `max-width: 280px`.

**App rows (the links — "don't shout")**
- Each row: horizontal flex, `justify-content: space-between`,
  `align-items: baseline`, `padding: 16px 0`, `border-bottom: 1px solid var(--line)`
  (last row: no border).
- **Live app** (`Boids`): name weight 600 / 16px / color `var(--fg)`;
  status text `LIVE`, 11px, `letter-spacing: .14em`, color `var(--accent)`.
  Whole row is an `<a href>`.
- **Coming-soon apps** (`fridge magnets`, `HEIG`, `WOTD`): name weight 500 /
  16px / color `var(--muted)`; status `SOON`, 11px, `letter-spacing: .14em`,
  color `var(--faint)`. Not links (rendered as non-interactive `<span>`).

## Interactions & Behavior
- **Theme:** On load, read `prefers-color-scheme`; set `data-theme` to
  `dark`/`light` accordingly. The toggle button flips it. `background` and
  `color` transition over 0.5s; the toggle glyph over 0.4s. (Optionally persist
  the manual choice in `localStorage` — the prototype does not, so system
  preference wins each load.)
- **"of" hop animation (plays once, then rests):**
  - The `.of` span enters from above, then hops left→right landing on the tops
    of **h → o → m → e**, squashing on each landing; each landed letter does a
    small dip (`.letter` dip keyframes). It finishes parked in the `.gap`
    between "home" and "ed", reading naturally as "home **of** ed".
  - Total duration **4.2s**, easing `cubic-bezier(.45,.05,.4,1)`, runs **once**
    (`animation-iteration-count: 1`, `both` fill) — it does not loop.
  - Keyframes are **generated at runtime** by measuring each letter's centre,
    so the arc stays correct at any font size. Re-runs on resize (debounced) and
    after fonts load. See the IIFE in `2b-reference.html`; the `CONFIG` object at
    the top holds all tunable timing/positions.
  - **Reduced motion:** if `prefers-reduced-motion: reduce`, skip the hop and
    render `.of` already at rest (`opacity:1`, parked in the gap).
- **App links:** `Boids` navigates to the Boids app (wire to real URL). The
  three SOON items are intentionally non-interactive.
- **Hover states:** none in the prototype (kept quiet on purpose). If the
  codebase expects link affordances, a subtle `color` shift toward `var(--fg)`
  or a thin underline on the live row is acceptable — keep it understated.

## State Management
- `theme`: `'light' | 'dark'` — initialized from system preference, toggled by
  the button. Drives the `data-theme` attribute / token set.
- `animationPlayed`: implicit — the animation is fire-once on mount; no state
  needs to persist it. (If you route between pages in an SPA, re-trigger it on
  mount of the home route only.)
- No data fetching. The app list is static content (see below).

## Design Tokens

### Colors — Light
| Token | Hex / value | Use |
|---|---|---|
| `--bg` | `#e6e7ea` | Page background (off-white, never pure white) |
| `--fg` | `#292c31` | Primary text / wordmark |
| `--muted` | `#7d828b` | Secondary text, soon-app names |
| `--faint` | `#aeb2ba` | Eyebrow, SOON status |
| `--accent` | `#556479` | "of", LIVE status, live link |
| `--line` | `rgba(41,44,49,.11)` | Hairlines, divider, toggle border |

### Colors — Dark (nothing pure black; soft slate)
| Token | Hex / value |
|---|---|
| `--bg` | `#111316` |
| `--fg` | `#cdd0d6` |
| `--muted` | `#787d86` |
| `--faint` | `#4b4f56` |
| `--accent` | `#7f92a8` |
| `--line` | `rgba(205,208,214,.09)` |

### Typography
- **Family:** Familjen Grotesk (Google Fonts), weights 400/500/600/700.
  Fallback stack: `'Familjen Grotesk', system-ui, sans-serif`.
- Wordmark: 76px / 700 / `-.04em` / `line-height 1`.
- App name: 16px / 600 (live) or 500 (soon).
- Lede: 15px / 400 / `line-height 1.55`.
- Eyebrow: 12px / 600 / `.22em` / uppercase.
- Status (LIVE/SOON): 11px / `.14em`.

### Spacing
- Left column padding: `0 58px`; intro gap: `20px`.
- Right column: width `340px`, padding `0 40px`.
- App row vertical padding: `16px`.
- Toggle inset: `24px / 26px`; toggle size `34px`.

### Other
- Border radius: `12px` on the prototype card (drop this if the page is
  full-viewport); toggle is a `50%` circle.
- Divider / hairlines: `1px solid var(--line)`.
- Transitions: background/color `0.5s ease`; toggle color `0.4s`.

## Assets
- **Font:** Familjen Grotesk via Google Fonts — no local asset needed.
- **Icons:** none (theme toggle uses the Unicode glyphs `☾` / `☀`). Swap for
  the codebase's icon set if preferred.
- **Images:** none. (Note: the *other* handoff-worthy directions 3a–3d add a
  handmade-paper background from a real PNG texture, blended with
  `background-blend-mode: soft-light` over `--bg`. 2b itself uses a flat
  background — no texture.)

## Files
- `2b-reference.html` — self-contained, runnable reference implementation of 2b
  (theme toggle + hop animation). **Primary reference.**
- `HomeOfEd Zen Home.dc.html` — the full multi-option design source from the
  design tool. Option 2b lives in the turn-2 section (`id="2b"`,
  `data-card="f"`). Included for context; other options (1a–1d, 2a/2c/2d,
  3a–3d) are alternate directions, not part of this handoff.
