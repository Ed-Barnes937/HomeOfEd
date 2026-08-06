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

**Status:** claimed

- [ ] Preset row visible on load; blank canvas is the first item
- [ ] The three named starter grooves authored against the launch kit —
      each genuinely groovy and tweakable (consider seeding some with
      obvious empty space to fill)
- [ ] Dot-matrix pattern thumbnail per preset, per the design
- [ ] Loaded card shows the cyan ring; the ring drops on first edit
- [ ] Tapping a preset loads it, ready to play — no confirmation, no wizard
- [ ] App still opens on an empty grid; loading a preset never destroys a
      saved groove (working grid only)
- [ ] Whole-frontend test: load preset → play; tap blank → empty grid
