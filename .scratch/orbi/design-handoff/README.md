# Handoff: orbi — visual direction & design language

## Overview
orbi is a planet tamagotchi for kids (~11): build a planet from dials, fast-forward time, watch life emerge and climb a ladder of chapters (bare rock → seas → first life → blobs → city lights + rocket). A robot-satellite Mission Control character narrates from a side panel. Full concept lives in the project spec (wayfinder session 2026-08-18).

This handoff captures the **chosen visual direction ("Flight Console")** and the exploration that led to it.

## ⚠ How to read these designs
These mocks show a **design language and a set of "how might we"s — not a feature list.** Screens, HUD readouts, decorative life details (blob families, fireflies, census tickers, comet timing, plant growth stages) are illustrations of tone and possibility. Which features actually ship is decided in technical planning, not here. Treat anything not in the spec as optional inspiration.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. Recreate them in the app's real environment (HomeOfEd stack: TypeScript + npm libraries). The three.js file is the exception: its *techniques* (not the code itself) are directly reusable.

## Fidelity
- **Turns 1–2 (`orbi directions.dc.html`)**: high-fidelity static mockups. Colors, type, spacing and copy voice are intentional. Layout is directional, not pixel-sacred.
- **Turn 3 + `orbi-three.js`**: live WebGL *proof-of-technique* sketches — deliberately rough geometry, correct mood.

## The chosen direction: 1d "Flight Console"
Picked by the co-designer from five directions (turn 1 in the HTML file — kept for reference).

- Near-black space: `#04060c` (surface view sky: `#060910`)
- One accent: cyan `#7fd8e8`, used at low opacities for chrome (`rgba(127,216,232,.35)` borders, `.18–.25` hairlines)
- Text: `#e8f4f6`; dim text `rgba(232,244,246,.35–.75)`
- Panels: `rgba(6,10,18,.85)` with 1px cyan borders. **Square corners everywhere. No rounded chrome, no shadows on chrome.**
- Type: **IBM Plex Mono** only (400/600). Labels 9.5–11px with 2px letter-spacing; body 12.5px; titles 20–24px. All-caps chrome; sentence case only inside Mission Control speech.
- Buttons are bracketed text: `[ OPEN ]`, `[ ESC ] SHELF`, `[ HINT 1 OF 2 ]`. Primary = solid cyan fill with `#04060c` text; secondary = cyan border + cyan text.
- The planet carries ALL the color; chrome stays monochrome and deadpan.
- Mission Control voice: deadpan scientist. Facts first, dry humor second. e.g. "Blobs: 12. They wobble. Wobbling is normal."

## Screens (turn 2 of the HTML file)
- **2a Planet shelf** — roster list: 54px planet thumbnail (radial-gradient sphere), name + chapter, telemetry column, last-seen column, `[ OPEN ]`. Active row gets a 3px cyan inset edge. Search field top right. Dashed-border `[ + NEW PLANET ]` row. Footer: UNIT-7 reminding planets only run while watched.
- **2b Builder** — live planet preview left; right column: name field with `[ ↻ NEW NAME ]`, DIALS panel (SIZE / DISTANCE FROM SUN / WATER / ATMOSPHERE as thin 2px sliders with square handles and value readouts like "1.6 AU · CHILLY"), LOOKS panel (colour swatches, pattern segmented buttons, moons stepper, rings toggle), then `[ ⚄ RANDOMISE ]` + `[ START TIME → ]`. UNIT-7 gives a recipe *forecast*, never a prescription.
- **1d / 2e Orbit view** — planet centered with crosshair ticks + orbit ring; header = name, chapter, orbit-day; Mission Control panel right (telemetry rows + speech + `[ HINT 1 OF 2 ]`); toolkit buttons bottom-left (`[ ORBIT ⇅ ] [ ATMOS ⁿ ] [ COMET ❆ ] [ SEED ❧ ]`); time rate bottom-right (− ×1000 +). 2e shows chapter 5: night-side city lights + tiny rocket with a `ROCKET 01 OUTBOUND` annotation.
- **2c Surface view (zoomed in)** — horizon curve fills the bottom; life decorations (see below); Mission Control collapses to an edge tab on the right; minimal TIME pill bottom-left; `[ ↑ BACK TO ORBIT ]` top-right.
- **2d Postcard** — cream card `#f0ead8`, rotated −1.5°, planet photo left, "GREETINGS FROM SPLODGE" in mono, dashed stamp starring UNIT-7, telemetry strip footer (chapter, lights on, population, weather). Export = `[ SAVE PICTURE ]` / `[ PRINT ]`.

## "More life" ideas (2c decorations — all how-might-we, all cheap)
Blob family with footprints; blob swimming badly in the pond (ripple rings + label); sprout clusters; drifting cloud + rain + cloud shadow; fireflies at dusk; census ticker in the header (`COVERAGE 34% ▲ · BLOBS: 12 ▲`). Unmocked but discussed: blobs reacting to the cursor, day/night line sweeping the surface, blobs gathering at the last thing you touched, a sleeping blob, eggs.

## three.js techniques proven in `orbi-three.js` (turn 3)
- **Planet**: canvas-generated texture (seeded-random continent blobs) on a sphere; **city lights as an emissive map** — gated to the night side via `onBeforeCompile` (emissive × smoothstep of world-normal · sun-direction). Sun light orbits so the terminator sweeps and lights wink on.
- **Atmosphere**: back-side fresnel shader sphere, additive blending.
- **Comet impact**: head + additive cone tail lerping in, then an expanding additive flash sphere + temporary point light.
- **Surface**: displaced plane + canvas ground texture; blobs = squashed spheres with sphere eyes, hop via `|sin|`, wander in circles; plants grow **sprout → fern → tree** by scaling three stage-groups on staggered clocks (smoothstep easing).
- Drag-to-rotate is hand-rolled pointer events (no OrbitControls) — keeps three.js loadable as a single module URL.

## Design tokens
Colors: `#04060c` bg · `#060910` surface-sky · `#7fd8e8` accent · `#e8f4f6` text · panel `rgba(6,10,18,.85)` · postcard cream `#f0ead8` / ink `#282c3c` · city lights `#ffd9a0` · blob greens `#9fd66a #8ed96a #b8e86a` · life green `#1e8f6a/#37c795` · sand `#e8c97a` · rock `#96714b/#7d5c3c` · pond `#4a8fb8/#3a7297`.
Spacing: 32px page margins (40px on shelf), 10–14px inside panels, 10px gaps between buttons. Radius: 0 on all chrome (only planets/blobs/organic things are round). Type scale: 9.5 / 10.5 / 11.5 / 12.5 / 16 / 20–24px, IBM Plex Mono.

## Mission Control character: UNIT-7 ("Toaster")
Boxy body, two cyan eyes on a screen face, riveted solar-panel wings, one antenna. In this direction it's rendered as wireframe-style outlines in chrome contexts and as a tiny inked robot on the postcard stamp. Name candidates from other directions: BOLT, Aster, Bleep, Twink — the co-designer picks; "UNIT-7, but the crew calls it Toaster" was the Flight Console framing.

## State (implied by the mocks, for reference only)
Per planet: name, dials (size, sun distance, water, atmosphere, colour, pattern, moons, rings), chapter (1–5), life type (ice/volcano/storm/classic green), telemetry (surface °C, pressure, water state, life state, counts), orbit day, last-visited. Global: planet list + search, time rate, hint ladder step (0/1/2), Mission Control collapsed state, music on/off.

## Assets
No external assets. All imagery is CSS/canvas/three.js generated. Fonts from Google Fonts: IBM Plex Mono (400, 600) — the other families in the HTML head belong to the unchosen turn-1 directions.

## Files
- `orbi directions.dc.html` — all mockups. Turn 3 (top) = live 3D sketches; turn 2 = chosen-direction screens; turn 1 = the five original directions (1d won).
- `orbi-three.js` — the live three.js planet + surface components.
- `support.js` — prototype runtime; ignore, not part of the design.
- `spec.md` content is in the project brief; the spec is the source of truth for features, this bundle for look and feel.
