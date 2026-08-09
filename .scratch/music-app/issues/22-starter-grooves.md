# 22 — Starter-groove preset row

**What to build:** The onboarding. A visible row of 3–4 named preset grooves
with the blank canvas presented as the first item. The app opens on an empty
grid with this row visible (no first-load seeding); tapping a preset drops it
into the grid ready to play and tweak. Each preset previews its pattern shape
as a tiny thumbnail alongside a playful name.

**Design:** the handoff (`docs/reference/boop-design/README.md`) fixes the
card order and names — **Blank, Wonky Walk, Robot Hiccup, Sunday Stomp** —
card styles with the cyan loaded-state ring, the 16×6 dot-matrix thumbnail
(active dots take the row's instrument colour; blank still shows the grid
shape), the load stagger (24ms per column, arriving over two beats), and
that `activePreset` goes back to unloaded on the first user edit.

**Blocked by:** 13 — First sound grid; 18 — Launch kit content (presets must
sound good on the real kit).

**Status:** resolved — placement and two rules superseded by
[36](36-new-boop-dialog.md) / [31](31-saved-state-visibility.md)

> **Superseded 2026-08-07 (V1.1 feedback, grilled with Ed).** Three things below
> change:
> 1. **Placement.** The preset row leaves the main screen for a "New boop" dialog
>    opened from the sticky bottom bar — [ticket 36](36-new-boop-dialog.md).
> 2. **"App opens on an empty grid; no first-load seeding."** Reversed: a fresh
>    browser is seeded with **Wonky Walk**, so content still does the onboarding
>    now the row is behind a button (ticket 36). Blank stays first in the dialog,
>    but as the "start fresh" affordance rather than as void-avoidance.
> 3. **"The ring drops on first edit but not on a tempo change."** That exemption
>    is removed by [ticket 31](31-saved-state-visibility.md), so boop has one
>    definition of "changed"; the ring becomes internal to the dialog.
>
> "Groove" is renamed to "Boop" throughout by [ticket 35](35-rename-groove-to-boop.md).

- [x] Preset row visible on load; blank canvas is the first item
      *(placement superseded — see above)*
- [x] The three named starter grooves authored against the launch kit —
      each genuinely groovy and tweakable (consider seeding some with
      obvious empty space to fill)
- [x] Dot-matrix pattern thumbnail per preset, per the design
- [x] Loaded card shows the cyan ring; the ring drops on first edit
- [x] Tapping a preset loads it, ready to play — no confirmation, no wizard
- [x] App still opens on an empty grid; loading a preset never destroys a
      saved groove (working grid only)
      *(the empty-grid half superseded — see above; the saved-boop half stands)*
- [x] Whole-frontend test: load preset → play; tap blank → empty grid

## Comments

Resolved 2026-08-06 (agent, Sonnet). Landed in `7d24d7f` on `music-app`.
"Starters" row below the transport bar: Blank, Wonky Walk (92 BPM, off-beat
kick walk, marimba left empty), Robot Hiccup (118 BPM, straight-8th hat +
syncopated kick, boop left empty), Sunday Stomp (104 BPM, four-on-the-floor
stomp-clap). Dot-matrix 16x6 thumbnails in row colours; cyan loaded ring;
24ms/column load stagger (reuses edit-pop with per-column delay — the
ticket's sanctioned option; delay map keyed per on-streak so playhead
repaints can't cut it short). Choices: presets carry tempo; ring drops on
cell toggle and clear-all but NOT tempo change; blank clears via the load
path. Code review caught a real rule violation pre-commit: preset data had
hardcoded instrument ids — reauthored as position-only rows resolved
against the loaded kit (`presetPattern(kit, preset)`), matching the repo's
"nothing outside the manifest enumerates instrument ids" rule.
Gate re-verified by orchestrator: lint/typecheck clean, vitest 108/108 at
commit (139 post-merge), playwright CT 20/20 (23 post-merge).
