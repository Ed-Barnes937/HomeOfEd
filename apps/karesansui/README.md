# karesansui

枯山水 Karesansui — "Zen Gear Garden." A spirograph-as-zen-garden canvas toy:
assemble a gear train (a ring + up to 3 wheels), pick a rake head, and turn the
crank — a rake carves a hypotrochoid-family pattern into a circular sand bed,
rendered on canvas with carved-groove shading. Pure client-side compute, no
accounts, no server data. Lives at `karesansui.homeofed.com`.

The UI is a dark, quiet "room": the warm sand bowl is spotlit as the hero, a
smaller lit **mechanism** bowl sits beside it, and the controls dissolve into a
dim bottom console that brightens on hover and keyboard focus. See
[ADR 0019](../../docs/adr/0019-karesansui-architectural-redesign.md) /
[plan 0007](../../docs/plans/0007-karesansui-architectural-redesign.md). Original
design reference: `reference/karasensui/project/Zen Gear Garden Studio.dc.html`.

**No database** — see [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
The layered backend skeleton (tRPC → handler → `StatusStore`) is kept for
convention and the `.iwft` harness, but the frontend makes no tRPC calls; all
garden state lives client-side and presets persist to `localStorage`.

Three ways to run it, one router:

| Mode | Command | Persistence |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=karesansui` | in-memory `StatusStore` |
| .iwft | `pnpm test --filter=karesansui` | in-memory `StatusStore` |
| production | `pnpm build && pnpm start` | in-memory `StatusStore` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + a
process-liveness `/health`). See [`CLAUDE.md`](CLAUDE.md) for layout,
commands, and scoped rules.

## Features

- **Ring picker** — 3 annulus sizes (96 / 120 / 144 teeth).
- **Gear train** — dock up to 3 wheels; each adds a term to the pattern and a
  colour to the mechanism.
- **4 rake heads** — marble, wide, deep, fine — each a different tine count/
  spacing/groove-depth preset.
- **Tune popover** — a `Tune ▾` disclosure holding the pin-offset, speed, and
  rotations sliders. Offset shapes the pattern, speed sets the carve's pace
  (brisk ≈1.5s → meditative ≈31s), rotations caps how many carrier revolutions
  are drawn (a legible default, up to the pattern's true period).
- **Preview toggle** — a faint guide line under the uncarved bed.
- **Run / Pause** — carve the pattern; pause and resume mid-carve.
- **Smooth** — sweep the sand level again, ready for a fresh carve.
- **Save + Saved tray** — save up to 8 setups (persisted to `localStorage`);
  they appear in a slide-up tray at the bottom edge, load on tap, delete with ×.
- **Export PNG** — downloads the sand bed as `karesansui.png`.

Below ~760px the stage stacks to a single column, **sand hero first**, and the
Tune popover becomes a bottom sheet.

## Fidelity

The pattern math (`geom()`), rake/emboss shading, and `drawGear`/`drawRing`/the
multi-cog cluster are ported verbatim from the Studio reference for a
pixel-accurate match. The mechanism is **Level-2 pen-fidelity**: its pen rides
the *true* `geom()` point every frame (1 cog = an honest single-wheel
spirograph; 2–3 cogs = the illustrative cluster with an arm to the exact pen), so
the pen matches the sand groove's shape at a smaller scale. Full physical gearing
for multi-cog trains is still deferred. See
[ADR 0018](../../docs/adr/0018-karesansui-geometry-fidelity.md) (amended),
[ADR 0019](../../docs/adr/0019-karesansui-architectural-redesign.md), and the
plans [0006](../../docs/plans/0006-karesansui-implementation-plan.md) /
[0007](../../docs/plans/0007-karesansui-architectural-redesign.md).
