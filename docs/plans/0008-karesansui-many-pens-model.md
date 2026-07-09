# 0008 — karesansui: "many pens, one garden" model (automated zen garden)

- **Status:** Implemented (2026-07-09) — all §9 decisions confirmed; shipped in PR #32 (ADR [0020](../adr/0020-karesansui-many-pens-model.md)).
- **Date:** 2026-07-09
- **Validated by:** the "Many pens" section of the layout-spikes artifact
  (draw → clearing-rake sweep → settle).
- **Supersedes (in part):** [0007](0007-karesansui-architectural-redesign.md)
  D4 (Level-2 single-pen coupling) and the summed-cosine sand model from
  [0006](0006-karesansui-implementation-plan.md). The dark room, console, and
  layout from 0007 are **kept**.
- **Related ADRs:** proposes new **0020** (many-pens garden model);
  **supersedes** the mechanism half of [0018](../adr/0018-karesansui-geometry-fidelity.md)
  (arm-chain → planetary marbles) and [0019](../adr/0019-karesansui-architectural-redesign.md) §mechanism.

---

## 1. Goal

Pivot the machine from *one summed pen* to a **traditional automated zen garden**:
each cog is a planet rolling inside the ring, and **each cog carries its own
single marble** that grooves **its own line** in the sand. Several quiet rosettes
layer into one bed. The multi-tine **rake head is retired** as a drawing tool and
reborn as an **optional clearing rake** — a comb that sweeps the bed smooth as it
passes, so the machine can draw and reset forever.

This changes **what the machine does**, not just how it looks:

| | Today (post-0007) | This plan |
|---|---|---|
| Adding a cog | enriches **one** summed curve | adds a **separate** groove |
| Sand math | `geom()` summed-cosine (one curve) | **N** independent single-wheel curves |
| The pen | one, at the epicycle-chain tip | **one marble per cog** |
| Rake | 4 multi-tine drawing heads | **retired**; reborn as an optional **clearing** comb |
| Mechanism | epicycle arm-chain to one pen | **planetary**: N cogs, each with a marble |

The dark room, wordmark, console, reflow, and a11y from 0007 are reused. The churn
is the **engine** (per-cog curves), **`render/sand.ts` + `SandRenderer`** (N grooves +
clearing sweep), **`MechRenderer`** (planetary), **`useRakeLoop`** (draw/clear loop),
**`state.ts`/`rake.ts`** (retire tine presets), and the **controls**.

### Success criteria

- `pnpm lint && pnpm typecheck && pnpm test --filter=karesansui` green.
- Adding a cog adds a visible, distinct groove; N cogs → N overlapping rosettes,
  spaced a turn/N apart, on a single flat sand bed.
- The pen is a single marble per cog (no tines); one groove per marble.
- The clearing rake, when enabled, wipes the bed smooth on a sweep and the
  marbles begin again; disabled, the pattern draws once and holds.
- The mechanism shows N cogs rolling in the ring, each carrying its marble.
- Presets from the old model load without error (migrated, see D9).

---

## 2. Decisions

All decisions below were **confirmed on 2026-07-09** (§9 records the choices).

| # | Decision | Rationale |
|---|----------|-----------|
| **D1** | **Independent planets, not compound.** Each cog `i` rolls in the ring on its own: `carrierAmp = R − wᵢ`, `a = offset·wᵢ`, `f = (R − wᵢ)/wᵢ`, and the whole rosette is rigidly rotated by `phaseᵢ = i·2π/N`. | Matches the spike the user preferred; uses math we already trust (each is an honest single-wheel spirograph); gives clean, layered, near-symmetric rosettes. Compound (cog-on-cog) is the alternative in §9. |
| **D2** | **Retire the summed-cosine sand model.** The sand is N single-wheel curves, not one summed curve. `geom()`'s summed form is no longer used for the sand (kept only if we keep a "classic" mode — see §9). | The pivot is a commitment; carrying both models doubles the surface. `geom()` for N=1 already equals one rosette, so single-cog output is unchanged. |
| **D3** | **The pen is a single marble.** Retire `rake.ts` tine presets (marble/wide/deep/fine). A groove is one stroke (shadow + highlight + core), not N parallel tines. Groove weight is a fixed style constant. | "Single line per cog" is the whole idea; tines belonged to the one-pen model. |
| **D4** | **Clearing rake is a separate, optional tool** (toggle). When **on**, `useRakeLoop` runs a perpetual **draw → sweep-clear → redraw** loop; when **off**, it draws once and holds (today's behaviour). Default: **off**. | Keeps the calm "draw once" default; the perpetual machine is opt-in. Reuses the spike's wedge-wipe + comb. |
| **D5** | **`Play` / `Clear` / `Download`.** Rename actions: "Rake the sand" → **Play**, "Smooth" → **Clear**, "Export PNG" → **Download**. `Clear` performs one clearing-rake pass (or an instant flatten under reduced motion). | The verbs match the new model and the minimal-toolbar direction. Folds in the earlier UI todo list. |
| **D6** | **Presets in a burger menu, with editable names.** Move the slide-up SavedTray into a **menu** (burger) opened from the console; each saved garden gets an **editable name** (rename inline) alongside load/delete. | The earlier UI todo; a menu scales better than a tray as saves grow. |
| **D7** | **Aggressively minimal console + single-colour bed.** The sand container is a **single flat colour** (drop the radial room-gradient behind the bed); the toolbar is inline `LABEL value` pairs with thin dividers + one pill `Play`. | Matches the "3rd spike" the user picked (Image #1). |
| **D8** | **Each cog runs its own full period; drop the `rotations` slider.** Each marble is drawn over `fullTurns(R,[wᵢ])`, normalised so all marbles complete together at carve end. | Complete rosettes read best; per-cog periods differ, so one global "turns" number is ambiguous. A global density cap is the §9 alternative. |
| **D9** | **Offset is global.** One `offset` slider scales every marble's pen radius (`aᵢ = offset·wᵢ`). Per-cog offset is deferred. | One knob keeps the console minimal; per-cog is additive later. |
| **D10** | **Cogs capped at 4 (was 3).** `MAX_GEARS`. | Four legible rosettes is a rich ceiling; more crowds the bed. Keep 3 if preferred. |
| **D11** | **Preset schema v2 + migration.** Bump the localStorage key/schema; on load, migrate v1 presets by dropping `rake`/`turns` and keeping `ring`/`wheels`/`offset`. | Old saves must not break; the retired fields are simply ignored. |
| **D12** | **Preserve `data-testid`s** where the concept survives (`ring-<n>`, `wheel-<n>`, `train-chip-remove-<i>`, `slider-offset`, `run-button`→`play`, `sand-canvas`, `mech-canvas`, `save-button`, `export-button`→`download-button`, `preset-<i>`, `preset-delete-<i>`). New: `clearing-rake-toggle`, `preset-rename-<i>`, `presets-menu`. Retire `rake-<id>`, `slider-rotations`. | Minimise iwft churn; only add/retire where the model genuinely changes. |

---

## 3. Engine — `features/garden/engine/`

Pure TS, no DOM/canvas. New per-cog curve builder; `geom()` kept for reference/N=1
equivalence but no longer the sand's source of truth.

### `garden.ts` (new) — one curve per cog

```ts
export interface CogCurve {
  w: number
  pts: [number, number][]
  tMax: number
  full: number
}
export interface Garden {
  curves: CogCurve[]
  scale: number          // shared fit factor across all cogs
}

// One rigidly-rotated single-wheel rosette per cog, all on a common scale.
export function gardenCurves(config: GardenConfig, boardR: number): Garden
//  for each wheel wᵢ (i, N = wheels.length):
//    carrierAmp = R − wᵢ ;  a = offset·wᵢ ;  f = (R − wᵢ)/wᵢ ;  phase = i·2π/N
//    raw(t) = rotate( [carrierAmp·cos t + a·cos(f·t),  carrierAmp·sin t − a·sin(f·t)], phase )
//    tMaxᵢ = 2π · fullTurns(R, [wᵢ]) ;  sample nᵢ ∈ [400, 8000]
//  scale = boardR / (maxReachᵢ · 1.03),  maxReachᵢ = carrierAmp + a  (shared, so relative sizes are true)
```

- **N = 1 ⇒ identical to today's single wheel** (phase 0, one rosette) — free continuity + a regression anchor.
- `normals()` stays for groove shading (applied per curve).
- Unit tests: point counts clamped; N=1 equals `geom()`-single; shared scale fits all cogs; phase spacing is `2π/N`.

### `state.ts`, `gears.ts`, `rake.ts`

- `GardenConfig`: **drop `rake`** (and `turns` if D8 confirmed). Keep `ring`, `wheels`, `offset`, `showPreview`, add `clearingRake: boolean`.
- `gears.ts`: `MAX_GEARS = 4` (D10); `gearPalette` reused to tint each cog's mechanism gear.
- `rake.ts`: **removed** (or reduced to a single groove-weight constant). Its tests go with it.

---

## 4. Render — `features/garden/render/`

### `sand.ts` + `SandRenderer`

- Draw a **flat single-colour bed** (D7), then **one groove per cog** (shadow + highlight + core stroke, from the spike). No tine loop.
- Carve animation: advance all N grooves together by `frac`; each marble ball drawn at its groove tip.
- **Clearing sweep** (new): `clearTo(sweep)` — clip a growing wedge and re-fill it with the bed colour (wiping grooves behind the comb), then draw the comb at the leading edge. `toDataURL()` unchanged (Download).

### `MechRenderer` — planetary

- Replace the epicycle arm-chain with **N cogs** at `carrierAmp·scale` (scale = `mechR/ring`), spaced `2π/N`, each drawn with `drawGear` + a spoke to its **marble**. Ring unchanged. Retire `drawArmChain`/`drawSingleWheel`/`drawCluster`.

---

## 5. Loop — `useRakeLoop.ts`

Reuse the rAF + resize skeleton; change the state machine to the model:

- `rebuild(size)` → `gardenCurves(config, boardR)`; push into both renderers.
- **Play**: draw all grooves over the speed-derived duration (as today's carve, but N grooves).
- **Clearing rake on**: after a draw completes, run a sweep-clear phase, then restart — perpetual. Pause/resume still work.
- **Clearing rake off**: draw once, hold (today's behaviour).
- **Clear** (button): run one sweep-clear pass (reduced motion → instant flatten).
- Reduced motion: draw lands complete; clear flattens instantly; no perpetual loop.
- Test seam: keep `getProgress`/`isCarved`; add `getMarblePens(): [number,number][]` (was `getMechPen`) so the iwft can assert per-cog coupling.

---

## 6. Controls — `features/controls/` + `KaresansuiPage`

Minimal console (D7); one pill `Play`. Row of inline groups with thin dividers:

| Control | Behaviour | testid |
|---|---|---|
| **Ring** | 96 / 120 / 144, inline | `ring-<n>` |
| **Cogs (gear train)** | add/remove up to `MAX_GEARS` (4); **each cog is a pen** — the label reads "N cogs · N marbles" | `wheel-<n>`, `train-chip-remove-<i>` |
| **Offset** | one global slider (Tune popover or inline) — scales every marble | `slider-offset` |
| **Speed** | draw pace (brisk↔meditative), Tune popover | `slider-speed` |
| **Clearing rake** | toggle; on ⇒ perpetual draw-and-reset | `clearing-rake-toggle` |
| **Preview** | faint ghost of all N paths | `preview-toggle` |
| **Play** | start/pause the draw | `play` (was `run-button`) |
| **Clear** | one clearing pass | `clear-button` (was `smooth-button`) |
| **Save** | save current garden | `save-button` |
| **Download** | PNG of the bed | `download-button` (was `export-button`) |
| **Presets (burger)** | menu of saved gardens; load / **rename** / delete | `presets-menu`, `preset-<i>`, `preset-rename-<i>`, `preset-delete-<i>` |

Retired: `rake-<id>`, `slider-rotations`, the `RakePicker` component, the `SavedTray` (→ menu).

---

## 7. Migration & compatibility

- **Presets:** schema **v2** (`karesansui:presets:v2`). On first load, read v1, map `{ring, wheels, offset}` → v2 (drop `rake`, `turns`), write v2. One-way, lossy for the retired fields; documented in `settings.ts`.
- **Backend skeleton** (tRPC → handler → `StatusStore`) unchanged — still stateless (ADR 0008).

---

## 8. Phases (TDD; each ends green)

- **P0 — Engine.** `gardenCurves()` + tests (N=1 ≡ `geom()`-single; shared scale; phase spacing). Drop `rake.ts`, adjust `state.ts`/`gears.ts`.
- **P1 — Sand.** Flat bed + N grooves + marbles; carve over all; `SandRenderer` tests via existing harness.
- **P2 — Clearing rake.** `clearTo(sweep)` + comb; `useRakeLoop` draw/clear/perpetual loop; reduced-motion paths.
- **P3 — Mechanism.** Planetary `MechRenderer` (N cogs + marbles + spokes).
- **P4 — Controls.** Play/Clear/Download rename; clearing-rake toggle; global offset; cog train to 4; burger presets menu + rename; drop RakePicker/rotations; minimal console + single-colour bed.
- **P5 — Presets v2** migration + `settings.test.ts` round-trip + v1→v2 test.
- **P6 — iwft + POM.** Multi-groove carve advances; per-cog `getMarblePens` coupling; clearing-rake loop; preset rename/migration; console/reflow reused.
- **P7 — Docs.** ADR 0020; update `apps/karesansui/CLAUDE.md` + `README.md`; set this plan **Implemented**; note 0018/0019 superseded parts.

---

## 9. Resolved decisions (confirmed 2026-07-09)

1. **Compound vs independent** (D1): **independent planets** (the spike direction).
2. **Clearing rake default** (D4): **off** (draw-and-hold; perpetual is opt-in).
3. **Rotations** (D8): **drop the slider** — each cog runs its full period.
4. **Offset** (D9): **global** one-knob (per-cog deferred).
5. **Max cogs** (D10): **4**.
6. **Classic summed mode** (D2): **fully replace** the summed-cosine; not selectable.
7. **Groove control:** **fixed constant** — no user control over depth/weight.
