# armoury potions - Bubble & Brew, the third shop

**Status:** ready-for-agent
**Raised:** 2026-11-13 by Ed. **Re-planned:** 2026-11-13 (evening), after Ed changed the
mechanic (E13-E17): three ingredients that mix, not four pours that stay layered.
**Tickets:** [issues/](issues/) 01-25. 01-08 are done; 09 finishes on the old four-pour schema
(O19); 20-25 are the re-plan's new tickets; 10-18 are revised in place. One epic branch,
`armoury-potions`, one PR to main at the end (O1); ticket 19 (the hub card) is its own PR to main.

## Why

The armoury street has a wand shop and a smithy. The third painted front, "Bubble & Brew"
(`src/street/shops.ts`, id `potions`), is shut. Ed wants it open as a potion shop where a child
makes a potion with some of the feel of brewing, without losing the fun of designing something
pretty (E1). The child picks three ingredients from picture jars; they sit in the bottle as
layers in the order chosen; a tap on the bottle lifts it, swirls the layers into one colour and
pulls the cork, and out comes one of six effects, or nothing at all because the mix went murky
(E13-E16). The bottle, its stopper and its label are designed as in the other shops.

## Sources and precedence

Local working files beside this spec (gitignored; they exist only in the epic worktree at
`/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/`,
so an implementer in an isolated worktree reads them by that absolute path):

- `decisions.md`: Ed's answers E1-E17 and the orchestrator's calls O1-O20. **E7-E17 override
  anything older that disagrees**, including O3's "nothing happens by itself on arrival", O5 and
  O12 (murk as an ingredient) and O6 (rendered jar pictures).
- `replan.md`: the re-plan's summary and the calls it made for Ed.
- `research/experience-options.md`: the research. Option 2 was the direction; its pour-and-layer
  core is replaced by this spec's mix.

Precedence: `decisions.md`, then this spec, then the research.

## The experience, on a phone

1. The street. The child slides along the painting to Bubble & Brew, taps it (its lights come
   up) and taps "Enter Bubble & Brew". The door opens only in ticket 17, the last build ticket.
2. The shop: scene A, the brewing table (E7). A dim, candlelit room: a glass bottle stands on a
   wooden table, three layers of liquid in it in the order they went in (pearly Moonmilk at the
   bottom, a slow pink swirl of Rosehip syrup, gold Starpetal glittering on top), a cork in its
   neck. Beside it a recipe card on string: "No. 4127. Moonmilk, Rosehip and Starpetal. Three
   layers in a teardrop flask. Cloudy, then swirly, then sparkly." The scene's hint: "Tap the
   bottle to mix it". Below, the sheet's first tab, "Pours", is open.
3. Picking. The sheet shows nine jars in a three by three grid, in rainbow order, each with its
   picture (P3, the ingredient itself; placeholders until Ed's sprite sheet is cut in, E8) and
   its name. The bottle is full, so the jars say "The bottle is full. Tap it to mix it, or empty
   it to start again." She taps "Empty the bottle": the layers go. She taps Frogfizz, Frogfizz,
   Bluebell dew: each pour lands as a new layer on top (a thin stream, the band rises). The same
   ingredient may go in two or three times (E17).
4. The mix. She taps the bottle. It lifts into the middle of the darkened shop, rises a little
   more, and its three layers swirl into one colour. The cork twists out with a pop and the
   potion's effect comes out of the neck in its colours: big slow bubbles float up for a Floating
   potion. The card's name appears: "Floating Frogfizz Potion". If the three clashed, the liquid
   goes a murky brown-green and one lazy bubble goes "blorp": "Swampy Surprise". The cork goes
   back in.
5. Free play. Dragging leans and tips the held bottle, the liquid stays level and sloshes; let go
   and it rights itself. A tap on the bottle (or "Mix it") replays the lift, the swirl and the
   uncorking. "Put it back" sets it down on the table, still mixed.
6. After the mix. The potion stays mixed until "Empty the bottle" (E15). The jars say "This
   potion is mixed. Empty the bottle to make a new one." The bottle, stopper, label and glass can
   still change. The shelf and the share picture show the mixed potion.
7. The bottle and its finish. The "Bottle" tab picks its shape (round flask, teardrop flask, tall
   bottle, square-shouldered bottle, gourd bottle), its neck (short to long) and its glass (clear,
   sea green, amber, violet, smoky). The "Finish" tab picks a stopper (cork, glass stopper, sealed
   with wax) and a label (none, round, banner, a tag on a string).
8. Try another. Pours three random ingredients into a random bottle with a random finish, in a
   quick cascade, unmixed, ready for a tap. A lock on any group keeps it. There is no "Put the
   last one back" in the potion shop (E17); the wand shop and the smithy keep theirs.
9. A secret blend. Some recipes are secret blends: two Thunderclouds and a Moonmilk, mixed, is
   "The Moon Behind the Storm". The name, the gold label and recipe card and the lore come with
   the mix. Nothing tells her which recipes are secret; there is no book to fill.
10. Keep, rename, share. As in the other shops: the name can be renamed (the label shows the new
    name), "Keep this potion" puts it on Your shelf, a link opens it for anyone at `/shared`, and
    "Save a picture of this potion" downloads its card (P2, E12).

On a desktop the panel is the order slip, as in the other shops, with the same three groups.

## The item

Kind `potion`. Groups in order: `pours` "What goes in" (tab Pours), `bottle` "The bottle" (tab
Bottle), `finish` "Stopper and label" (tab Finish). Locks work on each group. **Try another
keeps nothing but locked groups** (`keeps: []`).

### Params by group

**pours**

| Param | Type | Options | Default | Label | Coupling |
|---|---|---|---|---|---|
| `pour1` | choice | `none` (weight 0), then the nine ingredient ids (weight 1 each) | `moonmilk` | First ingredient | |
| `pour2` | choice | as `pour1` | `rosehip` | Second ingredient | `none` only while `pour1` is `none` |
| `pour3` | choice | as `pour1` | `starpetal` | Third ingredient | `none` only while `pour2` is `none` |
| `mixed` | choice | `no` "Not mixed" (weight 1), `yes` "Mixed" (weight 0) | `no` | Mixed | `yes` only while `pour3` holds an ingredient |

- **Three ordered slots, no gaps.** `allowed(p)` for `pourN` (N > 1) is `['none']` while
  `pour{N-1}` is `none`, else every option with `none` first. `mixed`'s `allowed(p)` is `['no']`
  while `pour3` is `none`, else `['no', 'yes']`. `normalise` runs its second pass in schema
  order, so a gap empties everything above it and an under-filled bottle is never mixed.
- **Adding** goes to the lowest empty slot (`potionItem.follows`, kept from ticket 03). There is
  no taking one out: "Empty the bottle" sets every slot to `none`, which also unmixes.
- **Mixing** is a `set` of `mixed` to `yes`, made by the shell at the uncorking's reveal (ticket
  21). Nothing else sets it; changing the bottle or finish keeps it.
- **Try another** always pours three (every `none` weight 0) and never mixes (`yes` weight 0).
- The keys `pour1`-`pour3` stay from ticket 03 (`pour4` goes). Nothing has shipped, so there is
  no migration: a dev save or link with `pour4` or `bogmurk` simply normalises.

**bottle** (unchanged)

| Param | Type | Options / range | Default | Label |
|---|---|---|---|---|
| `shape` | choice | `round` "Round flask", `teardrop` "Teardrop flask", `tall` "Tall bottle", `shoulder` "Square shoulders", `gourd` "Gourd bottle" | `teardrop` | Shape |
| `neck` | number | 0-1, step 0.05 | 0.4 | Neck, ends "Short", "Long" |
| `glass` | choice | `clear` (weight 4), `sea` "Sea green" (2), `amber` (1), `violet` (1), `smoky` (1) | `clear` | Glass |

**finish** (unchanged)

| Param | Type | Options | Default | Label |
|---|---|---|---|---|
| `stopper` | choice | `cork` "Cork" (weight 5), `glass` "Glass stopper" (2), `wax` "Sealed with wax" (2) | `cork` | Stopper |
| `label` | choice | `none` "No label", `round` "Round", `banner` "Banner", `tag` "Tag on a string" | `round` | Label |

- The glass stopper takes the bottle's glass tint. The wax seal's colour is derived: the mixed
  colour (or the top layer's, unmixed), darkened.
- A label carries the potion's name (or the child's rename) in ink, in the shop's display face.
  Tier B, as before: if the materials gate finds it unreadable at box size after its second fix
  round, the label is a plain paper shape with a ruled ink line.
- Each ingredient fills a third of the bottle (`fill = layers / 3`); a mixed potion is full.

### The ingredients

One data row per ingredient in `potion/ingredients.ts`, **in wheel order** (the jar grid reads as
a rainbow, row by row). Ids are persisted and never change; labels, words, colours and lore may.
Colours are starting values: ticket 10 retunes them under Ed's picked light so every
neighbouring layer pair reads as two layers.

| Wheel | Id | Label | Word | Colour | Trait | Own effect | Lore line |
|---|---|---|---|---|---|---|---|
| 0 | `emberroot` | Emberroot | Emberroot | `#ea7b2c` ember orange | glow | glowing | Emberroot stays warm long after it is dug up. |
| 1 | `starpetal` | Starpetal | Starpetal | `#f2c14e` gold | glitter | glowing | Starpetals only open after dark, and then they glow. |
| 2 | `frogfizz` | Frogfizz | Frogfizz | `#7ccf4f` spring green | fizz | floating | Frogfizz hops about in the jar when nobody is looking. |
| 3 | `snailshine` | Snailshine | Snailshine | `#7fd6c8` pearly teal | swirl (a pearly sheen) | sparkling | Snailshine is the silver trail a snail leaves on a wet night. |
| 4 | `bluebell` | Bluebell dew | Bluebell | `#5b8def` cornflower blue | clear | sparkling | Bluebell dew is gathered before the birds wake up, while it still twinkles. |
| 5 | `thundercloud` | Thundercloud | Thundercloud | `#4b3f8f` storm indigo | glitter (silver flecks) | whirling | Thundercloud rumbles when it is cross. |
| 6 | `moonmilk` | Moonmilk | Moonmilk | `#ece6f4` pearly white | cloud | dreamy | Moonmilk is skimmed off puddles on full-moon nights. |
| 7 | `rosehip` | Rosehip syrup | Rosehip | `#d9467a` deep pink | swirl | dreamy | Rosehip syrup stirs itself if you hum it a lullaby. |
| 8 | `puffcap` | Puffcap | Puffcap | `#c9343f` toadstool red | cloud (drifting spores) | whiffy | Puffcaps go puff if you poke them, so nobody pokes them twice. |

- **Puffcap** (new, E16) replaces Bog murk: a small red toadstool with pale spots that puffs out
  a cloud of spores. Red sits between Rosehip's pink and Emberroot's orange on the wheel, so the
  wheel is a full rainbow loop.
- **Own effect** is the effect of three of that ingredient, and is fixed by the wheel (below);
  the column must agree with `mixPotion([id, id, id])` (a unit test). Three changed from ticket
  05: Starpetal sparkling to glowing, Bluebell floating to sparkling, Rosehip whirling to dreamy.
  Their lore lines are nudged to match.
- **Traits** (what a layer looks like at rest, judged at the materials gate): `clear`, `cloud`,
  `fizz`, `glitter`, `glow`, `swirl` as before, plus `murk` (milky brown-green with slowly sinking
  specks), which no ingredient has: only a murky mix shows it. A trait is tier B if it fails its
  gate twice: its ingredients fall back to `clear` (`cloud` for Moonmilk and Puffcap), recorded
  in ADR 0109.

### The mixing rule

Pure, in `potion/mix.ts`: `mixPotion(ids: readonly [IngredientId, IngredientId, IngredientId]):
PotionMix`. Order never changes the result; order only sets the layers before the mix.

**The wheel.** The nine ingredients sit round a colour wheel in rainbow order, 40 degrees apart:
ingredient `w` at angle `40 * w` degrees. The wheel is cut into six equal sectors of 60 degrees,
one per effect; sector `k` covers `[60k - 3.25, 60k + 56.75)` degrees and the sectors in order
are glowing (k 0), floating (1), sparkling (2), whirling (3), dreamy (4), whiffy (5). So
Emberroot and Starpetal fall in glowing, Frogfizz alone in floating, Snailshine and Bluebell in
sparkling, Thundercloud alone in whirling, Moonmilk and Rosehip in dreamy, Puffcap alone in
whiffy.

**The mix.** Add the three ingredients' unit vectors on the wheel. If the sum is shorter than
`MURK_REACH = 0.78` the mix is **murky**. Otherwise its outcome is the effect of the sector the
sum points into.

What a child learns by playing (the rule's shape):

- Three of the same is always that ingredient's own effect, never murky.
- Two of the same usually win (45 of the 72 two-and-one recipes give the pair's effect); a
  neighbour can pull it next door, and Frogfizz, Thundercloud and Puffcap, which each have an
  effect to themselves, pull hardest (two Emberroot and a Puffcap is Whiffy).
- Neighbours on the wheel mix to a neighbour's effect.
- Three from all round the wheel cancel out and go murky, as opposite paint colours make mud
  (orange against blue, gold against indigo, green against red). Exactly: three different
  ingredients whose gaps round the nine-step wheel are 3, 3, 3 or 2, 3, 4 in some order. A repeat
  is never murky.
- Surprises: 6 of the 84 three-different recipes land on an effect none of the three has
  (Starpetal, Snailshine and Bluebell is Floating).

**The odds** (computed over all 165 multisets of three from nine, and pinned by a unit test):
glowing 24, floating 24, sparkling 24, whirling 24, dreamy 24, whiffy 24, murky 21. So of the
different recipes a child can make, about one in seven goes murky and about one in seven gives
each effect (E16). Under Try another (three independent picks, 729 equally likely orders) every
murky recipe has six orders and a repeat fewer, so there murky is 126 of 729 (about 1 in 5.8) and
each effect 100 or 101 (about 1 in 7.2); the test pins these numbers too. The nearest any sum
comes to a sector edge is 1.12 degrees, so no float rounding can flip an outcome; a test asserts
a margin of at least 1 degree.

**`PotionMix`**: `{ outcome: EffectKind | 'murky'; colour: string; trait: Trait; main:
IngredientId | null; strength: 1 | 2 | 3; angle: number; reach: number }`.

- `angle` (degrees) and `reach` (the sum's length, 0-3) are kept for the stage and the colour.
- **`main`**, for an effect outcome: among the three whose own effect is the outcome, the most
  repeated, a tie going to the one nearest `angle` on the wheel; if none of them has it (a
  surprise), the ingredient nearest `angle`. Null when murky.
- **`strength`**: how many of the three have the outcome as their own effect, at least 1 (1 when
  murky). More of the same is a bigger show.
- **`trait`**: `main`'s trait; `murk` when murky.
- **`colour`**, designed, never an RGB average:
  - Effect: the hue at `angle` round the wheel, interpolated in OKLCH between the two ingredient
    colours either side of it (the shorter way round the hue circle), then pulled into a jewel
    range: chroma scaled by `0.75 + 0.25 * s` where `s = (reach - 0.78) / (3 - 0.78)`, then
    raised to at least `0.12`; lightness clamped to `[0.58, 0.78]`. So a pure mix is its
    ingredient's colour at full strength (pale Moonmilk is lifted to a jewel lavender), a mix that
    nearly clashed is a little dusky, and none is muddy. Starting values, checked by script: the
    first-visit recipe mixes to `#c85370`, three Moonmilk to `#c9a3f5`, three Bluebell to its own
    `#5b8def`, Frogfizz, Bluebell and Puffcap (murky) to `#645e40`.
  - Murky: a designed mud, `#5b5533` (OKLCH about 0.45, 0.05, 100), moved 15 percent in OKLab
    towards the mean of the three ingredient colours, then chroma capped at `0.05` and lightness
    clamped to `[0.38, 0.48]`. Every murky mix is brown-green, each a little different.
  - The numbers are starting values; ticket 23 tunes them at its gate. Tests pin the bounds, not
    the hex values.
- `potionMix(p: Params): PotionMix | null`: the mix of the three slots whenever all three are
  filled, mixed or not (the stage needs it to play the first swirl); null otherwise.

### The effect: what it does

Decided (E3, O3, O4, E13). One parameterised system: six effect kinds plus murky, each a bounded
particle show in the potion's colours. Pure, in `potion/effects.ts`.

| Kind | Word | What comes out of the neck | Effect sentence |
|---|---|---|---|
| `floating` | Floating | big, slow, see-through bubbles drift up and away | Pull the cork and bubbles float up to the ceiling. |
| `sparkling` | Sparkling | a fountain of glitter rises and rains back down | Pull the cork and it fizzes with glitter. |
| `dreamy` | Dreamy | a few soft stars rise, twinkle and fade | Pull the cork and sleepy stars drift out. |
| `glowing` | Glowing | warm motes like fireflies spiral out and hover | Pull the cork and little lights come out to play. |
| `whirling` | Whirling | a ribbon of coloured light spirals up | Pull the cork and a whirl of colour spins out. |
| `whiffy` | Whiffy | one small round puff of coloured smoke | Pull the cork and out comes a very small pong. |
| `murky` | Murky | one fat, lazy bubble wobbles out of the neck and pops | Pull the cork and one lazy bubble goes blorp. |

- `potionEffect(p): PotionEffect | null`: null unless `mixed` is `yes`. `{ kind, strength,
  colours }`, `colours` being the mixed colour first, then the colours of the ingredients whose
  own effect is the outcome, unique, in pour order.
- Murky is inert (E13): its one bubble is the whole show, so a murky potion is charming, not a
  failure.
- No effect is acted out by the bottle or the room; no per-effect bespoke animation.

### Names, tag lines, lore

All derived (`potion/describe.ts`), never stored, apart from a child's rename. The mix reveals the
name: the name changes at the uncorking's pop.

- **Name**, first match wins:
  1. Empty: "An Empty Bottle".
  2. Not mixed: the layers in pour order, by word, with repeats folded: "Moonmilk", "Moonmilk
     and Rosehip", "Moonmilk, Rosehip and Starpetal", "Double Frogfizz and Bluebell" (the folded
     word takes the place of its first pour), "Triple Starpetal".
  3. Mixed, a secret blend: its own name.
  4. Mixed, murky: one of seven murky names, `MURKY_NAMES[(sum of the three wheel places) % 7]`:
     0 "A Marvellous Muddle", 1 "Bottled Bog", 2 "Frog's Bathwater", 3 "Swampy Surprise",
     4 "Grumbling Gloop", 5 "Muddy Wellies", 6 "Tadpole Puddle".
  5. Mixed, three of the same: "Pure {Label}", title-cased (O16): "Pure Bluebell Dew".
  6. Mixed otherwise: `{Effect word} {main's word} {Noun}`, the noun from the shape: round
     "Brew", teardrop "Potion", tall "Essence", shoulder "Wonder", gourd "Swirl". "Floating
     Frogfizz Essence", "Whiffy Puffcap Swirl". (Tonic, Drops and Mixture are gone: they read as
     medicine.)
- **DO_NOT_USE** (unchanged requirement, below). A mixed name that matches falls back to `{Effect
  word} {main's word} Brew`, then to "{Label} {Noun}". A unit test sweeps every reachable name:
  every ordered fill of one to three slots unmixed, every multiset mixed, in every shape.
- **Tag line:**
  - Empty: "An empty {shape noun}, waiting for three ingredients."
  - Not mixed: "{One layer / Two layers / Three layers} in a {shape noun}. {Traits, bottom first,
    joined by ', then '}." with repeats in a row merged, as ticket 05 built it.
  - Mixed: "Mixed from {word}, {word} and {word} in a {shape noun}." in pour order, so the card
    keeps the recipe ("Mixed from Frogfizz, Frogfizz and Bluebell in a tall bottle.").
  - Trait words as before plus `murk` "murky"; shape nouns as before.
- **Lore:**
  - Empty: "Every potion starts as an empty bottle. Pick three ingredients."
  - Not mixed, one or two layers: the top layer's lore line, then "It needs one more before it
    can be mixed." / "It needs two more before it can be mixed."
  - Not mixed, three: the top layer's lore line, then "Tap the bottle to mix it and see what it
    does."
  - Mixed, a secret blend: its own two sentences.
  - Mixed, murky: "Three things that would not get on, swirled into one. It does nothing at all,
    and it is very proud of that." then the murky effect sentence.
  - Mixed otherwise: `main`'s lore line, then the effect sentence.
- **Shelf line:** "{Shape label}, empty", "{Shape label}, two layers", or, mixed, "{Shape label},
  {effect word in lower case}" ("Gourd bottle, whiffy", "Tall bottle, murky").
- **Glow** (`#rrggbb`): the mixed colour when mixed; the top layer's colour when not; candle
  `#e8b46a` when empty.
- **Gold:** `isGold(p)` is true only for a mixed secret blend; the stage, the label, the recipe
  card and the card painter read it.
- **Shop number**, **lengthFraction:** as before.

### Secret blends

A curated table in `potion/blends.ts`: an unordered recipe of three (a multiset, matched in any
order), a name and two lore sentences. A blend counts only once mixed. It changes the name, the
lore and the gold; the effect and colour come from the mixing rule as for any recipe. Reused from
ticket 05's lore where it still fits (lore with "then" in it is reworded for a mix):

| Id | Recipe | Name | Outcome | Lore |
|---|---|---|---|---|
| `moon-behind-storm` | thundercloud x2, moonmilk | The Moon Behind the Storm | whirling | Dark clouds rolled over the hill and the moon hid behind them. She was only waiting for her turn to shine. |
| `sunrise` | bluebell, starpetal, emberroot | Sunrise in a Bottle | glowing | Cool blue dew, a little gold and a warm orange glow, swirled together. The whole morning fits in here, birdsong and all. |
| `sunset` | emberroot, rosehip, thundercloud | Sunset in a Bottle | dreamy | A warm orange glow, a blush of pink and the deep blue of the coming night. Hold it up and the day is just going to bed. |
| `pond-life` | frogfizz, snailshine, bluebell | Pond Life | sparkling | A frog, a snail and a drop of dew. Somebody lives here, and they are very happy about it. |
| `frogspawn` | frogfizz x2, moonmilk | Frogspawn Surprise | floating | Green and pearly, with little dots in it, as if something is about to hatch. Nobody knows what, and that is the best part. |
| `milky-way` | moonmilk x2, starpetal | The Milky Way | dreamy | Two big soft clouds of moonmilk with a scatter of stars stirred in. Look closely and it goes on for ever. |
| `pink-ribbons` | rosehip x2, moonmilk | Pink Ribbons | dreamy | Pink and pearl, wound round and round like ribbon on a present. Somebody tied a very good bow. |
| `storms-gold-star` | thundercloud x2, starpetal | The Storm's Gold Star | whirling | Two dark storm clouds and one bright star that would not be put out. Even the thunder had to admit it was brave. |
| `sea-glass` | snailshine x2, bluebell | Sea Glass | sparkling | Teal and blue, smooth as a pebble from the beach. The waves have been rolling it about for a hundred years. |
| `clouds-blue-day` | moonmilk x2, bluebell | Clouds on a Blue Day | whirling | White clouds and a patch of blue sky, blowing about. It is the sort of weather that makes you want to lie on the grass. |
| `bottom-of-the-pond` | frogfizz, thundercloud, puffcap | Bottom of the Pond | murky | Three things that do not get on, all in one bottle, gone wonderfully murky. Frogs would pay a fortune for this. |
| `pocketful-of-stars` | starpetal x3 | A Pocketful of Stars | glowing | Three starpetals in one bottle, all twinkling at once. Handle with care, because they like to wander. |

A Pocketful of Stars wins over "Pure Starpetal". At most 12 blends; recipes unique.

### Presets

`potion/presets.ts`, eight potions, each normalising to itself, covering every shape, stopper and
label, every ingredient, every one of the seven outcomes and one secret blend:

| # | Name | Recipe (pour order) | Mixed | Bottle and finish | Outcome |
|---|---|---|---|---|---|
| 0 | Rosy Moonrise (first visit) | moonmilk, rosehip, starpetal | no | teardrop, neck 0.4, clear, cork, round | (dreamy once mixed) |
| 1 | Early Riser | bluebell, starpetal, emberroot | yes | round, 0.3, sea, glass stopper, banner | Sunrise in a Bottle |
| 2 | Puddle Jumper | frogfizz, bluebell, puffcap | yes | tall, 0.6, smoky, wax, tag | murky |
| 3 | Brewing Weather | thundercloud, snailshine, moonmilk | yes | shoulder, 0.5, violet, cork, none | whirling |
| 4 | Hearth Warmer | emberroot, emberroot, puffcap | yes | gourd, 0.7, amber, cork, round | whiffy |
| 5 | Pebble Beach | snailshine, bluebell, bluebell | yes | teardrop, 0.8, sea, glass stopper, tag | sparkling |
| 6 | Night Sky | moonmilk, moonmilk, rosehip | yes | round, 0.1, violet, wax, banner | dreamy |
| 7 | Lily Pad | frogfizz, frogfizz, snailshine | yes | tall, 0.9, clear, glass stopper, round | floating |

The first-visit potion is full and unmixed, so the first tap on the bottle shows the whole mix.
Ticket 10 may retune the bottles and finishes at the materials gate; recipes stay.

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

The same list is checked against every secret blend, murky name and preset name. No franchise
vocabulary in ingredient names, lore or UI copy (apps/armoury/CLAUDE.md "No franchise
vocabulary"). Names never mention drinking (ticket 05's sweep stays).

## The look and the scene, in words

Settled by Ed's picks (E7-E12): scene A, ingredient pictures P3, glass G1, liquid L2, light M1,
share picture P2.

- **Moody but accessible** (E5). A dim apothecary at night: warm candlelight from one side (M1:
  one candle and a cool rim), deep shadows, jars on shelves in the gloom behind the brewing
  table. The bottle is the brightest, most saturated thing in the scene; its liquid's glow lights
  the table a little. The controls, card and text keep the app's contrast.
- **The bottle** (G1, thin clear glass). Fake glass as `stage/Gems.tsx` does it, no
  `transmission` (two WebGL contexts already run in the close look, ADR 0077). Render order:
  glass back, liquid, particles, glass front; `depthWrite: false` on the glass. ACES tone mapping
  and no post pass at rest on this canvas only (the spike's finding, ticket 10 records it).
- **The liquid, in two states** (L2, soft band edges).
  - *Layered* (not mixed): one band per ingredient between level planes that keep each third of
    the volume, soft-edged, each with its trait.
  - *Mixed*: one liquid of the mixed colour, full, with the mix's trait (`murk` for a murky mix).
  - *Between them* (the swirl, ticket 23): a `uMix` uniform 0-1 blends the bands into the mixed
    colour through a vortex (a domain warp twisting about the bottle's axis, strongest mid-swirl,
    the ingredient colours streaking through it), and a `uSwirl` uniform 0-1 drives the vortex
    alone so a replay can swirl an already mixed potion, its ingredient colours flaring through
    the streaks and fading back.
  - The fragment shader discards above a level surface plane in world space, banding by the
    plane `dot(p, u) = h` in the bottle's millimetre frame (ticket 06's review). A time uniform
    drives the motion; frozen under reduced motion and for real-GPU shots (`?freeze=<seconds>`,
    dev only).
- **Glow** stays under `0.92 * BLOOM_THRESHOLD` at rest (ADR 0082, 0083); the uncorking is the
  one bounded exception, in the close look only, recorded in ADR 0111.
- **No steam or smoke at rest.** The Whiffy puff and the murky bubble are short-lived and small.
- **Framing.** The box stage looks at the bottle from the front, a little above. The bottle stands
  on a base line shared with the scene art (`potion/framing.ts`; about 0.70 of the scene on desk
  and 0.62 on the phone, settled in ticket 13).
- **The scene** (A, the brewing table, plain, without B's window): the table, a candle, shelves of
  jars in the dark behind, the recipe card on string beside the bottle, drawn in CSS and SVG like
  the smithy, its palette under `[data-shop='apothecary']` in `styles/tokens.scss` (from
  `mock/mock.css`, O17). A candle flicker of a few percent, off under reduced motion.
- **The picture** (P2): the stage's capture drawn over the card's own ground, not on a
  transparent background.
- **Ingredient pictures** (P3): the ingredient itself, painted, not a jar. Placeholders through
  the build, cut by the same script that later cuts Ed's sprite sheet (tickets 16, 24, 25). Ed
  insists on high art quality: the final pictures must sit with the scene's finished art.

## Accessibility and reduced motion

- Every jar is a real button named "Pour in {Label}"; when the bottle is full or mixed the jars
  are `aria-disabled` and the reason is visible text. "In the bottle" is a list, top layer first,
  with no per-row buttons. "Empty the bottle" is the one removal. A polite live region says what
  changed: "Frogfizz poured in. Two of three." / "Bluebell dew poured in. Three of three. Tap the
  bottle to mix it." / "The bottle is empty." The picker is fully keyboard operable.
- The close look announces the reveal politely: "{name}. {lore}" (for a mix, the main
  ingredient's line and the effect sentence).
- Text on panels, the card and buttons meets WCAG AA (4.5:1, 3:1 for large text and focus rings)
  against the shop's dark palette; a unit test reads the `[data-shop='apothecary']` block and
  checks the pairs. Mood comes from the scene, never from low-contrast text.
- Colour is never the only cue: every jar and layer shows its name, the mixed potion's name and
  shelf line say its effect (or "murky"), and traits differ in texture as well as colour.
- Reduced motion (`prefers-reduced-motion`): no pour stream (a pour fills at once), no Try
  another cascade, no candle flicker, no idle trait motion, no idle turn, no slosh wobble, no
  flying lift or put-back. **The mix:** no lift beat and no swirl: the layers cross-fade to the
  mixed potion over 0.3 s, the stopper is shown out without travelling, the effect shows as a
  still arrangement of its particles that fades in over 0.3 s, holds 1.2 s and fades out over
  0.5 s, the stopper is back. The reveal (name, gold, save) comes at 0.3 s.

## Save and share

Per ADR 0096: a new kind, a new storage key and a new link field, no format change.

- `ITEM_KINDS` is `['wand', 'sword', 'potion']`.
- Save key `armoury:save:potion` (`POTION_SAVE_KEY`), the same document shape, decoded through
  `potionSchema`, in `PROFILE_KEYS`. **Never bump `SAVE_FORMAT_VERSION`.**
- Link field `potion`: `#w=<base64url(JSON({ version: 1, potion: { params, name? } }))>`.
- The params carry `pour1`, `pour2`, `pour3` (in pour order, no gaps) and `mixed` (`no` or
  `yes`). A mixed potion's link opens mixed; its first close look still plays the lift, swirl and
  uncorking (the replay form).
- **No migration.** Nothing has shipped: kind, path, key and link field are as built in ticket 07,
  and a dev save or link from the four-pour build normalises (a `pour4` is dropped, a `bogmurk`
  falls back).
- Last shop value `potion`; path `/potions`; `ShopView.shop` `apothecary`.
- One bench per kind: the potion's locks and autosave are its own and survive walking between
  shops.
- These names are one-way doors once shipped: fixed here and changed only with Ed.

## The shelf

A "Potions" section after Swords, shown only when it has something in it. A potion entry is the
shelf's usual box with the bottle's silhouette as inline SVG (`PotionOutline`): the glass outline,
the stopper, and the liquid as flat bands in their ingredient colours, or, mixed, one fill in the
mixed colour; its name, number, shelf line and a seal in its glow colour. "Take it out" loads it
on the potion bench and goes to `/potions`. Ticket 13 may restyle the box to match the scene.

## Shop copy

| Use | Potion shop |
|---|---|
| Motto | potions mixed to order |
| Scene button | Pick the bottle up |
| Scene hint | Tap the bottle to mix it |
| Close look title | Your potion, up close |
| Close look action | Mix it |
| Close look hint | Tap it to mix it. Drag to tip it. |
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
| Jars, full | The bottle is full. Tap it to mix it, or empty it to start again. |
| Jars, mixed | This potion is mixed. Empty the bottle to make a new one. |
| Empty | Empty the bottle |

"Put it back", "Try another" and "On your shelf" are shared. "Put the last one back" is not shown
in the potion shop (`ShopView.offersPutBack: false`, ticket 21).

## The close look: lift, swirl, uncork

Built on `HeldRig` (ADR 0105). The tap on the bottle in the scene is the close look's lift (E14);
the potion now **flourishes on arrival** (`closeUp.flourishOnArrival: true`), replacing O3's
"nothing happens by itself on arrival".

- **The show** (one pure clock, `stage/potionShow.ts`, after `swordGlow.ts`; beats proposed in
  ticket 23, settled at its gate): the bottle eases upright and rises a little more (the lift,
  0-0.4 s); the layers swirl into one colour (0.4-1.6 s; `uMix` 0 to 1 on a first mix, `uSwirl`
  alone on a replay); the stopper twists a quarter turn and rises (1.6-1.9 s); **the pop and the
  reveal at 1.9 s** (`MIX_REVEAL_SECONDS` in `potion/mixBeats.ts`); the effect emits (1.9-2.7 s)
  and lives on (to 4.4 s); the stopper settles back (4.4-4.9 s); the bottle sinks back to the hold
  (4.9-5.2 s).
- **The reveal.** The shell sets `mixed` to `yes` at `MIX_REVEAL_SECONDS` after the flourish
  starts (reduced motion: `MIX_REVEAL_SECONDS_REDUCED`, 0.3 s), so the name, the gold and the save
  change exactly at the pop. If the close look is closed before then, the set is made at once on
  closing. A potion already mixed sets nothing (ticket 21).
- **Fewer than three ingredients.** The lift still happens (it is the close look); the flourish
  plays only a short stopper rattle (the stopper jiggles in its seat for 0.4 s, no pop), nothing
  swirls and nothing is set. The caption's tag line and lore say how many more it needs.
- **A tap or "Mix it"** replays the show; a tap during a show restarts it. Drag to lean (up to 60
  degrees) and tip (up to 45 degrees) stay, as free play between shows; the rig's upright weight
  holds the bottle upright through a show. The liquid stays level and sloshes (a damped spring on
  the surface's tilt, `stage/slosh.ts`) in both states.
- **Bounds.** Effects are at most a few hundred small instanced particles and at most six smoke
  sprites, inside a box above the neck that stays on screen, gone by the end of the show. They
  may exceed the bloom cap during the show only.
- No acted-out behaviour beyond the lift and the swirl, no drinking, no spell, no shop flash
  (`flashDelaySeconds: null`).

## Out of scope

- Option 3's cauldron, and any second scene or phase in the shell.
- A discovery collection or book of secret blends or outcomes; any new persistent document.
- Drinking, a character who drinks, any reaction scene.
- Per-effect bespoke animation; the bottle acting out its effect.
- Unmixing, taking one ingredient out, undoing "Empty the bottle".
- Free colour averaging (the mixed colour comes from the wheel rule only); steam or mist at rest;
  real refraction (`transmission`).
- **Optional, recommended cut:** charms on a thread; label icons.
- Sound. Real-phone checks and taste calls, which ticket 18 lists for Ed.

## Testing

Proof follows the repo's split: unit tests for the layer below, `.iwft` for state through the UI,
real-GPU gates for anything judged by eye.

- **Unit (generator, pure, three-free):** schema coupling (no gaps; `mixed` only when full); Try
  another always three and never mixed; the mixing rule over all 165 multisets (the counts above,
  exactly), order-free over every permutation, pure recipes give their own effect and are never
  murky, murky exactly when the gaps are 3,3,3 or 2,3,4, the 1-degree sector margin, the odds
  under 729 ordered picks; mixed colours (effect chroma at least 0.12, murky chroma at most 0.05
  and lightness at most 0.5, deterministic, order-free); `main` and `strength`; every reachable
  name against `isForbiddenName` and the drinking sweep; blends unique, unordered, reachable and
  only when mixed; presets normalise to themselves and cover the seven outcomes; the lathe and
  level maths with three thirds; the outline in both states. A chosen catalogue, never hundreds of
  random potions; no wall-clock assertions.
- **Unit (stage clocks, pure):** `stage/hold.ts`, `stage/slosh.ts`, `stage/potionShow.ts` (beats
  in order, the pop exactly at `MIX_REVEAL_SECONDS`), the effect programs: bounded, continuous at
  60 Hz, back to rest, steady under reduced motion.
- **iwft** (fakes, never pixels): the shop's flow in `src/apothecary.iwft.tsx` (the mix through
  the close look, the reveal, the save), the picker in `src/pours.iwft.tsx`, the shelf, shared
  view and street additions in their existing suites.
- **Real-GPU gates** (`scripts/gpu-shots.mjs`, ANGLE Metal, never SwiftShader, never `playwright
  install`), judged by a fresh reviewer beside the wand and sword baseline from ticket 04: form
  (09), materials (10, 11, 12, 25), the scene round (13), the close look (14, 23, 15), the whole
  shop (18).
- **Wand and sword unchanged:** every wand and sword test passes untouched throughout; ticket 04's
  pixel diff is re-run at ticket 18.

## Rules for the team

1. **Read first:** `apps/armoury/CLAUDE.md` (all of it, especially "Adding a shop" and the
   rules), `apps/armoury/CONTEXT.md`, this spec, your ticket.
2. **Exclusive file ownership.** Edit only the files your ticket lists. If you need a line
   elsewhere, ask the orchestrator. Hand-offs are in "Build order and ownership".
3. **Worktrees.** Implementers run in their own git worktree off `armoury-potions` (O2): `git
   switch -c <branch> armoury-potions`. Run `pnpm install --frozen-lockfile` first. `.scratch/`
   other than `spec.md` and `issues/` is not in git: read `decisions.md` and `research/` and write
   every shot, set file and review into the epic worktree by absolute path,
   `/Users/edward.barnes@glean.co/Code/Worktrees/HomeOfEd/armoury-potions/.scratch/armoury-potions/`.
4. **Commits.** `git add <explicit paths>`, never `-A` or `.`. Message style `armoury: <what
   changed, as a sentence>` (ticket 19: `hub: ...`). No co-author or agent attribution lines (O9).
   Never push. Never commit for another ticket. Never `git stash` without a unique tag.
5. **Never the em dash character**, anywhere. Plain hyphens.
6. **Comments** only for genuinely obscure code, one or two lines. Rationale goes in the ADR. No
   reminders or future-work notes in any CLAUDE.md.
7. **No franchise vocabulary** (the DO_NOT_USE requirement above).
8. **Motion.** Everything that moves honours `prefers-reduced-motion`, as "Accessibility and
   reduced motion" says.
9. **three.js stays behind the stage seam.** Only `stage/*.tsx` imports three or R3F. The pure
   generator (`potion/`) is three-free. The main chunk may import `potion/compile.ts`, `mix.ts`,
   `mixBeats.ts`, `profile.ts`, `outline.ts`, `framing.ts` and the data tables, never
   `potion/geometry.ts` or `potion/tipped.ts`.
10. **TDD.** Write the failing test first. iwft for state through the UI, unit tests for the
    layer below; do not over-test.
11. **Scoped checks while neighbours are mid-edit** (`pnpm --filter armoury exec vitest run
    <dir>`); the full verify loop runs at the integration points (tickets 20+21+22 together, 17,
    18). Use `pnpm --filter armoury run <script>`, never `turbo --filter`.
12. **Playwright CT is one machine-wide resource** (port 3111 and `playwright/.cache`). Ask the
    orchestrator before any CT run. Dev servers for shots use your ticket's own port (`pnpm
    --filter armoury exec vite --port <yours> --strictPort`): 09 3032, 10 3033, 11 3034, 12 3035,
    13 3036, 14 3037, 15 3038, 16 3039, 17 3040, 18 3041, 23 3042, 24 3043, 25 3044.
13. **Never run `playwright install`.** If the GPU script cannot find a browser, stop and tell the
    orchestrator.
14. **Never run infrastructure commands** (`fly ...`, Cloudflare, deploys).
15. **Gates.** Shots go in `.scratch/armoury-potions/shots/<ticket>/r<N>/` (absolute path, rule
    3). A **fresh reviewer agent** that is not the builder reads them beside the ticket 04
    baseline and writes `review.md` in the round folder; the builder never writes or edits it and
    never self-approves. **The builder's run ends at each gate hand-off**: a fix round goes to a
    fresh builder given the ticket, the Comments and the reviewer's `review.md`. Append one line
    per round to the ticket's Comments. At most three rounds per gate; a fourth only with the
    orchestrator's say-so. A tier B item still failing after its second fix round is cut and
    recorded in the ticket's ADR. **One gate per ticket.**
16. **Ambiguity.** On a one-way door (save format, link format, storage keys, ingredient ids,
    routes, anything that ships bytes to visitors), do not guess: raise a `QUESTION:` in your
    final report. Elsewhere, choose, and say what you chose.
17. **Wand and sword behaviour and strings do not change.** Every existing wand and sword test
    passes untouched unless your ticket says otherwise.
18. **After any push** the orchestrator waits for `gh pr checks` before calling anything green;
    keep the potion unit suite under a few seconds.

## Build order and ownership

Waves (at most four builders at once). 01-08 are done; 09 merges first.

```
now:      09 fix round (on the old four-pour schema), merges as is
round A:  20 generator (sonnet)   10 glass, layered liquid, light (opus)   13 scene A, card, P2 (opus)
round B:  21 the tap that mixes (sonnet, needs 20)   22 picker (sonnet, needs 20)   [10, 13 continue]
          -- 20, 21, 22 are merged together and CT runs once on the epic branch after 22 --
round C:  11 traits (needs 10, 20)   14 close look I (needs 10)   16 picture pipeline (needs 22)
round D:  23 the mix in the glass (needs 11, 14, 21)   24 the prompt for Ed (needs 13, 11, 16)
round E:  15 uncorking and effects (needs 23)   12 the pour (needs 23, 14)
round F:  25 Ed's art cut in (needs 16, 24 and Ed's sheet)   17 open the door (needs 10-16, 20-23)
round G:  18 docs and the final gate (needs 17, 25)
after the epic, own PR to main: 19
```

The critical path is 09 -> 10 -> 11 -> 23 -> 15 -> 17 -> 18; 25 waits on Ed.

Files that pass from one ticket to a later one (never held by two at once):

| File | Order of owners |
|---|---|
| `src/potion/potionSchema.ts`, `pours.ts`, `compile.ts`, `effects.ts`, `describe.ts`, `blends.ts`, `presets.ts`, `doNotUse.ts`, `item.ts`, new `mix.ts`, new `mixColour.ts` | 20 -> 10 (`presets.ts` bottle and finish retune only, after 20 merges) |
| `src/potion/ingredients.ts` | 20 -> 10 (colour column only, after 20 merges) -> 11 (trait column, for a cut only) |
| `src/potion/profile.ts`, `geometry.ts`, `tipped.ts`, `outline.ts`, `bottles.ts` (+ tests) | 09 -> 20 (the pour count in tests only) |
| `src/potion/framing.ts` (`BASE_LINE`) | 09 -> 13 |
| new `src/potion/mixBeats.ts` | 21 -> 23 (retimed at its gate) |
| `src/shop/shopView.ts`, `CloseUp.tsx`, `ShopPage.tsx`, `src/apothecary/apothecary.ts`, `src/apothecary/PotionOutline.tsx`, `src/apothecary.iwft.tsx`, `src/testing/ShopPom.ts` | 21 |
| `src/apothecary/pourPicker.tsx` (+ scss), `potionWidgets.tsx`, `potionGroups.ts`, `src/pours.iwft.tsx`, `src/testing/ApothecaryPom.ts` | 22 -> 16 (`pourPicker.tsx` and scss, `ApothecaryPom.ts` if a locator changes) -> 25 (only if the pictures need a size change) |
| `src/testing/FakePotionStage.tsx` | 20 |
| `src/street/shops.ts`, `src/testing/StreetPom.ts`, `src/street.iwft.tsx` | 17 |
| `src/shelf/*` | 13 (potion box styling only) |
| `src/share/apothecaryCard.ts`, `src/apothecary/BrewingTable.tsx` (+ scss), new scene art files | 13 |
| `src/styles/tokens.scss` | 13 (the `[data-shop='apothecary']` block) |
| `src/stage/PotionStage.tsx`, `PotionMesh.tsx`, `potionScene.tsx` | 09 -> 10 -> 11 -> 23 -> 12 |
| `src/stage/potionMaterials.ts` | 10 -> 11 -> 23 -> 12 |
| `src/stage/PotionCloseUpStage.tsx` | 09 -> 10 (lights, environment) -> 14 -> 23 -> 15 |
| `src/stage/slosh.ts` | 14 |
| `src/stage/potionShow.ts` | 23 -> 15 (adds the effect's `emit` and `age` only) |
| `src/stage/effectKinds.ts`, `EffectShow.tsx` | 15 |
| `scripts/gpu-shots.mjs` | 09 -> 10 (`--freeze`) -> 14 (`--settle`, potion flourishes) -> 12 (`--pour`) -> 18 (header) |
| `scripts/ingredient-pictures.mjs`, `public/ingredients/*` | 16 -> 25 (re-run on Ed's sheet) |
| `README.md` (credits) | 10 -> 18 |

## ADRs

Format MADR-lite, as `docs/adr/0092-armoury-branch-stepper.md`. 0104-0112 are assigned (O8);
0113 and up are free (O20).

| ADR | Subject | Written by |
|---|---|---|
| 0104 | The potion item (as built in 03); 20 adds a "Superseded in part by 0113" note | 03, 20 |
| 0105 | Upright items on the stage rigs | 04 |
| 0106 | Potion names, effects and secret blends (as built in 05); 20 adds a "Superseded in part by 0113" note | 05, 20 |
| 0107 | The bottle generator (09 adds the form gate's cuts) | 06, 09 |
| 0108 | The potion shop on the shell; 21 adds "The tap that mixes", 22 rewrites "The pour picker" | 07, 08, 21, 22 |
| 0109 | The potion's look: glass, liquid, light, the picture capture (11, 12 add sections) | 10, 11, 12 |
| 0110 | The potion shop's scene, recipe card and picture | 13 |
| 0111 | The potion's close look: the hold and slosh (14), the swirl and the show's clock (23), the uncorking, effects and the bloom exception (15) | 14, 23, 15 |
| 0112 | Ingredient pictures: the sheet, the cutter, placeholders (16); Ed's art (25) | 16, 25 |
| 0113 | Three ingredients that mix: slots and the mixed flag, the wheel rule and its odds, the mixed colour, the ninth ingredient, names and blends for a mix | 20 |

Ticket 17 amends ADR 0097 (a third open door); ticket 18 cross-links them and amends 0096 (a third
kind).

## Dependency table

| Ticket | Blocked by | Model | Gate |
|---|---|---|---|
| 01-08 | done | | |
| 09 Clay stage and the form gate | in its last fix round | opus | form |
| 10 Glass, layered liquid and light | 09; its colour step after 20 merges | opus | materials |
| 11 Traits in the liquid | 10, 20 | opus | materials |
| 12 The pour | 23, 14 | opus | materials (the pour) |
| 13 Scene A, recipe card and picture P2 | 09; gate shots need 10 | opus | whole shop (the scene round) |
| 14 Close look I: hold, tip, slosh | 10 | opus | close look (hold and slosh) |
| 15 Close look III: uncorking and effects | 23 | opus | close look (the uncorking) |
| 16 Ingredient pictures: placeholder, sheet layout, cutter, picker | 22 | sonnet | code review (plus a record sheet) |
| 17 Open the door | 10-16, 20-23 | sonnet | code review only |
| 18 Docs and the final gate | 17, 25 | sonnet | whole shop |
| 19 Hub card (own PR to main) | merged after the epic | sonnet | code review only |
| 20 The generator for three ingredients that mix | 09 | sonnet | code review only |
| 21 The tap that mixes: shell, reveal, copy | 20 | sonnet | code review only |
| 22 The picker: three, and empty only | 20 | sonnet | code review only |
| 23 Close look II: the mix in the glass | 11, 14, 21 | opus | close look (the mix) |
| 24 The ingredient sheet prompt for Ed | 13 (scene gate passed), 11, 16 | opus | prompt review |
| 25 Ed's ingredient art cut in | 16, 24, Ed's sheet | opus | materials (the pictures) |
