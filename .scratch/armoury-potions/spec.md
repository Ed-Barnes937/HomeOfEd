# armoury potions - Bubble & Brew, the third shop

**Status:** ready-for-agent
**Raised:** 2026-11-13 by Ed
**Tickets:** [issues/](issues/) 01-19. One epic branch, `armoury-potions`, one PR to main at
the end (decision O1); ticket 19 (the hub card) is its own PR to main.

## Why

The armoury street has a wand shop and a smithy. The third painted front, "Bubble & Brew"
(`src/street/shops.ts`, id `potions`), is shut. Ed wants it open as a potion shop where a
child makes a potion with some of the feel of brewing, without losing the fun of designing
something pretty (E1). The chosen direction is "Pour and Layer": the child pours ingredients
from picture jars into a bottle, each pour lands as a coloured layer with one visible trait,
and the bottle, its stopper and its label are designed as in the other shops.

## Sources and precedence

Local working files beside this spec (gitignored; they exist only in the epic worktree at
`/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/`,
so an implementer in an isolated worktree reads them by that absolute path):

- `decisions.md`: Ed's answers E1-E6 and the orchestrator's calls O1-O9.
- `research/experience-options.md`: the research. Option 2 is the direction. Its close look
  ("shake it") is superseded by O3: the flourish is the uncorking and the effect that comes out.

Precedence: `decisions.md`, then this spec, then the research. Where this spec is silent, the
research's section 1 (seams), "Rendering" notes, Option 2 and "Notes for whoever plans it"
apply.

## The experience, on a phone

1. The street. The child slides along the painting to Bubble & Brew, taps it (its lights come
   up) and taps "Enter Bubble & Brew". The door opens only in ticket 17, the last build ticket.
2. The shop. A dim, candlelit room: a glass bottle stands on a wooden brewing table, three
   layers of liquid in it (pearly Moonmilk at the bottom, a slow pink swirl of Rosehip syrup,
   gold Starpetal glittering on top), a cork in its neck. Beside it, a recipe card on string
   gives its shop number, name and tag line: "No. 4127. Sparkling Starpetal Tonic. Three pours
   in a teardrop flask. Cloudy, then swirly, then sparkly." Below, the sheet's first tab,
   "Pours", is open.
3. Pouring. The sheet shows nine jars in a three by three grid, each with its picture (plain
   colour swatches until the pictures exist, decision O6) and its name. The bottle has room for
   one more. She taps Frogfizz: the stopper lifts aside, a thin green stream pours in, a fourth
   band rises on top and starts to fizz, the stopper drops back. The recipe card now reads
   "Floating Frogfizz Tonic". The jars now say "The bottle is full. Take one out to pour another."
4. Changing the order. Under the jars, "In the bottle" lists the four pours, top first, each
   with a "Take out" button. She takes out the Rosehip in the middle; the layers above it drop
   down to fill the gap. She pours Emberroot in on top: a warm glowing band. Order is the
   recipe: the same jars in another order make another potion with another name.
5. The bottle and its finish. The "Bottle" tab picks its shape (round flask, teardrop flask,
   tall bottle, square-shouldered bottle, gourd bottle), its neck (short to long) and its glass
   (clear, sea green, amber, violet, smoky). The "Finish" tab picks a stopper (cork, glass
   stopper, sealed with wax) and a label (none, round, banner, a tag on a string).
6. Try another. Pours a random potion into a random bottle, with a random finish, in a quick
   cascade of pours. A lock on any of the three groups keeps that group; "Put the last one
   back" undoes it.
7. A secret blend. Some exact orders of pours are secret blends: Thundercloud then Moonmilk
   is "The Moon Behind the Storm". The name changes, the label and the recipe card turn gold,
   and the lore says something of its own. Nothing tells her which orders are secret; there is
   no book to fill and no way to get stuck.
8. The close look. A tap on the bottle lifts it into the middle of the darkened shop. It stands
   upright and turns slowly. Dragging sideways leans it, dragging up or down tips it towards or
   away from her, and the liquid stays level and sloshes, the bands staying in their order.
   Let go and it rights itself with a wobble. Nothing happens by itself on arrival.
9. The uncorking. A tap on the bottle (or "Uncork it") twists the stopper out with a pop and the
   potion's effect comes out of the neck in the potion's colours: big slow bubbles float up for
   a Floating potion, glitter fountains for a Sparkling one, a little puff of smoke for a Whiffy
   one. It lasts about three seconds, the stopper goes back in, and a tap does it again. The
   effect and the name are the whole of what the potion does (E3, O3): nobody drinks it.
10. Keep, rename, share. As in the other shops: the name on the card can be renamed (and the
    bottle's label shows the new name), "Keep this potion" puts it on Your shelf, a link opens
    it for anyone at `/shared`, and "Save a picture of this potion" downloads its card.

On a desktop the panel is the order slip, as in the other shops, with the same three groups.

## The item

Kind `potion`. Groups in order: `pours` "What goes in" (tab Pours), `bottle` "The bottle"
(tab Bottle), `finish` "Stopper and label" (tab Finish). Locks work on each group. **Try
another keeps nothing but locked groups** (`keeps: []`): there is no Kind picker.

### Params by group

**pours**

| Param | Type | Options | Default | Label | Coupling |
|---|---|---|---|---|---|
| `pour1` | choice | `none` (weight 0), then the nine ingredient ids (weight 1 each) | `moonmilk` | First pour | |
| `pour2` | choice | as `pour1`, `none` weight 0 | `rosehip` | Second pour | `none` only while `pour1` is `none` |
| `pour3` | choice | as `pour1`, `none` weight 2 | `starpetal` | Third pour | `none` only while `pour2` is `none` |
| `pour4` | choice | as `pour1`, `none` weight 2 | `none` | Fourth pour | `none` only while `pour3` is `none` |

- **No gaps.** `allowed(p)` for `pourN` (N > 1) is `['none']` while `pour{N-1}` is `none`,
  else every option, with `none` first so it is the fallback. `normalise` runs its second pass
  in schema order, so a gap empties everything above it. A link or save with a gap therefore
  opens with the pours below the gap only.
- **Taking one out shifts the rest down.** `potionItem.follows(before, key, value)`: when `key`
  is a pour and the result would leave a gap, return the compacted pour list (every remaining
  pour in its order, bottom first, `none` above). Setting `pourN` to an ingredient while a
  lower slot is empty puts it in the lowest empty slot instead. The reducer is unchanged.
- **Try another** never makes an empty bottle and rarely a short one: with the weights above,
  four pours about 67 percent of the time, three about 15, two about 18.
- The first-visit potion has three pours, so the child's first tap on a jar pours a fourth.

**bottle**

| Param | Type | Options / range | Default | Label |
|---|---|---|---|---|
| `shape` | choice | `round` "Round flask", `teardrop` "Teardrop flask", `tall` "Tall bottle", `shoulder` "Square shoulders", `gourd` "Gourd bottle" | `teardrop` | Shape |
| `neck` | number | 0-1, step 0.05 | 0.4 | Neck, ends "Short", "Long" |
| `glass` | choice | `clear` (weight 4), `sea` "Sea green" (2), `amber` (1), `violet` (1), `smoky` (1) | `clear` | Glass |

Every shape is a lathe profile (a radius along the height), so volumes are exact and the
shelf's silhouette is the profile. Heights and radii are data rows in `potion/bottles.ts`
(ticket 03 writes starting numbers, ticket 06 tunes them, the form gate judges them).

**finish**

| Param | Type | Options | Default | Label |
|---|---|---|---|---|
| `stopper` | choice | `cork` "Cork" (weight 5), `glass` "Glass stopper" (2), `wax` "Sealed with wax" (2) | `cork` | Stopper |
| `label` | choice | `none` "No label", `round` "Round", `banner` "Banner", `tag` "Tag on a string" | `round` | Label |

- The glass stopper takes the bottle's glass tint. The wax seal's colour is derived: the top
  pour's colour, darkened (no param).
- A label carries the potion's name (or the child's rename) in ink, in the shop's display face.
  This is tier B: if the materials gate finds it unreadable or cheap-looking at box size after
  its second fix round, the label stays a plain paper shape with a ruled ink line and the
  name stays on the recipe card only.

### The ingredients

One data row per ingredient in `potion/ingredients.ts`. Ids are persisted in saves and links
and never change; labels, words, colours and lore may. Colours are starting values: the look
spike and the materials gate retune them so that every pair of neighbouring layers reads as
two layers and every combination looks good.

| Id | Label | Name word | Colour | Trait | Effect | Lore line |
|---|---|---|---|---|---|---|
| `moonmilk` | Moonmilk | Moonmilk | `#ece6f4` pearly white | cloud | dreamy | Moonmilk is skimmed off puddles on full-moon nights. |
| `frogfizz` | Frogfizz | Frogfizz | `#7ccf4f` spring green | fizz | floating | Frogfizz hops about in the jar when nobody is looking. |
| `starpetal` | Starpetal | Starpetal | `#f2c14e` gold | glitter | sparkling | Starpetals only open after dark. |
| `emberroot` | Emberroot | Emberroot | `#e2562b` ember orange | glow | glowing | Emberroot stays warm long after it is dug up. |
| `bluebell` | Bluebell dew | Bluebell | `#5b8def` cornflower blue | clear | floating | Bluebell dew is gathered before the birds wake up. |
| `rosehip` | Rosehip syrup | Rosehip | `#d9467a` deep pink | swirl | whirling | Rosehip syrup stirs itself if you hum to it. |
| `thundercloud` | Thundercloud | Thundercloud | `#4b3f8f` storm indigo | glitter (silver flecks) | whirling | Thundercloud rumbles when it is cross. |
| `snailshine` | Snailshine | Snailshine | `#7fd6c8` pearly teal | swirl (a pearly sheen) | sparkling | Snailshine is the silver trail a snail leaves on a wet night. |
| `bogmurk` | Bog murk | Bogmurk | `#6b5b33` murky olive | cloud (with drifting specks) | whiffy | Bog murk is the best bit of the pond. |

- **Traits** (what a layer looks like at rest, judged at the materials gate): `clear` (a clean
  jewel colour), `cloud` (milky, soft-edged), `fizz` (small bubbles rising inside the band),
  `glitter` (flecks that drift and catch the light), `glow` (a soft light from inside, under
  the bloom cap), `swirl` (a slow marbled swirl in the band). A trait is tier B if it fails its
  gate twice: its ingredients then fall back to `clear` (or `cloud` for the two cloud ones), and
  the cut is recorded in ADR 0109.
- **Layers do not mix.** Each pour is its own band from its own colour. There is no colour
  mixing anywhere, so nothing converges on brown.
- **The murky rule (O5).** Murk exists only as the Bog murk ingredient, which has the same
  weight as every other ingredient in every slot, so under Try another a murky layer is exactly
  as likely as a layer of anything else, and a wholly murky potion (four Bog murks) exactly as
  likely as four of any other ingredient. No rule makes murk out of other pours, and none
  favours or forbids it. Unit tests pin this (see "Testing").
- The phone grid is three by three, so the jar count stays nine.

### The effect: what it does

Decided (E3, O3, O4). One parameterised system: six effect kinds, each a bounded particle show
in the potion's colours, chosen from the pours. Pure, in `potion/effects.ts`.

| Kind | Word (name adjective) | What comes out of the neck | Effect sentence (lore) |
|---|---|---|---|
| `floating` | Floating | big, slow, see-through bubbles drift up and away | Pull the cork and bubbles float up to the ceiling. |
| `sparkling` | Sparkling | a fountain of glitter rises and rains back down | Pull the cork and it fizzes with glitter. |
| `dreamy` | Dreamy | a few soft stars rise, twinkle and fade | Pull the cork and sleepy stars drift out. |
| `glowing` | Glowing | warm motes like fireflies spiral out and hover | Pull the cork and little lights come out to play. |
| `whirling` | Whirling | a ribbon of coloured light spirals up | Pull the cork and a whirl of colour spins out. |
| `whiffy` | Whiffy | one small round puff of coloured smoke | Pull the cork and out comes a very small pong. |

- **Which kind:** count the effect of each pour; the most common wins; a tie goes to the
  highest pour among the tied (the one nearest the cork comes out first). An empty bottle has
  no effect: the cork pops and nothing comes out.
- **Strength** is that count (1-4): more of the same is a bigger show, within fixed bounds.
- **Colours:** the colours of the pours that carry the winning effect, top first.
- No effect is acted out by the bottle or by anything in the room; no per-effect bespoke
  animation (out of scope).

### Names, tag lines, lore

All derived (`potion/describe.ts`), never stored, apart from a child's rename.

- **Name**, first match wins:
  1. A secret blend: its own name.
  2. An empty bottle: "An Empty Bottle".
  3. Two or more pours, all the same ingredient: "Pure {Label}" ("Pure Starpetal").
  4. Otherwise `{Effect word} {Main ingredient word} {Noun}`: the main ingredient is the most
     poured, a tie going to the highest; the noun comes from the shape: round "Brew", teardrop
     "Tonic", tall "Drops", shoulder "Mixture", gourd "Potion". "Floating Frogfizz Tonic",
     "Whiffy Bogmurk Brew".
- **DO_NOT_USE.** `potion/doNotUse.ts` lists franchise and game potion names and forbidden
  patterns (requirement below). A name that matches falls back to `{Effect word}
  {Main ingredient word} {Noun of the round shape}` and, if that also matches, to
  "{Label} {Noun}". A unit test sweeps every reachable name.
- **Tag line:** "{Count in words} pour(s) in a {shape noun}. {Traits, bottom first, joined by
  ', then '}." with repeats in a row merged: "Three pours in a teardrop flask. Cloudy, then
  swirly, then sparkly." Trait words: clear "Clear", cloud "Cloudy", fizz "Fizzy", glitter
  "Sparkly", glow "Glowing", swirl "Swirly". Shape nouns: "round flask", "teardrop flask",
  "tall bottle", "square-shouldered bottle", "gourd bottle". Empty: "An empty {shape noun},
  waiting for a pour."
- **Lore:** the main ingredient's lore line, then the effect sentence. A secret blend has its
  own two sentences. Empty: "Every potion starts as an empty bottle. Pour something in."
- **Shelf line:** "{Shape label}, {count in words} pours" ("Gourd bottle, four pours"), or
  "{Shape label}, empty".
- **Glow** (`#rrggbb`): the effect's first colour; an empty bottle `#e8b46a` (candle).
- **Shop number:** `shopNumber` (`items/shopNumber.ts`), as every kind.
- **lengthFraction:** the bottle's drawn height over the tallest bottle's, from
  `potion/framing.ts`.

### Secret blends

A curated table in `potion/blends.ts`: an exact list of pours, bottom first, matched whole,
with a name and two lore sentences. A blend turns the label and the recipe card gold (a flag the
stage and the scene read); nothing else changes: same layers, same effect rule. Starting table
(ticket 05 may change names and add up to two more; at most 12):

| Pours, bottom first | Name |
|---|---|
| thundercloud, moonmilk | The Moon Behind the Storm |
| bluebell, frogfizz, starpetal, emberroot | Sunrise in a Bottle |
| emberroot, starpetal, frogfizz, bluebell | Sunset in a Bottle |
| bogmurk, frogfizz | Pond Life |
| frogfizz, bogmurk, frogfizz | Frogspawn Surprise |
| moonmilk, moonmilk, starpetal, starpetal | The Milky Way |
| rosehip, moonmilk, rosehip, moonmilk | Pink Ribbons |
| thundercloud, thundercloud, thundercloud, starpetal | The Storm's Gold Star |
| snailshine, bluebell, snailshine, bluebell | Sea Glass |
| moonmilk, bluebell, moonmilk | Clouds on a Blue Day |
| bogmurk, bogmurk, bogmurk, bogmurk | Bottom of the Pond (overrides "Pure Bogmurk") |

### Presets

`potion/presets.ts`, eight hand-picked potions, each normalising to itself, covering every
shape, every stopper, every label, every ingredient at least once and at least one secret blend.
`[0]` is the first-visit potion: teardrop flask, neck 0.4, clear glass, cork, round label,
pours moonmilk, rosehip, starpetal. Presets are re-judged at the materials gate.

### DO_NOT_USE requirement

`potion/doNotUse.ts` exports `POTION_DO_NOT_USE` and `isForbiddenName(name)`. It compares
lower-cased names with spaces and punctuation removed, and covers at least:

- Wizarding-school brews and sweets: Polyjuice, Felix Felicis, Liquid Luck, Amortentia,
  Veritaserum, Wolfsbane, Skele-Gro, Pepperup, Draught of Living Death, Draught of Peace,
  Sleeping Draught, Dreamless Sleep, Calming Draught, Shrinking Solution, Swelling Solution,
  Babbling Beverage, Wit-Sharpening, Gillyweed, Butterbeer, Pumpkin Juice, Thunderbrew,
  Wiggenweld, Edurus, Maxima, Elixir of Life, Philosopher's Stone, Fizzing Whizzbees.
- Game items: Estus, Hi-Potion, X-Potion, Mega-Potion, Super Potion, Hyper Potion, Max Potion,
  Full Restore, Elixir (as a whole name), Max Elixir, Ether, Phoenix Down, Red Potion, Blue
  Potion, Green Potion, Purple Potion, Skooma, Awkward Potion, Mundane Potion, Thick Potion,
  Swallow, Thunderbolt, Tawny Owl, White Honey, Golden Oriole, Black Blood, Petri's Philter.
- Generic game terms: health potion, mana, mana potion, stamina potion, HP, MP.
- Patterns: a name beginning "Potion of", "Draught of", "Elixir of" or "Philter"; "Super",
  "Hyper", "Max", "Mega", "Hi" or "X" directly before "Potion".
- Myth and legend names used as products: Ambrosia, Soma, Mead of Poetry, Drink Me.

The same list is checked against every secret blend and preset name. No franchise vocabulary
in ingredient names, lore or UI copy either (apps/armoury/CLAUDE.md "No franchise vocabulary").

## The look and the scene, in words

Decided in mood (E5), settled by Ed's picks from tickets 01 and 02.

- **Moody but accessible.** A dim apothecary at night: warm candlelight from one side, a cool
  moonlit rim from behind, deep shadows, jars on shelves in the gloom. The bottle is the
  brightest, most saturated thing in the scene; the glow of its layers lights the table a
  little. The controls, card and text keep the app's contrast (see "Accessibility").
- **The bottle.** Fake glass as `stage/Gems.tsx` does it: `MeshPhysicalMaterial`, clearcoat, low
  roughness, the environment, and an emissive fresnel rim, drawn as a back-face pass and a
  front-face pass with the liquid between, no `transmission` (two WebGL contexts already run in
  the close look, ADR 0077). Explicit `renderOrder`: glass back, liquid, particles, glass front;
  `depthWrite: false` on the glass.
- **The liquid.** One inner mesh. The fragment shader discards above a level surface plane in
  world space and caps the cut with the back faces in the surface colour. Bands are coloured by
  height between plane heights that keep each pour's volume, with a soft edge of a few
  millimetres. Traits are shader features or a few hundred instanced points inside the band,
  culled at the surface. A time uniform drives the motion; it is frozen under reduced motion and
  for real-GPU shots (`?freeze=<seconds>`, dev only).
- **Glow** stays under `0.92 * BLOOM_THRESHOLD` at rest (ADR 0082, 0083); the uncorking is the
  one bounded exception, in the close look only, recorded in ADR 0111 as ADR 0100 did for the
  sword.
- **No steam or smoke at rest.** Fill rate is the phone trap (research "Rendering"); the Whiffy
  puff is short-lived, small and made of few sprites.
- **Framing.** The box stage looks at the bottle from the front, a little above, so the top of
  the liquid shows as a thin ellipse. The bottle stands on a fixed base line shared with the
  scene art (`potion/framing.ts`), drawn at a height fraction of the stage (the tallest bottle
  at full fill, a round flask with a short neck at about 0.6), and turns about its upright axis
  when the child drags across it on the table. The label faces the child at rest.
- **The scene** (composition from Ed's pick in ticket 02): the brewing table, a candle, shelves
  of jars in the dark behind, the recipe card on string beside the bottle, drawn in CSS and SVG
  like the smithy, with its palette under `[data-shop='apothecary']` in `styles/tokens.scss`.
  A candle flicker of a few percent, off under reduced motion. The scene's light directions match
  the stage's lights.
- **The picture** (share card): the stage's capture over the card's own ground, not on a
  transparent background, so the glass does not wash out or dark-edge when composited (research
  "Rendering", last bullet; the spike shows the options and Ed picks).
- **Ingredient pictures** (O6): rendered by the real stage in the settled look, as
  `public/thumbs/` are, with the name beside; until then plain swatches. Ed is asked at the look
  gate whether he would rather paint or generate them (ticket 02 shows the options side by side).

## Accessibility and reduced motion

- Every jar is a real button named "Pour in {Label}"; when the bottle is full the jars are
  `aria-disabled` and the full message is visible text. "In the bottle" is a list, top pour
  first, each with a "Take out {Label}" button. A polite live region says what changed: "Frogfizz
  poured in. Four of four." / "Rosehip syrup taken out." The picker is fully keyboard operable,
  with visible focus.
- Text on panels, the card and buttons meets WCAG AA (4.5:1, 3:1 for large text and focus
  rings) against the shop's dark palette; a unit test reads the `[data-shop='apothecary']`
  block of `tokens.scss` and checks the listed text and ground pairs. Mood comes from the scene,
  never from low-contrast text.
- Colour is never the only cue: every jar and pour shows its name, and traits differ in texture
  as well as colour.
- Reduced motion (`prefers-reduced-motion`): no pour stream (a pour fills at once), no Try
  another cascade, no candle flicker, no idle trait motion (glitter, fizz and swirl hold a still
  frame), no idle turn, no slosh wobble (the liquid still stays level when tipped, since that is
  a pose, not a motion), no flying lift or put-back. The uncorking lifts the stopper without
  movement and shows the effect as a still arrangement of its particles that fades in for 0.3 s,
  holds 1.2 s and fades out for 0.5 s, so the child still sees what the potion does.

## Save and share

Per ADR 0096: a new kind, a new storage key and a new link field, no format change.

- `ITEM_KINDS` becomes `['wand', 'sword', 'potion']` (the order a link is read in; new kinds go
  last).
- Save key `armoury:save:potion` (`POTION_SAVE_KEY` in `persistence/storage.ts`), the same
  document shape, decoded through `potionSchema`, added to `PROFILE_KEYS` so it is a player's.
  **Never bump `SAVE_FORMAT_VERSION`.**
- Link field `potion`: `#w=<base64url(JSON({ version: 1, potion: { params, name? } }))>`, built
  at `/shared` like the others. An older build given a potion link decodes nothing and opens as a
  normal visit.
- Last shop value `potion`; path `/potions`; `ShopPath` and `ShopView.path` gain `/potions`,
  `ShopView.shop` gains `apothecary`.
- One bench per kind: the potion's locks, "Put the last one back" and autosave are its own and
  survive walking between shops.
- These names are one-way doors once shipped: they are fixed here and change only with Ed.

## The shelf

A "Potions" section after Swords, shown only when it has something in it. A potion entry is
the shelf's usual box with the bottle's silhouette as inline SVG (`potionOutline`: the glass
outline, the stopper, the liquid bands in their ingredient colours, flat), its name, number,
shelf line and a seal in its glow colour. No 3D. "Take it out" loads it on the potion bench and
goes to `/potions`; the back link reads "Back to the brewing table". Built before Ed's pick
(ticket 07) from the ingredient colours; ticket 13 may restyle the potion box to match the scene.

## Shop copy

| Use | Potion shop |
|---|---|
| Motto | potions poured to order |
| Scene button | Pick the bottle up |
| Scene hint | Tap the bottle to pick it up |
| Close look title | Your potion, up close |
| Close look action | Uncork it |
| Close look hint | Drag to tip it. Tap it to uncork it. |
| Keep | Keep this potion |
| Kept (read out) | {name} is on your shelf. |
| Name field | Potion name |
| Share | Share a link to this potion |
| Share title | Armoury |
| Share text | Look at the potion I made |
| Picture | Save a picture of this potion |
| Shelf link | Your shelf, N potions |
| Panel title | Make your potion |
| Sheet title | Parts of the potion |
| Picture file fallback | potion |
| Shelf heading / back link / intro / empty | Potions / Back to the brewing table / Every potion you keep gets a box and a label. / Keep a potion and its box goes here |
| Street door | Go into the potion shop |

"Put it back", "Try another", "Put the last one back" and "On your shelf" are shared.

## The close look

Decided (O3). Built on `HeldRig` once ticket 04 has generalised it.

- **The hold.** The bottle rises from the table and stands upright in the middle of the screen,
  in landscape and portrait alike, turning slowly until first touched. It never flourishes on
  arrival (`ShopView.closeUp.flourishOnArrival: false`, a generic option added by ticket 07;
  the wand and the sword keep `true`).
- **Free play.** A drag across leans the bottle sideways (up to 60 degrees), a drag along tips
  its top towards or away from the viewer (up to 45 degrees); on release it rights itself with a
  damped wobble. Pinch and wheel zoom as now. The liquid's surface stays level in world space and
  sloshes: a damped spring on the surface's tilt fed by the bottle's angular velocity, no fluid
  simulation. Band boundaries stay level and keep each band's volume (`potion/tipped.ts`).
- **The uncorking** (a tap on the bottle or "Uncork it"): the bottle rights itself, the stopper
  twists and lifts out with a pop, the effect comes out of the neck in the potion's colours for
  about three seconds, the stopper goes back in. A pure clock (`stage/potionShow.ts`, after
  `swordGlow.ts`) drives it. Beats are proposed in ticket 15 and settled at its gate.
- **Bounds.** Effects are at most a few hundred small instanced particles, at most a handful of
  smoke sprites, stay inside a box above the neck that stays on screen, and are gone within the
  show. They may exceed the bloom cap during the show only.
- No acted-out behaviour (the bottle never floats or hops), no drinking, no spell, no shop
  flash (`flashDelaySeconds: null`).

## Out of scope

- Option 3's cauldron (brew, then bottle), and any second scene or phase in the shell.
- A discovery collection or book of secret blends; any new persistent document.
- Drinking, a character who drinks, any reaction scene.
- Per-effect bespoke animation; the bottle acting out its effect.
- **Optional, recommended cut:** a "Stir it" mode (Layered or Mixed through a curated pair
  table). It adds a pair table, a second liquid look and a murky-odds argument for little play.
- **Optional, recommended cut:** charms on a thread (moon, star, key). Each is a small mesh, a
  form gate and a materials gate. Adding one later is a new param that normalises to `none`, so
  old saves and links still open.
- **Optional, recommended cut:** label icons (an ink picture of the effect on the label).
- Free colour mixing; steam or mist at rest; real refraction (`transmission`).
- Sound. Real-phone checks and taste calls, which ticket 18 lists for Ed.

## Testing

Proof follows the repo's split: unit tests for the layer below, `.iwft` for state through the
UI, real-GPU gates for anything judged by eye.

- **Unit (generator, pure, three-free):** schema coupling and compaction; `follows` shifting;
  ingredient table completeness; the murky rule computed from the schema's weights (Bog murk
  equally likely in every slot; four Bog murks exactly as likely as four of any other); no
  colour in a compiled potion that none of its pours brought; effect choice, ties, strength and
  colours; every reachable name against `isForbiddenName`; blends unique and reachable; presets
  normalise to themselves; the lathe meshes are closed, the liquid sits inside the cavity, each
  pour adds an equal volume within 1 percent, tipped band levels keep volume within 2 percent up
  to 60 degrees; outlines follow the profile; vertex budgets (glass 20k, liquid 10k, stopper and
  label 8k, total 40k) asserted on counts. A chosen catalogue (every shape at neck 0, 0.5 and 1,
  every stopper and label, 0 to 4 pours, every blend), built once each; never hundreds of
  random potions; no wall-clock assertions.
- **Unit (stage clocks, pure):** `stage/hold.ts` (lean and tip springs, clamps, reduced motion),
  `stage/slosh.ts`, `stage/potionShow.ts`, the effect motion functions: bounded, continuous at
  60 Hz, back to rest, steady under reduced motion.
- **iwft** (fakes, never pixels): the shop's flow in `src/apothecary.iwft.tsx`, the picker in
  `src/pours.iwft.tsx`, the shelf, shared view and street additions in their existing suites.
- **Real-GPU gates** (`scripts/gpu-shots.mjs`, ANGLE Metal, never SwiftShader, never
  `playwright install`), judged by a fresh reviewer beside the wand and sword baseline from
  ticket 04: form (09), materials (10, 11, 12, 16), the scene round of the whole shop (13), the
  close look (14, 15), the whole shop (18). Ed's picks: the look (01) and the scene and pictures
  (02).
- **Wand and sword unchanged:** ticket 04 proves it by a pixel diff of real-GPU shots before and
  after; every wand and sword test passes untouched throughout.

## Rules for the team

1. **Read first:** `apps/armoury/CLAUDE.md` (all of it, especially "Adding a shop" and the
   rules), `apps/armoury/CONTEXT.md`, this spec, your ticket.
2. **Exclusive file ownership.** Edit only the files your ticket lists. If you need a line
   elsewhere, ask the orchestrator. Hand-offs are in "Build order and ownership".
3. **Worktrees.** Implementers run in their own git worktree off `armoury-potions` (O2). Run
   `pnpm install --frozen-lockfile` first. `.scratch/` other than `spec.md` and `issues/` is not
   in git: read `decisions.md` and `research/` and write every shot, set file and review into the
   epic worktree by absolute path,
   `/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/`.
4. **Commits.** `git add <explicit paths>`, never `-A` or `.`. Message style
   `armoury: <what changed, as a sentence>` (ticket 19: `hub: ...`). No co-author or agent
   attribution lines (O9). Never push. Never commit for another ticket.
5. **Never the em dash character**, anywhere. Plain hyphens.
6. **Comments** only for genuinely obscure code, one or two lines. Rationale goes in the ADR.
7. **No franchise vocabulary** (the DO_NOT_USE requirement above).
8. **Motion.** Everything that moves honours `prefers-reduced-motion`, as "Accessibility and
   reduced motion" says.
9. **three.js stays behind the stage seam.** Only `stage/*.tsx` imports three or R3F. The pure
   generator (`potion/`) is three-free. The main chunk may import `potion/compile.ts`,
   `potion/profile.ts`, `potion/outline.ts`, `potion/framing.ts` and the data tables, never
   `potion/geometry.ts` or `potion/tipped.ts`.
10. **TDD.** Write the failing test first. iwft for state through the UI, unit tests for the
    layer below; do not over-test.
11. **Scoped checks while neighbours are mid-edit** (`pnpm --filter armoury exec vitest run
    <dir>`); the full verify loop runs at the integration points (tickets 07, 09, 17, 18).
    Use `pnpm --filter armoury run <script>`, never `turbo --filter` (it errors on a cyclic dep).
12. **Playwright CT is one machine-wide resource** (port 3111 and `playwright/.cache`), shared
    by every worktree. Ask the orchestrator before any CT run. Dev servers for shots use your
    ticket's own port (`pnpm --filter armoury exec vite --port <yours> --strictPort`): 01 3031,
    04 3030, 09 3032, 10 3033, 11 3034, 12 3035, 13 3036, 14 3037, 15 3038, 16 3039, 17 3040,
    18 3041.
13. **Never run `playwright install`.** If the GPU script cannot find a browser, stop and tell
    the orchestrator.
14. **Never run infrastructure commands** (`fly ...`, Cloudflare, deploys).
15. **Gates.** Shots go in `.scratch/armoury-potions/shots/<ticket>/r<N>/` (absolute path, rule
    3). A **fresh reviewer agent** that is not the builder reads them beside the ticket 04
    baseline and writes `review.md` in the round folder; the builder never writes or edits it and
    never self-approves. **The builder's run ends at each gate hand-off**: a fix round goes to a
    fresh builder given the ticket, the Comments and the reviewer's `review.md`, so no agent lives
    across rounds. Append one line per round to the ticket's Comments. At most three rounds per
    gate; a fourth only with the orchestrator's say-so. A tier B item still failing after its
    second fix round is cut and recorded in the ticket's ADR. One gate per ticket.
16. **Ambiguity.** On a one-way door (save format, link format, storage keys, ingredient ids,
    routes, anything that ships bytes to visitors), do not guess: raise a `QUESTION:` in your
    final report. Elsewhere, choose, and say what you chose.
17. **Wand and sword behaviour and strings do not change.** Every existing wand and sword test
    passes untouched unless your ticket says otherwise.
18. **After any push** the orchestrator waits for `gh pr checks` before calling anything green;
    a unit suite that is fast locally can time out on CI, so keep the potion suite under a few
    seconds.

## Build order and ownership

Waves (at most four implementers at once):

```
round 1 (parallel):  01 look spike   02 scene mock   03 schema   04 rigs
round 2 (parallel):  05 (needs 03)   06 (needs 03)
round 3:             07 (needs 03, 05)
round 4 (parallel):  08 (needs 07)   09 (needs 04, 06, 07)
------------------ STOP LINE: wait for Ed's picks from 01 and 02 ------------------
round 5 (parallel):  10 (needs 01 pick, 09)   13 (needs 02 pick, 09; its gate shots need 10)
round 6 (parallel):  11 (needs 10)   14 (needs 10, 04)
round 7 (parallel):  12 (needs 11, 14)   15 (needs 14, 11, 05)   16 (needs 11, 08, 02 pick)
round 8:             17 (needs 08-16)
round 9:             18 (needs 17)
any time, own PR to main, merged by Ed after the epic: 19
```

Files that pass from one ticket to a later one (never held by two at once):

| File | Order of owners |
|---|---|
| `src/potion/potionSchema.ts`, `ingredients.ts`, `pours.ts`, `compile.ts`, `framing.ts` | 03 -> 05 (`ingredients.ts` lore and word columns only) -> 07 (none) -> 10/11 (colour column retune only) |
| `src/potion/bottles.ts` | 03 -> 06 -> 09 (form-gate tuning) |
| `src/potion/geometry.ts`, `tipped.ts`, `outline.ts`, `profile.ts` | 06 -> 09 (form-gate tuning and cuts only) |
| `src/potion/describe.ts`, `effects.ts`, `blends.ts`, `presets.ts`, `doNotUse.ts`, `item.ts` | 05 -> 10 (preset retune only) |
| `src/items/item.ts`, `src/items/registry.ts`, `src/landing.ts`, `src/views.tsx`, `src/router.tsx`, `src/persistence/*`, `src/workbench/WorkbenchProvider.tsx`, `src/shop/shopView.ts`, `src/shop/CloseUp.tsx`, `src/shop/wandShop.ts`, `src/smithy/smithy.ts` | 07 only (one commit widens every `ItemKind` record and union together) |
| `src/street/shops.ts` | 07 (`DOOR_LABELS['/potions']` only) -> 17 (`to`, `spill`) |
| `src/apothecary/apothecary.ts` | 07 -> 08 (`widget`) -> 13 (`Scene`, `paintCard`) |
| `src/potion/framing.ts` (`BASE_LINE`) | 03 -> 09 -> 13 |
| `src/apothecary/pourPicker.tsx` (+ module scss) | 08 -> 16 (pictures in place of swatches) |
| `src/testing/*` | 07 -> 08 -> 16 (`ApothecaryPom.ts`, only if a locator changes) -> 17 |
| `src/shelf/*` | 07 -> 13 (potion box styling only) |
| `src/share/apothecaryCard.ts` | 07 (stand-in) -> 13 |
| `src/stage/boxRig.tsx`, `HeldRig.tsx`, `hold.ts`, `FlourishProbe.tsx` | 04 -> 09 (front handoff and upright fixes only, with the pixel diff re-run) |
| `src/stage/PotionStage.tsx`, `PotionMesh.tsx`, `potionScene.tsx` | 09 -> 10 -> 11 -> 12 |
| `src/stage/potionMaterials.ts` | 10 -> 11 -> 12 |
| `src/stage/PotionCloseUpStage.tsx` | 09 (minimal) -> 10 (lights, environment) -> 14 -> 15 |
| `src/stage/slosh.ts` | 14 |
| `src/stage/potionShow.ts`, `EffectShow.tsx`, `effectKinds.ts` | 15 |
| `src/App.tsx` | 09 (two lazy imports) |
| `src/styles/tokens.scss` | 07 (a plain `[data-shop='apothecary']` block) -> 13 |
| `scripts/gpu-shots.mjs` | 09 -> 10 -> 14 (`--uncork`) -> 12 (`--pour`) -> 18 (15 uses 14's `--uncork`; 16 writes its own `scripts/ingredient-thumbs.mjs`) |
| `README.md` (credits) | 10 -> 18 |

Where two tickets would otherwise collide: 07 is the only ticket that widens `ItemKind`,
`ShopPath`, `ShopView.path` and `ShopView.shop`, because every `Record<ItemKind, ...>` must fill
in the same commit; 11 and 12 both write the liquid shader, so 12 waits for 11; 14 drives the
liquid's surface through the uniforms 10 exposes and does not edit `potionMaterials.ts`.

## ADRs

Format MADR-lite, as `docs/adr/0092-armoury-branch-stepper.md`. Numbers 0104 onward are
reserved for this epic (O8), one per decision-carrying ticket:

| ADR | Subject | Written by |
|---|---|---|
| 0104 | The potion item: pours as ordered slots, compaction, ingredients, the murky rule | 03 |
| 0105 | Upright items on the stage rigs: the hold, the item's own flourish, front framing | 04 |
| 0106 | Potion names, effects and secret blends | 05 |
| 0107 | The bottle generator: lathe profiles, volumes, tipped levels, the outline (09 adds the form gate's cuts) | 06 |
| 0108 | The potion shop on the shell: kind, key, link field, route, `flourishOnArrival`, the pour picker (08 adds a section) | 07 |
| 0109 | The potion's look: glass, liquid, traits, the pour, light, the picture capture (11 and 12 add their sections and cuts) | 10 |
| 0110 | The potion shop's scene, recipe card and picture | 13 |
| 0111 | The potion's close look: the hold, the slosh, the uncorking, effects and the bloom exception (15 completes it) | 14 |
| 0112 | Ingredient pictures | 16 |

Ticket 17 amends ADR 0097 (a third open door); ticket 18 cross-links them and amends 0096 (a
third kind).

## Dependency table

"Before Ed" means it can be fully built and reviewed before Ed picks from the two contact
sheets (O7).

| Ticket | Blocked by | Model | Gate | Before Ed? |
|---|---|---|---|---|
| 01 Look spike | none | opus | Ed's pick | yes (ends in the contact sheet) |
| 02 Scene mock and ingredient pictures | none | opus | Ed's pick | yes (ends in the contact sheet) |
| 03 Potion schema, ingredients, pours, compile | none | sonnet | code review only | yes |
| 04 Rigs: upright hold, item flourish, front framing | none | opus | code review only (plus the wand and sword pixel diff) | yes |
| 05 Names, effects, secret blends, presets, item | 03 | sonnet | code review only | yes |
| 06 Bottle generator | 03 | opus | code review only (judged by eye at 09) | yes |
| 07 The potion shop shell | 03, 05 | opus | code review only | yes |
| 08 The pour picker | 07 | sonnet | code review only | yes |
| 09 Clay stage and the form gate | 04, 06, 07 | opus | form | yes |
| 10 Glass, liquid and light | 01 (Ed's pick), 09 | opus | materials | no |
| 11 Traits in the liquid | 10 | opus | materials | no |
| 12 The pour | 11, 14 (the shots script) | opus | materials | no |
| 13 Scene, recipe card and picture | 02 (Ed's pick), 09; gate shots need 10 | opus | whole shop (the scene round) | no |
| 14 Close look I: hold, tip, slosh | 04, 10 | opus | close look | no |
| 15 Close look II: uncorking and effects | 05, 11, 14 | opus | close look | no |
| 16 Ingredient pictures | 02 (Ed's pick), 08, 11 | opus | materials | no |
| 17 Open the door | 08-16 | sonnet | code review only | no |
| 18 Docs and the final gate | 17 | sonnet | whole shop | no |
| 19 Hub card (own PR to main) | none to build; merged after the epic | sonnet | code review only | yes to build, merged after |
