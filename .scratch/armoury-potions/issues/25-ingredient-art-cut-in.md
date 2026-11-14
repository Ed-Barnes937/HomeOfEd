# 25 - Ed's ingredient art, cut in

**Status:** ready-for-agent (waits for Ed's sheet)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 16, 24, and Ed's sheet at `.scratch/armoury-potions/art/ingredients-sheet.png`
**Parallel with:** 17
**Model:** opus (judged by eye against a high art bar)
**Gate:** materials (the nine pictures as a set and in the picker)
**ADR:** add "Ed's art" to 0112
**Dev port:** 3044

## Goal

Replace the placeholders with Ed's painted ingredients (E8): run ticket 16's cutter on his
sheet, swap the nine webps, and take them through the materials gate in the picker. If the sheet
breaks the layout or a cell falls short of the art bar, say exactly which and why, so Ed can ask
Gemini for that cell again with the prompt's notes.

## Read first

- Ticket 16 (the layout contract, the cutter, the mask) and ADR 0112; ticket 24's
  `.scratch/armoury-potions/art/prompt.md` (absolute path).
- `decisions.md` (absolute path): E2, E8; `shots/16/record/` (the placeholders in the picker).

## Files you own

`public/ingredients/<id>.webp` (nine), `src/apothecary/pourPicker.module.scss` (picture size
or mask only, if the gate asks), `docs/adr/0112-armoury-ingredient-pictures.md` (one section).

## Scope

1. Run `scripts/ingredient-pictures.ts` on Ed's sheet. If it refuses the sheet, stop and report
   the reason for Ed; never hand-edit a sheet beyond a lossless crop to square that the cutter
   asks for.
2. Commit the nine webps (each under 30 KB).
3. Shoot the gate and hand off.
4. ADR 0112 "Ed's art": the prompt as used (copy the final block in), the model, the sheet's size,
   where the original lives (`.scratch/armoury-potions/art/`, Ed's copy), any cell re-done.

## Acceptance

- The materials gate passes, desk and phone.
- `src/pours.iwft.tsx` still passes (the orchestrator runs it).

## Materials gate

Protocol: spec rule 15. Shots into `shots/25/r<N>/`: the nine at 1x and 3x as a sheet; the picker
open on desk and phone in the finished shop (`gpu-shots.mjs --box-only` on two presets is enough
for the panel); the record sheet from ticket 16 beside them.

The reviewer judges: each picture is clearly its ingredient and matches its liquid's colour; the
nine read as one set and belong with the scene and with the wand and sword art; no seams, halos
or background edges show through the mask; nothing is blurry at 3x; the picker still reads in
the dark palette. A failing cell goes back to Ed with the reason (a fix round is Ed's re-roll of
that cell, then a fresh cut).

## Out of scope

- Writing the prompt (24), the cutter (16).

## Comments
- 2026-11-14 orchestrator, from the review of ticket 16 (`reviews/16-r1.md`): (a) check every cut file by eye, in wheel order: the cutter cannot see off-centre subjects; if the image model adds a border on one side only, crop the sheet square first. (b) Shoot the record comparison with the bottle empty as well: with a full bottle every jar is dimmed to 0.55. (c) **Phone picture size, for Ed to decide before this ticket's gate:** at 390x844 the pictures are 26 px (an 18 px solid disc after the mask), too small for painted art. The reviewer's measured way out: move the "Three" summary row with its lock (42 px) out of the Pours tab's body and the full or mixed message (22 px) below the jars; that buys 67 px, a picture of about 48 px (50 with a 4 px jar gap). Cost: the summary row belongs to the shared sheet (`src/shop/controls/Sheet.tsx`), so it needs a per-group switch that leaves the wand and sword sheets alone; the layout tests and record shots are redone. Letting the jars scroll at 56 px shows about one row: not recommended. If Ed says yes, do it here or as its own small ticket first.
- 2026-11-14 orchestrator: the cutter is now `scripts/ingredient-pictures.ts`; run it as `pnpm --filter armoury run ingredients:cut <sheet>` (the path is relative to `apps/armoury`; Node 22.6 or later; needs `cwebp`, `brew install webp`). It refuses a JPEG with a rotation flag: re-save the sheet as an upright RGB PNG.
