# Spec: WOTD redesign — "paper & ink, playground edition"

Status: ready-for-agent

Design reference: `reference/wotd-polish/` — `README.md` (handoff), `WOTD - Dark Mode.html`
(**primary reference**: six screens, dark beside light), `WOTD - Directions.html` (context only;
do not build from sections 1a/1b/1c or 2b/2c).

## Problem Statement

WOTD works, but it looks like a scaffold. A visitor picking a level or reading today's word gets a
plain, undesigned page: no dark mode, no sense of place, no pronunciation help, no connection to
yesterday's word. The app has a finished, high-fidelity design direction ("paper & ink, playground
edition") that it doesn't yet match.

## Solution

Recreate the paper & ink design in the wotd app, pixel-accurately, in light and dark mode, at
mobile and desktop sizes, using the app's existing stack (React, SCSS modules, TanStack Router,
tRPC). The word gains a type ("adjective") and a respelling ("ih·FEM·er·uhl"), a themed
light/dark toggle persists the visitor's choice, and the word page shows yesterday's word for the
current level in a dashed strip.

## User Stories

1. As a learner, I want to pick from four clearly-colour-coded levels, so that I can find words matched to my stage.
2. As a learner, I want each level card to show its name and key-stage sub-label ("Typically KS1"), so that I know which level fits me.
3. As a learner on a phone, I want the level picker as a vertical list of tappable rows, so that it works one-handed at 390px wide.
4. As a learner on a desktop, I want the level picker as a four-column card grid with a "START →" affordance, so that the page uses the space well.
5. As a learner, I want to see today's date on every screen, so that I know the word is today's.
6. As a learner, I want to see the word first with its type and respelling but the definition hidden, so that I can have a guess before the reveal.
7. As a learner, I want a "Have a guess first" prompt with a big "Show Definition" button in my level's colour, so that the guess-then-reveal game is obvious.
8. As a learner, I want "Show Definition" to reveal the definition, an example sentence, and synonym pills in place, so that I can check my guess without navigating.
9. As a learner, I want a "Hide Definition" action, so that I can return to the pre-reveal state and quiz someone else.
10. As a learner, I want the reveal to animate gently (fade + rise), so that the change reads as an expansion, not a page swap.
11. As a motion-sensitive visitor, I want the reveal animation suppressed when my OS asks for reduced motion, so that the app doesn't trigger discomfort.
12. As a learner, I want a "Hear it" button that speaks the word aloud, so that I know how it's pronounced.
13. As a learner, I want the speaker icon to animate while the word is playing, so that I can tell the button worked.
14. As a learner on a device without speech support, I want the "Hear it" button hidden, so that I never tap a dead control.
15. As a learner, I want the respelling shown next to the word type, so that I can attempt the pronunciation myself.
16. As a learner, I want my level's colour carried through the word screen (level pill, primary button, example rule, synonym pills), so that the screen feels like my level.
17. As a learner on the word page, I want a "Yesterday" strip showing yesterday's word and type for my level, so that I can catch up on what I missed.
18. As a learner, I want the Yesterday strip hidden when no word exists for yesterday, so that I never see an empty placeholder.
19. As a learner, I want a back link ("Levels" / "All levels") from the word screen, so that I can switch levels easily.
20. As a visitor, I want a light/dark theme toggle in the top bar of every screen, so that I can read comfortably day or night.
21. As a visitor, I want my theme choice remembered across visits, so that I don't re-toggle every day.
22. As a first-time visitor, I want the theme to default to my system preference, so that the app opens looking right.
23. As a desktop visitor, I want the word screen as a two-column layout (word left, guess/entry card right) with the word staying put on reveal, so that reading is stable.
24. As a mobile visitor, I want the entry card to expand below the word (word shrinking 56px → 44px), so that the reveal fits the small screen.
25. As a tablet visitor, I want the desktop grid to collapse to one column below ~720px, so that the layout never breaks between sizes.
26. As a visitor with older cached words, I want the screen to render cleanly when a word has no type or respelling, so that pre-redesign data never breaks the page.
27. As a visitor using a keyboard or switch device, I want every interactive element to have hit targets ≥44px and visible states, so that the app stays operable.
28. As a visitor, I want hover feedback (level tints deepening, outline buttons filling), so that the interface feels responsive on pointer devices.
29. As the site owner, I want the design's tokens (paper/ink palette, OKLCH level colours, Newsreader/Nunito type scale, 2px borders, no shadows) implemented as the app's own styles, so that the app matches the handoff pixel-accurately in both themes.

## Implementation Decisions

**Data model**
- The word gains two new nullable fields: `wordType` (e.g. "adjective") and `respelling` (e.g. "ih·FEM·er·uhl"). Nullable columns via a Drizzle migration; **no backfill** — the UI omits missing pieces, and within days all displayed words have them.
- **Origin is dropped** from the design: the revealed entry card is Definition + Example (+ Synonyms) only; the desktop card omits the "Where it comes from" block.
- The wire contract (`WordOfTheDay`) and generator contract (`GeneratedWord`) gain the same two fields; the Anthropic generator's prompt and tool schema request them, and the fake generator supplies them.

**Yesterday**
- A new read-only tRPC procedure `yesterdayWord` takes a difficulty level and returns `{ word, wordType, definition }` for yesterday's word at that level, or null when absent. It **never triggers generation** — its handler has no generator seam.
- The Yesterday strip appears **only on the word page**, showing the current level's yesterday word — a deliberate deviation from the design frames, which also show it on the picker. Null → the strip is not rendered.
- The strip is **display-only** (not tappable) — the handoff's "opens the previous day's entry" interaction is deferred alongside the past-words feature.

**Theme**
- Client-only: a `data-theme` attribute on the document root drives CSS custom properties; the choice persists in localStorage and initialises from `prefers-color-scheme`.
- Design tokens (light + dark palettes, OKLCH level colours with hover steps, radii, the 2px-border signature, no shadows) come from the handoff's token tables and the reference HTML.

**UI**
- Typography: Newsreader (display, level names, definitions; italic for word type and examples) and Nunito (UI labels, buttons, badges), loaded via a Google Fonts link in the app's HTML shell — repo convention.
- Routes are unchanged: picker at the root, word page keyed by level. The word page owns the reveal state, which resets on level change.
- "Hear it" keeps the existing Web Speech module; the button gains the designed pill treatment (mobile pre-reveal), the 36px circular form (mobile revealed), and a playing state animating the speaker icon. Unsupported speech hides the button (existing guard).
- Reveal/hide is a 200ms ease-out fade + 8px rise, gated on `prefers-reduced-motion`.
- Icons stay inline stroked SVGs (arrow, chevron, speaker, sun, moon) in the app's own icon module.
- The desktop "W" mark was replaced with the mobile back-arrow button (deviation, decided at
  visual sign-off): the mark read as a wotd home link, but it links to the hub. The
  `WOTD Logo.png` file is ignored.

## Testing Decisions

Tests assert external behaviour only — what a visitor sees and what crosses the wire — never
component internals or style values.

- **Handler units** (prior art: the existing today-words handler tests): the new yesterday handler
  against PGlite/Store fake with a fixed clock — returns yesterday's word for the requested level;
  returns null when absent; never calls a generator.
- **Generator units** (prior art: the existing Anthropic generator parse tests): the extended tool
  schema and parsing of `wordType`/`respelling`; the fake generator emits them.
- **Whole-frontend `.iwft`** (prior art: the existing wotd iwft suite; seed via raw SQL at the
  harness's pinned date): guess-then-reveal and hide; level colour carry-through; theme toggle
  switching and persisting across reload; Yesterday strip rendered from a seeded yesterday row and
  absent otherwise; a word with null `wordType`/`respelling` rendering without either.
- **Visual fidelity is verified manually** — side-by-side against `WOTD - Dark Mode.html` in light
  and dark, at 390×720 and 1280×800. No screenshot-regression infrastructure.

## Out of Scope

- **Past words**: the desktop "Past words" pill is omitted entirely; no browsing of prior days.
- **Tappable Yesterday strip**: display-only; opening yesterday's entry arrives with past words.
- **Origin / "Where it comes from"**: dropped from the data model and the revealed card.
- **Generated audio files**: pronunciation stays Web Speech TTS; no `audioUrl`, no audio backend.
- **Backfill** of `wordType`/`respelling` for existing rows.
- **Yesterday strip on the level picker** (deviation from the design frames).
- **The `WOTD Logo.png` asset**: not used anywhere in this effort.

## Further Notes

- The handoff README in `reference/wotd-polish/` carries the full measurements (spacing, radii,
  type sizes, token tables); the reference HTML holds exact hover values. Treat the README as the
  measurement source and the Dark Mode HTML as the visual source of truth.
- The design is shadow-free; depth comes from 2px borders and tinted fills. Body copy uses
  `text-wrap: pretty`.
- Generation stays lazy and race-safe; nothing in this effort touches the generation flow beyond
  the two new generated fields.
