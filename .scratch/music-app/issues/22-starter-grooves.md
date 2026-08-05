# 22 — Starter-groove preset row

**What to build:** The onboarding. A visible row of 3–4 named preset grooves
with the blank canvas presented as the first item. The app opens on an empty
grid with this row visible (no first-load seeding); tapping a preset drops it
into the grid ready to play and tweak. Each preset previews its pattern shape
as a tiny thumbnail alongside a playful name.

**Blocked by:** 13 — First sound grid; 18 — Launch kit content (presets must
sound good on the real kit).

**Status:** ready-for-agent

- [ ] Preset row visible on load; blank canvas is the first item
- [ ] 3–4 named starter grooves authored against the launch kit — each one
      genuinely groovy and tweakable (consider seeding some with obvious
      empty space to fill)
- [ ] Tiny pattern thumbnail per preset
- [ ] Tapping a preset loads it, ready to play — no confirmation, no wizard
- [ ] App still opens on an empty grid; loading a preset never destroys a
      saved groove (working grid only)
- [ ] Whole-frontend test: load preset → play; tap blank → empty grid
