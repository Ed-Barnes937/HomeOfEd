# 0007 — karesansui: architectural redesign (dark room, minimal console, Level-2 coupling)

- **Status:** Implemented (2026-07-09) — ADR 0017 accepted, ADR 0016 amended.
- **Date:** 2026-07-09
- **Supersedes (in part):** [0006](0006-karesansui-implementation-plan.md) §1 D11 (single
  warm-light theme → single **dark** theme), and the layout/controls in §3–§4.
- **Related ADRs:** new **0017** (architectural redesign + dark single-theme);
  amend **[0016](../adr/0016-karesansui-geometry-fidelity.md)** (mechanism pen
  upgraded from decorative to Level-2 pen-fidelity).
- **Engine untouched:** `engine/*` (`geom`, `gears`, `rake`, `state`) and
  `render/sand.ts` + `SandRenderer` keep their ported math and warm sand look.
  The sand *is* sand — it stays warm and lit; only the room around it goes dark.

---

## 1. Goal

Refactor the existing karesansui app from its light 3-column "device" into the
**architectural framing** direction validated in the layout spikes: a dark, quiet
room; the warm sand bed spotlit as the hero with a smaller lit mechanism
companion beside it; and the controls dissolved into a **dim bottom console that
brightens on reach**. Additionally, upgrade the mechanism so its pen **rides the
real carved curve** (Level-2 pen-fidelity).

This is a **visual + interaction refactor**, not a rewrite. The engine/render
math, the `Store`/health skeleton, `settings.ts`, and `useRakeLoop`'s state
machine are reused. The churn is: tokens (dark), `KaresansuiPage` layout, the
control components (compact strip forms), two new UI pieces (Tune popover, Saved
tray), and `MechRenderer` (coupling).

### Success criteria

- `pnpm lint && pnpm typecheck && pnpm test --filter=karesansui` green.
- The app matches the architectural spike's mood: dark room, spotlit warm sand
  hero, lit mechanism companion, dim console that brightens on hover **and focus**.
- Controls follow the hybrid model; offset/speed/rotations live in a `tune`
  popover; saved gardens live in a bottom tray.
- The mechanism pen sits on the true `geom()` point at all times (visible during
  a carve as the pen leading the groove).
- A11y from the prior pass is preserved and re-tuned for dark (see §7).

---

## 2. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| **D1** | **Single dark theme** replaces the single warm-light theme. No light mode, no toggle. | The direction *is* the dark room; a light variant would be a different design. Supersedes 0006 D11 (which chose single warm-light). Still single-theme — just dark. |
| **D2** | **Hybrid controls.** Ring, cogs, rake operate **inline** in the console; offset, speed, rotations live behind a single **`tune ▾` popover**. | Keeps the periphery calm (the point of this direction) while everything stays one reach away. |
| **D3** | **Bottom saved-gardens tray.** Rake / Smooth as the action pair; Save + Export as icons; Preview line a tiny toggle; saved presets in a slim tray that slides up from the bottom edge, present only when presets exist. | Low-frequency surfaces stay out of the resting composition. |
| **D4** | **Level-2 pen-fidelity coupling.** The mechanism pen is placed on the true `geom()` point every frame. 1 cog → a true spirograph (ring + rolling wheel + pen). 2–3 cogs → a plausible gear cluster with an arm to the exact pen. | The pen (the thing being drawn) is always honest; the surrounding cluster stays illustrative for multi-term sums, per amended ADR 0016. Cheapest honest option. |
| **D5** | **Cogs capped at 3** (`MAX_GEARS = 3`, unchanged). | As before. |
| **D6** | **Preserve `data-testid`s** on all controls (`ring-<n>`, `wheel-<n>`, `train-chip-remove-<i>`, `rake-<id>`, `slider-offset\|speed\|rotations`, `run-button`, `smooth-button`, `save-button`, `export-button`, `preview-toggle`, `preset-<i>`, `preset-delete-<i>`, `sand-canvas`, `mech-canvas`, `karesansui-page`). | Minimises iwft churn; only the *steps to reach* a control change (open the tune popover, expand the tray), not the selectors. |
| **D7** | **Resting dim ≠ sub-threshold.** The "dim until hovered" console must, at rest, still meet AA contrast; hover/focus adds *emphasis* (brightness/opacity lift), it does not rescue legibility. | A calm look must not become an a11y regression. |
| **D8** | **Reveal on focus, not just hover.** Every hover-brighten also fires on `:focus-within` / `:focus-visible`; all controls are fully keyboard-operable while dim. | Hover-only affordances are inaccessible. |
| **D9** | **Engine + SandRenderer + `useRakeLoop` state machine unchanged**; `useRakeLoop` gains only the wiring to feed the mechanism its pattern + progress (D4). | Surgical. The carve/pause/smooth/resize logic already works and is tested. |

---

## 3. Design tokens (dark) — `src/styles/tokens.scss`

Replace the light palette. Fonts unchanged (Spectral + Instrument Sans, self-hosted).

```scss
:root {
  --font-serif: 'Spectral', serif;
  --font-sans: 'Instrument Sans', system-ui, sans-serif;

  // Room
  --room-bg: radial-gradient(90% 80% at 50% 34%, #2c231a 0%, #1c1712 55%, #120e0a 100%);

  // Ink on dark  (verify each ≥ AA on the room bg — see §7)
  --text:        #e8e0d0;  // primary
  --text-word:   #cbc0a8;  // wordmark
  --label:       #b3a992;  // console labels at REST — must pass AA (D7)
  --label-dim:   #93897a;  // faintest allowed resting text; nothing smaller/lighter
  --hairline:    rgba(255, 220, 170, 0.14);

  // Accent — the one colour. Amber.
  --accent:        #d9a24b;
  --accent-bright: #e6b45c;
  --accent-glow:   rgba(217, 162, 75, 0.5);

  // Sand bowl (warm, lit — unchanged spirit, restated for the dark frame)
  --sand-bowl-bg: radial-gradient(circle at 50% 40%, #c8975c 0%, #a5703f 60%, #6e4a29 100%);
  --sand-bowl-shadow:
    0 46px 80px -30px rgba(0, 0, 0, 0.85),
    inset 0 4px 12px rgba(255, 225, 180, 0.30),
    inset 0 -12px 30px rgba(40, 22, 8, 0.60),
    0 0 0 1px rgba(255, 210, 150, 0.08);

  // Mechanism bowl (lit companion)
  --mech-bowl-bg: radial-gradient(circle at 50% 40%, #3a2c1c 0%, #160f09 100%);
  --mech-bowl-shadow:
    0 0 40px -8px rgba(217, 162, 75, 0.22),
    inset 0 3px 14px rgba(0, 0, 0, 0.60);

  // Console surfaces
  --chip-line:   rgba(255, 220, 170, 0.22);
  --chip-on:     var(--accent);
  --focus-ring:  var(--accent-bright);   // ink outline is invisible on dark; use amber

  --radius-lg: 20px;
  --radius-md: 12px;
  --radius-sm: 10px;
}

body { background: var(--room-bg); color: var(--text); font-family: var(--font-sans); }
```

> **Focus treatment on dark:** the prior pass used `outline: 2.5px solid var(--ink)`.
> On the dark room that's invisible. Switch every control's `:focus-visible` to
> `outline: 2.5px solid var(--focus-ring); outline-offset: 2px;`. The slider thumb
> ring becomes `0 0 0 3px var(--accent-glow)`.

The gear colours (`gearPalette`, `shade`) and the sand groove shading
(`sand.ts`) are **unchanged** — sand and gears keep their ported look.

---

## 4. Layout — `KaresansuiPage.tsx` + `.module.scss`

```
main.room                         (full-height dark radial-spotlight)
 ├ header.wordmark                (centred, top)
 │   枯山水  ·  Karesansui — Zen Gear Garden      (Spectral 300, letter-spaced, dim)
 │
 ├ section.stage                  (the lit composition — flex row, centred, wraps)
 │   ├ figure.mechCompanion       (smaller — the mechanism bowl + "The mechanism" cap)
 │   │     canvas[data-testid=mech-canvas]  (aria-hidden)
 │   └ figure.sandHero            (larger — the spotlit sand bowl, the focal point)
 │         canvas[data-testid=sand-canvas]  (role=img, aria-label = patternLabel)
 │
 └ footer.console                 (dim; brightens on hover AND focus-within — D7/D8)
     ├ div.controls               (hybrid, inline)
     │    RingPicker(compact) · GearTrain(compact) · RakePicker(compact) · TuneButton · PreviewToggle(tiny)
     ├ div.actions
     │    ActionButtons → [ ▸ Rake the sand (amber primary) · ↺ Smooth · ⬇ Save · ⤓ PNG ]
     └ SavedTray                  (slim, bottom edge; slide-up; only when presets exist)
```

- **Focal hierarchy:** the sand hero is the largest, most-lit element; the
  mechanism companion is ~55–65% of its diameter; the console rests dim.
- **Asymmetry:** the stage is *not* mirror-symmetric — mechanism companion left,
  sand hero right-of-centre, wordmark centred but the composition weighted right.
  (Explicitly rejecting the old `312 / 1fr / 320` mirror.)
- **Responsive (< ~760px):** stage stacks **sand hero first**, mechanism below;
  console wraps to multiple rows; `TunePopover` renders as a **bottom sheet**;
  `SavedTray` spans full width. Keep sand-first order (matches prior D on reflow).
- **Reveal:** `.console { opacity: .72 } .console:hover, .console:focus-within { opacity: 1 }`
  as *emphasis only* — resting text colours already pass AA (D7). Respect
  `prefers-reduced-motion` on the opacity transition (instant, or omit).

---

## 5. Frozen contracts

### 5.1 `MechRenderer` — new coupling API (Phase 1)

Replace the progress-angle signature with a pattern-aware one. The mechanism owns
its **own** `geom()` fit to its bowl radius (so the pen path fills the mech bowl),
and places the pen on that curve at the current progress.

```ts
class MechRenderer {
  resize(cssSize: number, dpr: number): void;      // as today; re-fits cached geom if config set
  setPattern(config: GardenConfig): void;          // NEW: cache config + rebuild mech-scale geom (pen path)
  draw(progress: number): void;                    // CHANGED: was draw(config, carrierT)
  // progress ∈ [0,1]; t = geomCache.tMax * progress
}
```

`draw(progress)` renders, in order:
1. the static outer ring (`drawRing`, unchanged),
2. the **ghost** full pen path (faint) + the **active** path up to `progress`,
3. the gear(s):
   - **1 cog:** a true spirograph — a wheel of radius `W0` centred at the carrier
     position `((R−W0)·cos t, (R−W0)·sin t)` scaled to the bowl, spun by
     `−(R/W0)·t`, pen pinned **inside** the wheel at the real `geom` point,
   - **2–3 cogs:** the existing abstract cluster (`MechRenderer.ts:56–123`),
     re-centred, spun by `t`, with an **arm from the last cog to the true pen
     point** (`geomCache.pts` at the progress index, rescaled to the bowl). The
     cluster need not derive the point; the pen is exact.
4. the arm + pen dot (accent) + the rake-head indicator (marble vs tine bar,
   unchanged).

**Pen point source:** index `geomCache.pts` at `round(progress * (pts.length−1))`.
This is the same curve the sand carves (same `config`, `fullTurns`, `turns`),
only scaled to the mech bowl — so the pen visibly matches the sand groove's tip.

### 5.2 `useRakeLoop` wiring (Phase 1)

Only the mech calls change; the carve/pause/smooth/resize machine is untouched.

- On renderer init and on `applyConfig` **patternChanged**: call `mech.setPattern(next)`.
- Everywhere the loop currently calls `mech.draw(config, carrierT)` — `drawStatic`,
  `drawCarvedFinal`, `carveFrame` — call **`mech.draw(progress)`** instead
  (`drawStatic` → `mech.draw(0)`, `drawCarvedFinal` → `mech.draw(1)`, `carveFrame`
  → `mech.draw(progress)`). Reduced-motion carve (already implemented) calls
  `mech.draw(1)`.
- **Test seam (nice-to-have):** extend the sand seam or add a mech seam
  `getPenPoint(): [number, number]` returning the last-drawn pen point (mech
  coords), so an iwft can assert it advances during a carve (§8).

### 5.3 New/changed control components (Phases 2–3)

Props are **unchanged** where a component already exists — only markup/styles
change. New components get minimal, explicit props.

| Component | Status | Props (frozen) |
|-----------|--------|----------------|
| `RingPicker` | restyle → 3 compact dots | `{ ring, onChange }` (unchanged) |
| `GearTrain` | restyle → compact cog dots + add + remove | `{ wheels, onAdd, onRemove }` (unchanged) |
| `RakePicker` | restyle → 4 compact glyphs | `{ rake, onChange }` (unchanged) |
| `Slider` | restyle for dark; used inside Tune | unchanged |
| `PreviewToggle` | restyle → tiny toggle | unchanged |
| `ActionButtons` | rework → amber primary + Smooth + Save/Export icons | unchanged props |
| `SavedGardens` → **`SavedTray`** | rework → slide-up bottom tray | `{ presets, onLoad, onDelete }` (unchanged) |
| **`TuneButton` + `TunePopover`** | NEW | `TunePopover: { offset, speed, rotations, fullTurns, showPreview?, onOffset, onSpeed, onRotations }` — a disclosure (`aria-expanded`), Escape + outside-click close, focus returns to the button on close |

`KaresansuiPage` keeps holding `GardenConfig` in React state and driving
`useRakeLoop` via refs exactly as today; only the JSX tree (the console) changes.

---

## 6. Reference-porting map (what moves where)

| Today | Becomes |
|-------|---------|
| left column: wordmark + mech bowl + RingPicker + GearTrain | wordmark → centred header; mech bowl → `stage` companion; Ring/Gear → compact console controls |
| centre column: heading + sand bowl | sand bowl → `stage` hero; heading text retired (wordmark carries it) |
| right column: RakePicker + 3 Sliders + PreviewToggle + ActionButtons + SavedGardens | Rake → compact console; 3 Sliders → **TunePopover**; Preview → tiny toggle; Actions → amber primary + icons; SavedGardens → **SavedTray** |
| `mech.draw(config, carrierT)` (decorative) | `mech.draw(progress)` with pen on real curve (D4) |
| light warm tokens | dark room tokens (§3) |

---

## 7. Accessibility (carry forward + dark re-tune)

The prior a11y pass (focus states, canvas aria, contrast, tap targets, reduced
motion) must **survive** the refactor and be re-tuned for dark:

- **Contrast (re-verify on `--room-bg`):** `--text`, `--label`, `--label-dim`,
  and `--accent` used as text must each clear **4.5:1** at their rendered size.
  The resting-dim console text is `--label`/`--label-dim` at full colour — the
  `opacity: .72` wrapper must still leave them ≥ 4.5:1 (D7); if not, raise the
  resting opacity or the token, not the hover state.
- **Focus rings** switch to amber (`--focus-ring`) — ink is invisible on dark.
- **Focus-within reveal (D8):** `.console:focus-within` brightens; tabbing
  through the strip must light it up exactly as hover does.
- **Tune popover:** disclosure pattern — button `aria-expanded`/`aria-controls`;
  open moves focus into the panel; **Escape** closes and returns focus to the
  button; outside-click closes; the panel is not a focus trap but is reachable
  and dismissible by keyboard.
- **Saved tray:** the expand/collapse handle is a real `button` with
  `aria-expanded`; collapsed tray content is `hidden` (not just visually offset)
  so it's out of the tab order until opened.
- **Canvas aria unchanged:** sand `role="img"` + `aria-label={patternLabel}`;
  mech `aria-hidden="true"`.
- **Tap targets** ≥ 24px kept for the cog/preset delete affordances.
- **Reduced motion:** the existing carve/smooth jump-to-final stays; also make
  the console opacity reveal and tray slide instant under reduced motion.

---

## 8. Testing (TDD)

- **Unchanged & must stay green:** all `engine/*.test.ts`, `render/sand.test.ts`,
  `settings.test.ts`, `server/health.test.ts`.
- **`KaresansuiPagePom` updates** (selectors preserved per D6; only navigation changes):
  - `dragSlider(offset|speed|rotations)` first opens the Tune popover
    (`openTune()`), then drives the existing `slider-*` input.
  - preset assertions first expand the Saved tray (`openTray()`).
  - add `openTune()`, `closeTune()`, `openTray()`, and (nice-to-have)
    `verifyConsoleRevealsOnFocus()`.
- **New iwft scenarios:**
  1. Tune popover opens on click, closes on Escape (focus returns to button),
     closes on outside-click.
  2. Offset/Speed/Rotations still update their readouts (via the popover).
  3. Saved tray hidden when empty; appears + expands after Save; delete removes a pill.
  4. Console is keyboard-reachable and brightens on focus (D8).
  5. **Coupling:** during a carve the mech pen point advances (via the mech seam,
     §5.2) — or, minimally, assert the mech canvas is repainting in step with the
     sand seam's progress.
- **Retire/replace** any existing iwft that asserted the old 3-col→1-col reflow
  (`verifyColumnLayout`/`verifyStackedLayout`) with the new stage/console reflow
  assertions (sand-hero-first on narrow).

---

## 9. File tree (touched)

```
apps/karesansui/src/
  styles/tokens.scss                     REWRITE (dark palette §3)
  pages/KaresansuiPage.tsx               REWRITE (room/stage/console tree §4)
  pages/KaresansuiPage.module.scss       REWRITE
  features/garden/render/MechRenderer.ts CHANGE (coupling §5.1)
  features/garden/useRakeLoop.ts         CHANGE (mech wiring + seam §5.2)
  features/controls/RingPicker.*         RESTYLE
  features/controls/GearTrain.*          RESTYLE
  features/controls/RakePicker.*         RESTYLE
  features/controls/Slider.*             RESTYLE (dark)
  features/controls/PreviewToggle.*      RESTYLE
  features/controls/ActionButtons.*      REWORK (primary + icons)
  features/controls/SavedGardens.* → SavedTray.*   REWORK/RENAME
  features/controls/TuneButton.tsx + TunePopover.tsx (+ .module.scss)  NEW
  testing/KaresansuiPagePom.ts           UPDATE (navigation, new helpers)
  karesansui.iwft.tsx                    UPDATE (new scenarios §8)
  CLAUDE.md                              UPDATE (layout/controls section)
  README.md                              UPDATE
docs/adr/0017-karesansui-architectural-redesign.md   NEW
docs/adr/0016-karesansui-geometry-fidelity.md        AMEND (Level-2 pen-fidelity)
```

Untouched: `engine/*`, `render/sand.ts`, `render/SandRenderer.ts`, `settings.ts`,
`server/*`, `fly.toml`, `Dockerfile`, ports, CI, compose.

---

## 10. Phases (agent-splittable)

| Phase | Work | Owner | Depends on |
|-------|------|-------|-----------|
| **P0** | ADRs (0017 new; 0016 amend); dark tokens (§3); a bare room/stage/console skeleton (static, no controls wired) so the shell compiles | Sonnet | — |
| **P1** | `MechRenderer` Level-2 coupling (§5.1) + `useRakeLoop` wiring + mech seam; unit/iwft for pen tracking | **Opus** | P0 tokens |
| **P2** | Compact control restyles (Ring, Gear, Rake, Slider, Preview, ActionButtons) for dark + strip; **preserve testids** (D6) | Sonnet | P0 |
| **P3** | `TuneButton`/`TunePopover`, `SavedTray`, and `KaresansuiPage` console assembly + responsive reflow + hover/focus reveal | **Opus** | P2 |
| **P4** | A11y re-tune on dark (§7): contrast audit, amber focus rings, focus-within reveal, popover/tray focus mgmt, reduced motion; POM + iwft updates (§8) | Sonnet | P1, P3 |
| **P5** | Docs (`CLAUDE.md`, `README.md`), finalise ADRs, full verify loop, visual check in a real browser | Sonnet | all |

**Dependency graph:** P0 → (P1 ‖ P2) → P3 → P4 → P5.

**Verify loop (every phase):** `pnpm lint`, `pnpm typecheck`,
`pnpm test --filter=karesansui` — all green before handoff.

---

## 11. Risks & open questions

- **Contrast on dark (D7):** the "dim" resting console is the likeliest a11y
  regression. Mitigation: resting tokens must pass AA on their own; opacity is
  emphasis only. Audit in P4 with real values.
- **Mech pen scale mismatch:** the mech builds its own `geom` at its bowl radius;
  the *shape* matches the sand, the *size* differs. Intended — captions say "same
  curve", not "same size". Don't try to overlay them 1:1.
- **2–3 cog honesty:** the cluster is illustrative for multi-term sums (D4). If a
  future reviewer wants full physical honesty, that's the deferred "nested
  carriers" option — record it in the amended ADR 0016 as the next step.
- **Tune popover on mobile:** bottom-sheet variant adds layout work in P3; keep it
  a plain disclosure that repositions, not a separate component.
- **Test churn:** kept low by preserving `data-testid`s (D6); the reflow tests are
  the one deliberate replacement.

## 12. Out of scope

- Any engine/`geom` change, new rake types, or new ring/wheel options.
- Real physical gear simulation (nested carriers) — deferred (ADR 0016).
- Infra: ports, `fly.toml`, Dockerfile, CI, compose — all unchanged (the app's
  shape and subdomain don't change).
- Persistence/DB — still stateless (ADR 0008); presets stay in localStorage.
