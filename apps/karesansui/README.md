# karesansui

枯山水 Karesansui — "Zen Gear Garden." An automated zen-garden canvas toy:
assemble a gear train (a ring + up to 4 cogs) and press Play — each cog is a
planet rolling in the ring carrying its own single marble, and each marble
grooves its own line into a circular sand bed, rendered on canvas with
carved-groove shading. N cogs → N overlapping rosettes ("many pens, one garden"
— [plan 0008](../../docs/plans/0008-karesansui-many-pens-model.md) /
[ADR 0020](../../docs/adr/0020-karesansui-many-pens-model.md)). Pure client-side
compute, no accounts, no server data. Lives at `karesansui.homeofed.com`.

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
- **Gear train** — dock up to 4 cogs; **each cog is a pen** — it adds its own
  groove to the bed and its own gear + marble to the mechanism.
- **Tune popover** — a `Tune ▾` disclosure holding the global pin-offset and
  speed sliders. Offset scales every marble; speed sets the draw's pace
  (brisk ≈1.5s → meditative ≈31s). Each cog runs its full period.
- **Clearing rake** — a toggle; when on, the machine draws, sweeps the bed
  smooth, and draws again forever. Off by default (draw once and hold).
- **Preview toggle** — a faint guide line of every cog's path under the bed.
- **Play / Pause** — draw the pattern; pause and resume mid-draw.
- **Clear** — one clearing-rake pass, sweeping the sand level again.
- **Save + presets menu** — save up to 8 setups (persisted to `localStorage`);
  they appear in a burger menu, load on tap, rename inline (✎), delete with ×.
- **Download** — downloads the sand bed as `karesansui.png`.

Below ~760px the stage stacks to a single column, **sand hero first**, and the
Tune popover becomes a bottom sheet.

## Fidelity

The single-wheel spirograph maths (`gardenCurves`), the groove/marble/bed
drawing, and `drawGear`/`drawRing` follow the Studio reference. The model is
**many pens, one garden** ([ADR 0020](../../docs/adr/0020-karesansui-many-pens-model.md)):
each cog is an independent planet carrying one marble, and the mechanism draws N
cogs + marbles — every marble sits on its own gear. The earlier summed-cosine
`geom()` and epicycle arm-chain are retired (superseded parts of ADR 0018/0019);
`geom()` survives only as the N=1 reference. Full physical cog-on-cog compound
gearing is a possible future model. See the plans
[0006](../../docs/plans/0006-karesansui-implementation-plan.md) /
[0007](../../docs/plans/0007-karesansui-architectural-redesign.md) /
[0008](../../docs/plans/0008-karesansui-many-pens-model.md).
