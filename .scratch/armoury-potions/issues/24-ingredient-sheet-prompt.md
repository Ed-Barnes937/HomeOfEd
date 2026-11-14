# 24 - The ingredient sheet prompt for Ed

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 13 (its scene round passed), 11 (ingredient colours and traits settled), 16 (the
layout contract)
**Parallel with:** 23, 15, 12
**Model:** opus (art direction in words; judged by a reviewer, then by Ed)
**Gate:** prompt review (a fresh reviewer checks it against the layout, the scene and the art
bar), then the hand-off to Ed
**ADR:** none (ticket 25 records the final prompt in 0112)
**Dev port:** 3043 (only to shoot reference crops)

## Goal

Write the prompt Ed gives Gemini's image model ("nano banana") to paint the nine ingredients as
one sprite sheet that the cutter from ticket 16 can cut without help, in the finished scene's
art style (E8). Ed insists on high art quality: the prompt must describe the style concretely
enough that the nine come back as one set that belongs in the brewing-table scene, beside the
wand shop's and the smithy's art.

## Read first

- `spec.md`: "The ingredients" (the table: wheel order, colours, traits, lore), "The look and the
  scene, in words".
- `decisions.md` (absolute path): E2, E5, E7, E8, E11.
- Ticket 16's "The sheet layout" (the contract) and ADR 0112; ticket 13's ADR 0110 and its last
  passing scene round in `shots/13/` (absolute path); `shots/02/contact-sheet.png` (P3).
- The street painting `apps/armoury/public/street/street.webp` and the smithy's scene (ADR 0101)
  for the house style the potion shop already matches.

## Deliverables (all under `.scratch/armoury-potions/art/`, absolute path; local, not committed)

1. **`prompt.md`**: one block Ed pastes as is, then the notes below it.
   - The layout in plain words Gemini follows: square, three by three, row by row in wheel
     order, one flat background of the given hex across the whole sheet, each ingredient centred
     at about 70 percent of its cell with an empty margin, nothing crossing between cells, no
     grid lines, borders, labels, numbers or text, no bottles or jars (the ingredient itself).
   - The style, concretely, from the finished scene: medium (painted, its brush and edge
     quality), palette and value range, light (one warm candle key from the left, a cool moonlit
     rim from behind right, M1), level of detail at 64 px, mood (moody but friendly, E5).
   - Each ingredient in one or two sentences: what it is, its shape, its colour (the hex from
     `ingredients.ts` as settled by 10 and 11) and how its trait shows. Starting descriptions:
     Emberroot, a knobbly root glowing ember-orange from cracks inside; Starpetal, a gold
     five-pointed star flower with glints on its tips; Frogfizz, a translucent spring-green bead,
     fizzing with tiny bubbles, with a curled tendril like a frog's leg; Snailshine, a pearly teal
     spiral shell with a silvery wet trail curling from it; Bluebell dew, a drooping cornflower
     bluebell with one fat dewdrop; Thundercloud, a small storm-indigo cloud with silver flecks
     and a tiny lightning glint; Moonmilk, a pearly-white droplet holding a crescent moon's
     reflection; Rosehip syrup, two glossy deep-pink rosehips on a stem with a drip of syrup;
     Puffcap, a small toadstool-red mushroom with pale spots and a tiny puff of spores.
   - What to avoid: text, letters, watermarks, a white or light background, a table or floor,
     drop shadows into other cells, a cartoon or clip-art look, photographic realism, anything
     from a franchise (the DO_NOT_USE list's spirit).
2. **`reference.png`**: an image Ed attaches with the prompt: a crop of the finished scene
   (shelf of jars and candle) for style, and a strip of the nine target colours in grid order.
3. **Notes for Ed** in `prompt.md` below the block: which model and settings (square, the
   largest size offered), how to fix one cell by asking for an edit of that cell only, a
   checklist before handing the sheet back (nine, in order, square, margins clear, no text), and
   where to put the file (`.scratch/armoury-potions/art/ingredients-sheet.png`).

## Steps

1. Read the scene's last passing round and write down its style in a paragraph before the
   prompt (keep it in `prompt.md` as "Style notes").
2. Write the prompt and the reference image.
3. Dry-run the cutter (ticket 16) on a mock sheet laid out from your own wording (the placeholder
   generator is fine) to check nothing in the prompt contradicts the contract.
4. Hand off: the orchestrator asks a fresh reviewer to read `prompt.md` and `reference.png`
   beside the scene's shots and ticket 16's contract and to write `art/review.md` (pass, or the
   changes). After a pass the orchestrator adds the prompt's path to `for-ed.md`.

## Acceptance

- The reviewer passes it: the layout is unambiguous and matches the cutter; the style words
  match the scene; each ingredient is drawn as itself and recognisable at 64 px; the colours are
  the settled ones; nothing asks for text.
- Ed has the prompt, the reference and the checklist in one place.

## Out of scope

- Generating images (Ed does), cutting them (25).

## Comments
- 2026-11-14 orchestrator, from the review of ticket 16 (`reviews/16-r1.md`): ask for compact, roughly round subjects about 70 percent of the cell (the picker's mask is solid only inside 70 percent of the picture's width, so the tips of tall or wide subjects fade out), on a flat `#0a070b` ground edge to edge; a 1024 px square is enough. Make these pairs differ in shape and silhouette, not only colour (weakest under colour blindness): Starpetal and Frogfizz; Emberroot and Frogfizz; Snailshine and Moonmilk; Rosehip and Puffcap. State the size the art must survive: 64 px on desk and, on a phone, 26 px today, about 48 px if Ed takes the reviewer's layout change (see ticket 25); write the prompt so it reads at 26 px. Tell Ed to save the sheet upright (the cutter refuses a JPEG with a rotation flag) and square.
- 2026-11-14 orchestrator, from the second review of ticket 16: ask the image model for a PNG; that avoids the rotation flag, CMYK and JPEG problems at once.
- 2026-11-14 orchestrator: ticket 26 is merged, so the pictures are 48 px on a phone (a soft round mask, solid inside 70 percent) and 64 px on desk. Write the prompt for art that reads at 48 px.
