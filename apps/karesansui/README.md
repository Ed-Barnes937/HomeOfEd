# karesansui

枯山水 Karesansui — "Zen Gear Garden." A spirograph-as-zen-garden canvas toy:
assemble a gear train (a ring + up to 3 wheels), pick a rake head, and turn the
crank — a rake carves a hypotrochoid-family pattern into a circular sand bed,
rendered on canvas with carved-groove shading. Pure client-side compute, no
accounts, no server data. Lives at `karesansui.homeofed.com`. Design reference:
`reference/karasensui/project/Zen Gear Garden Studio.dc.html`.

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
  colour to the mechanism cluster.
- **4 rake heads** — marble, wide, deep, fine — each a different tine count/
  spacing/groove-depth preset.
- **Pin offset, speed, and rotations sliders** — offset shapes the pattern,
  speed sets the carve's pace (brisk ≈1.5s → meditative ≈31s), rotations caps
  how many carrier revolutions are drawn (defaults to a legible cap, up to the
  pattern's true period).
- **Preview toggle** — a faint guide line under the uncarved bed.
- **Run / Pause** — carve the pattern; pause and resume mid-carve.
- **Smooth** — sweep the sand level again, ready for a fresh carve.
- **Save / load / delete presets** — up to 8, persisted to `localStorage`.
- **Export PNG** — downloads the sand bed as `karesansui.png`.

Below ~900px the 3-column layout (mechanism · sand · rake controls) reflows to
a single column, sand first, with no drawer or collapse — everything stays on
screen.

## Fidelity

The pattern math (`geom()`), rake/emboss shading, and the mechanism drawing
are ported verbatim from the Studio reference for a pixel-accurate match. The
mechanism panel is illustrative — it does not model true gear meshing. See
[ADR 0016](../../docs/adr/0016-karesansui-geometry-fidelity.md) and the
implementation plan,
[0006-karesansui-implementation-plan.md](../../docs/plans/0006-karesansui-implementation-plan.md).
A **V2** with a physically-accurate gear-train engine is deferred — see the ADR.
