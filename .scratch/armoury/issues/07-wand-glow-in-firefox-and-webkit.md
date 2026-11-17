# 07 - The wand's glow and wave trail look weaker in Firefox and WebKit

**Status:** needs-triage
**Type:** bug

Seen on 2026-11-17 while fixing the potion effect (armoury-potions ticket 28; sheet
`.scratch/armoury-potions/shots/28/sheet-wand-sword-2.png` in the `armoury-potions` worktree,
shot with `gpu-shots.mjs --browser=firefox|webkit`).

- The wand's spell burst shows in the air in all three browsers, with a smaller soft glow in
  Firefox and WebKit than in Chromium.
- The wave trail is a continuous glowing ribbon in Chromium and dotted in Firefox and WebKit.
  Not checked: it may only be the low frame rate of headless software rendering, since the
  trail is points laid down each frame.
- `src/stage/glow.ts` blends additively onto a transparent canvas, so it can leave colour
  above alpha, which WebKit drops where alpha is 0 in a live frame (the potion effect's
  fault; ADR 0111, "Alpha covers colour"). Held frames hide it in WebKit: judge from a live
  show, and on a real iPhone.
- The sword's glint sits on the opaque blade and looks the same in all three.
