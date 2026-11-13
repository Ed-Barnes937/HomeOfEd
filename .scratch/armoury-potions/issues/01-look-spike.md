# 01 - Look spike: one hero bottle, one contact sheet (DO NOT MERGE)

**Status:** ready-for-human (the sheet is at `shots/01/contact-sheet.png`; waiting for Ed to pick)
**Type:** spike
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none
**Parallel with:** 02, 03, 04
**Model:** opus
**Gate:** Ed's pick
**ADR:** none (Ed's pick is recorded in `decisions.md` by the orchestrator and carried into
ADR 0109 by ticket 10)
**Dev port:** 3031

## Goal

Settle the potion's look on one item before anything else is built for it ("Settle the look on
one item first", `apps/armoury/CLAUDE.md`). Build one hero bottle with fake glass, layered level
liquid, glitter, a bounded glow and moody light, shoot it on the real GPU with the liquid's time
frozen, solve or show the share-card capture problem, and end with ONE contact sheet of labelled
alternatives for Ed to pick from. Nothing here merges: ticket 10 lifts the winner.

## Branch

`spike/potion-look-do-not-merge`, from `armoury-potions`, in your own worktree. Every commit
message starts `DO NOT MERGE: `. Never merged, never pushed unless the orchestrator asks; the
branch is kept until ticket 10 is done.

## Read first

- `spec.md`: "The look and the scene, in words", "Accessibility and reduced motion" (the motion
  rules), "Rules for the team" (3, 12, 13, 15).
- `/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/research/experience-options.md`:
  "Rendering: what is cheap, what is expensive, what is a trap" (all of it), Option 2.
- `decisions.md` (same folder): E5, O6.
- `apps/armoury/CLAUDE.md`: the rules on uniforms, motion, the stage seam, tone mapping.
- ADRs 0082, 0083 (glow under the cap), 0099 (how the smithy's environment and tone mapping
  were settled), 0100 (the bounded bloom exception).
- Source: `src/stage/Gems.tsx` (the fake glass to copy), `src/stage/glow.ts`,
  `src/stage/gemGlow.ts`, `src/stage/smithyScene.tsx` (environment, lightformers, AgX),
  `src/stage/boxRig.tsx` (`captureScene`), `src/share/shareCard.ts` and `src/share/smithyCard.ts`
  (how a capture lands on the card), `scripts/gpu-shots.mjs` (browser launch flags, the probe
  hold pattern).

Paths are relative to `apps/armoury/`.

## Scope

1. **A dev-only spike page** on the branch: `src/spike/PotionLookSpike.tsx` mounted at
   `/spike/potion` in `router.tsx` (outside `PlayerView`), all three.js inside
   `src/stage/spike/*.tsx`. Query params pick the alternatives:
   `?glass=G1&liquid=L1&light=M1&tilt=0&freeze=1.2&view=box|close&capture=P1`.
2. **The hero bottle:** a teardrop flask about 140 mm tall with a 30 mm neck, from
   `THREE.LatheGeometry` (fine in a spike; the real generator is ticket 06), a cork, a round paper
   label. Three pours, bottom first: Moonmilk (cloud), Rosehip syrup (swirl), Starpetal (glitter),
   colours from the spec's ingredient table. One extra tile swaps the top for Emberroot (glow).
3. **Glass:** the `Gems.tsx` approach (`MeshPhysicalMaterial`, clearcoat, low roughness, the
   environment, an emissive fresnel rim in `onBeforeCompile`), back faces then front faces with
   the liquid between, `depthWrite: false`, explicit `renderOrder` (glass back 1, liquid 2,
   particles 3, glass front 4). No `transmission`.
4. **Liquid:** an inner mesh 0.3 mm inside the glass's inner wall; the fragment shader discards
   above a world-space level plane and caps the cut with back faces in the surface colour; bands
   by height with a soft edge; cloud, swirl (domain-warped noise) and glitter (a few hundred
   instanced points culled at the plane); glow as a bounded emissive under
   `0.92 * BLOOM_THRESHOLD`. A `uTime` uniform written through the material (never R3F props),
   frozen by `?freeze=<s>`. Show the level staying level at `?tilt=30` (the band boundaries may
   be approximate in the spike; say how far off they are).
5. **Light and mood:** candlelit and dim, the bottle the brightest thing. Environment by
   lightformers over `public/hdri/studio.hdr` first. If lightformers alone cannot make the glass
   read, add one CC0 Poly Haven interior HDRI at 1024x512 as an extra tile in row M (source kept
   out of the repo, in `.scratch/armoury-potions/assets-src/`), never in place of the
   lightformer tiles. Tone mapping as the smithy's (AgX or ACES), for this canvas only.
6. **The capture problem:** render the same hero three ways into a stand-in share card (dark
   ground, the bottle, a tag): P1 captured with alpha as `captureScene` does today; P2 rendered
   over the card's own ground colour (clear colour = card ground, then drawn opaque); P3 the glass
   drawn opaque and painted for the picture only. Say which you recommend.
7. **The contact sheet.** One image, `shots/01/contact-sheet.png` (absolute path, rule 3), with a
   labelled tile per alternative and one row per question, all at desk (1440x900 at DPR 2) and a
   phone strip (390x844 at DPR 3) of the default:
   - Row G, glass: G1 thin clear with a fine fresnel rim; G2 slightly frosted, stronger rim; G3
     thick antique glass with a green edge.
   - Row L, liquid: L1 jewel (saturated, crisp band edges); L2 soft (bands blend over about 10
     percent of a band); L3 luminous (a faint inner light from below).
   - Row M, light: M1 one candle, warm, low left, with a cool moonlit rim from behind right; M2
     two candles either side; M3 backlit by a night window with a candle fill in front.
   - Row T: the default at tilt 0, 30 and 60 degrees (close look framing), and the Emberroot
     glow variant.
   - Row P: the three captures on the stand-in card.
   - Reference row: the wand's first-visit preset and the sword's first-visit preset, shot from
     this branch with `scripts/gpu-shots.mjs` at the same viewport, for the quality bar.
   Every tile is labelled with its letter and one line of words. Beside it,
   `shots/01/contact-sheet.md` lists every tile, the default each row varies from, the frame
   time frozen at, and your recommendation per row (Ed may mix: "G2, L1, M1, P2").
8. **Shots:** a small script on the branch (`scripts/spike-shots.mjs`, copying the launch flags
   of `gpu-shots.mjs`: headless, `channel: 'chromium'`, `--use-angle=metal`) that visits each
   query and screenshots; it checks for ANGLE Metal and stops if not. Liquid time frozen at the
   same moment in every tile.

## Acceptance

- One contact sheet and its `.md`, every tile labelled, every row varying one thing from a stated
  default, all frames real-GPU with the time frozen at the same moment.
- Each alternative is drawn with the cheap fake (no transmission); at rest nothing exceeds the
  bloom cap; nothing smokes or steams.
- The `.md` ends with a section "What ticket 10 lifts": for each piece (glass material builder,
  liquid shader and cap, band edge, glitter instancing, glow, render order, light and environment
  numbers, tone mapping, the capture method), the file and function on this branch and anything
  that was a spike shortcut (the lathe from three, approximate tipped levels).
- The epic branch is untouched.

## Tests to write first

None: a spike is judged by eye and never merges. Lint and typecheck the branch so ticket 10 lifts
clean code:

```bash
pnpm --filter armoury run lint
pnpm --filter armoury run typecheck
```

## Hand-off

Your run ends when the sheet is written. Report the path, your recommendation per row, the frame
cost you measured on the M3 for the default (ms per frame, desk and phone viewport), and any
alternative that looked wrong in a way the sheet does not show. The orchestrator sends the sheet
to Ed.

## Out of scope

- The bottle generator, real params, the shop UI, the pour, the close look's slosh and the
  uncorking.
- Any change to the wand or sword stages.

## Comments
- 2026-11-13 orchestrator: built on `spike/potion-look-do-not-merge` (2f5c08c2). Sheet at `shots/01/contact-sheet.png` with notes and the "What ticket 10 lifts" table in `contact-sheet.md`. Builder recommends G1, L2, M1, P2, ACES and no post pass at rest. Waiting for Ed.
