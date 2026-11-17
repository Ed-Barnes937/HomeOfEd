# 27 - No string to the card, and the card says what the potion does

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** none
**Parallel with:** 28 (which owns `src/stage/`; do not touch it)
**Model:** sonnet
**Gate:** the orchestrator reads the diff and the shots (no separate reviewer)
**ADR:** a short addition to 0110 (the card) for both changes
**Dev port:** 3044

Asked for by Ed on 2026-11-17 after his first look at the finished shop.

## 1. Remove the string from the bottle to the card

In `src/apothecary/BrewingTable.tsx` the recipe card is tied to the bottle by a twine
(`styles.twine`, three paths) that ends at a knot on the bottle's neck (`NeckTie` in
`BottleFooting.tsx`). Ed wants it gone: remove the twine, the knot, and every style, token
(`--twine`, `--string`, `--gold-string` if nothing else uses them) and test that exists only
for them. The card stays where it is and keeps its look; the gold card stays gold. If the
share picture (`src/share/apothecaryCard`) also draws a string from bottle to card, remove it
there too.

## 2. The card says what a mixed potion does

Today a mixed potion's card reads "Mixed from A, B and C in a flask." (`potionTagLine` in
`src/potion/describe.ts`). Ed wants the card to say what the potion does, different for every
recipe that is not murky (144 of the 165). Murky, unmixed and empty keep the words they have.
Secret blends keep their names and lore and get this line like any other mixed potion.

The rule (order of pouring never changes the line, as it never changes the mix):

```
{what[outcome][strength]}, {until[main]}. It leaves you with {adjective[x]} {thing[y]}.
```

`outcome`, `strength` and `main` come from `mixPotion`; `x` and `y` are the other two
ingredients in wheel order (for three of a kind, `x = y = main`; for a pair plus one, remove
one `main` from the three and take what is left). Main plus the other two is the whole recipe,
so the line is unique as long as each table's entries differ. Each table is data beside the
ingredient rows or in `describe.ts`, whichever matches the file's style.

Starting words (improve them if a line reads badly; keep them short, funny for a six year
old, original, with no drinking, eating or tasting and nothing from a franchise):

| outcome | strength 1 | strength 2 | strength 3 |
|---|---|---|---|
| floating | One dab on each shoe and you float a finger above the floor | One dab on each shoe and you float as high as the table | One dab on each shoe and you bob along the ceiling like a balloon |
| sparkling | A drop on your hands and everything you touch twinkles | A drop on your hands and everything you touch is covered in glitter | A drop on your hands and glitter follows you about like a tail |
| dreamy | A drop on your pillow and you dream of somewhere nice | A drop on your pillow and you dream whatever dream you ask for | A drop on your pillow and you share a dream with your best friend |
| glowing | A dab on your nose and it glows like a night light | A dab on your nose and you glow enough to read under the covers | A dab on your nose and you glow so brightly that moths come to visit |
| whirling | A splash on the floor and you spin once round, very neatly | A splash on the floor and you twirl like a leaf in the wind | A splash on the floor and you whirl so fast your hat flies off |
| whiffy | Pull the cork and the room smells a little of cabbage | Pull the cork and the room smells of wet dog and cabbage | Pull the cork and the pong is so strong that even the flies leave |

| ingredient | until | adjective | thing |
|---|---|---|---|
| emberroot | until your toes get cold | warm | toes |
| starpetal | until the sun comes up | golden | freckles |
| frogfizz | until a frog croaks | bouncy | hiccups |
| snailshine | until it rains | silvery | footprints |
| bluebell | until the birds wake up | dewy | eyelashes |
| thundercloud | until the next clap of thunder | rumbly | hair |
| moonmilk | until the moon goes in | sleepy | yawns |
| rosehip | until somebody hums a lullaby | rosy | cheeks |
| puffcap | until you sneeze | spotty | elbows |

Example (Frogfizz, Frogfizz, Bluebell dew, floating at strength 2): "One dab on each shoe and
you float as high as the table, until a frog croaks. It leaves you with bouncy eyelashes."

The line is about twice as long as today's. Make it fit the card on a 360 px wide phone and
on a desk screen without cutting it off (the card may grow downwards a little; do not shrink
the type below what the card uses now), and check the share picture if it prints the tag
line.

## Tests (first, then the code)

- Unit, in `describe.test.ts`: over all 165 recipes, every order of a recipe gives the same
  line; the 144 that are not murky give 144 different lines; no line contains drink, sip,
  swallow, taste or eat; the longest line is within a stated cap.
- Update the iwft and unit tests that pin the old words or the string.

## Verify

`pnpm lint`, `pnpm typecheck`, `pnpm --filter armoury run test` (Vitest and the Playwright
CT; you are the only agent running CT). Shots by eye on the real GPU (`scripts/gpu-shots.mjs`
against your dev server on 3044, never `playwright install`): the scene with a mixed potion
whose line is the longest, at 360 px wide and on a desk, plus a gold blend's card.

## Out of scope

`src/stage/` (ticket 28), the potion's name and lore, murky's words, the wand and sword
shops.

## Comments
