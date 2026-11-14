# 0113 - armoury potion: three ingredients that mix

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0104](0104-armoury-potion-item.md) (pours as ordered slots),
  [ADR 0106](0106-armoury-potion-names-effects-and-blends.md) (names, effects and
  blends), [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (item kinds, saves
  and links).

## Context

Ed changed the potion's mechanic (E13-E17): the child picks three ingredients, they
sit in the bottle as layers in the order chosen, a tap lifts the bottle, swirls the
layers into one colour and pulls the cork, and out comes one of six effects or, when
the three clash, nothing at all. ADR 0104 built four layered pours that never mixed
and ADR 0106 derived the effect from the commonest pour. Nothing has shipped, so
both are replaced in part and nothing migrates.

## Decision

### Slots and the `mixed` flag

- `POUR_KEYS` is `pour1`-`pour3`, no gaps, `none` at weight 0 in every slot, so Try
  another always pours three. The same ingredient may fill two or three slots.
- `mixed` is a choice param in the `pours` group: `no` (weight 1) or `yes` (weight 0),
  and `allowed` is only `no` while `pour3` is `none`. Try another never mixes, and
  the second `normalise` pass unmixes a bottle that loses its third ingredient, so
  "Empty the bottle" (a `set none` from the top down) empties and unmixes.
- The shell sets `mixed` at the uncorking's reveal (ticket 21), so the name, the
  gold and the save change at the pop. Nothing else sets it; changing the bottle or
  the finish keeps it. It is a param, not a derived value, because the save and the
  share link must say whether the potion has been mixed.
- `followPours` keeps only its adding half: an ingredient set in an empty slot above
  a gap lands in the lowest empty slot. There is no taking one out of the middle.
- No migration: a dev save or link from the four-pour build normalises (`pour4` is
  not a key and a `bogmurk` falls back to the slot's default).

### The wheel rule

The nine ingredients sit round a colour wheel in rainbow order, 40 degrees apart
(`wheel` 0-8 in `ingredients.ts`, which lists them in that order). The wheel is cut
into six 60 degree sectors, one per effect, starting at -3.25 degrees: glowing,
floating, sparkling, whirling, dreamy, whiffy. A mix adds the three unit vectors.
A sum shorter than `MURK_REACH = 0.78` is murky; otherwise the sector the sum points
into is the effect. The sum is taken in wheel order, so every order of a recipe
gives the same `PotionMix` to the bit.

Why a vector rule and not a lookup table:

- **Order-free.** Addition is, and order only sets the layers before the mix.
- **A shape a child can learn.** Three of one is that ingredient's own effect and is
  never murky; neighbours mix to a neighbour's effect; two of a kind usually win,
  with Frogfizz, Thundercloud and Puffcap (an effect each) pulling hardest; three
  from all round the wheel cancel to mud.
- **Paint-like clashes.** Murky is exactly three different ingredients whose gaps
  round the nine-step wheel are 3,3,3 or 2,3,4, as opposite paint colours make mud.

The odds, pinned by `mix.test.ts`: over the 165 multisets of three from nine, each
effect gets 24 and murky 21 (about one in seven each). Under Try another (729
equally likely orders) murky is 126 (about 1 in 5.8) and each effect 100 or 101
(about 1 in 7.2). Six of the 84 three-different recipes land on an effect none of
the three has (Starpetal, Snailshine and Bluebell is Floating). The nearest any
effect sum comes to a sector edge is 1.124 degrees (Emberroot with two Frogfizz, and
its two symmetric recipes: Snailshine with two Thunderclouds, Moonmilk with two
Puffcaps); the test asserts more than 1.1. The murk line (0.78) sits between the
strongest murky sum, 0.684 (gaps 2,3,4), and the weakest effect sum, 0.879, about 0.1
either side; the test asserts more than 0.09. So no float rounding can flip an
outcome. The test also asserts that each ingredient's `effect`
column agrees with `mixPotion([id, id, id])`.

`PotionMix` carries `outcome`, `colour`, `trait`, `main`, `strength`, `angle` and
`reach`. `main` is, among the three ingredients whose own effect is the outcome, the
most repeated, a tie going to the one nearest the angle (three recipes tie exactly,
because the third ingredient sits opposite the pair's midpoint: Emberroot, Starpetal and
Thundercloud; Snailshine, Bluebell and Puffcap; Frogfizz, Moonmilk and Rosehip; distances
within 1e-9 degrees count as equal and the lower wheel place wins, so float noise never
decides the name); for a surprise it is the
nearest of the three; null when murky. `strength` is how many of the three carry the
outcome (1 when murky). `trait` is `main`'s, or `murk` when murky.

### The mixed colour

Designed in `mixColour.ts`, never an RGB average:

- **Effect:** the two ingredient colours either side of the angle blended in OKLCH
  (the shorter way round the hue circle), chroma scaled by `0.75 + 0.25 * s` where
  `s` is how far the reach is between 0.78 and 3, raised to at least 0.12, lightness
  clamped to 0.58-0.78. A pure mix is its ingredient at full strength, a near clash
  a little dusky, none muddy.
- **Murky:** the mud `#5b5533` moved 15 percent in OKLab towards the mean of the three
  colours, chroma capped at 0.05, lightness clamped to 0.38-0.48.
- Tests pin the bounds (effect chroma at least 0.12, lightness 0.58-0.78; murky chroma
  at most 0.05, lightness at most 0.5), determinism and four spec starting values.
  Ticket 23 may retune the numbers at its gate; ticket 10 retunes ingredient colours
  under Ed's light.

### Puffcap

A small red toadstool with pale spots that puffs out spores replaces Bog murk (murk
is now a result, not an ingredient). Red sits between Rosehip's pink and Emberroot's
orange, so the wheel is a full loop. Its trait is `cloud`; a new `murk` trait exists
only for a murky mix. Starpetal, Bluebell and Rosehip change their own effect to
glowing, sparkling and dreamy, and Emberroot's colour changes to `#ea7b2c`.

### Names, tag lines, lore and blends

- Not mixed, the name is the layers by word with repeats folded into the first
  place ("Double Frogfizz and Bluebell", "Triple Starpetal"); empty is "An Empty
  Bottle". The mix reveals the name.
- Mixed: a secret blend's own name; else, if murky, one of seven names chosen by the
  sum of the three wheel places modulo 7; else three of one is "Pure {Label}"; else
  "{Effect word} {main's word} {Noun}", falling back to the round noun and then
  "{Label} {Noun}" if a name is forbidden.
- Shape nouns for names are now Brew (round), Potion (teardrop), Essence (tall),
  Wonder (shoulder) and Swirl (gourd), a `Record<ShapeId, string>` in `describe.ts`.
  Tonic, Drops and Mixture read as medicine. `bottles.ts` keeps its `nameNoun`
  column unread; ticket 18 removes the dead column.
- Tag lines and lore say "layers" and what the bottle still needs until it is mixed,
  then keep the recipe on the card ("Mixed from Frogfizz, Frogfizz and Bluebell in a
  tall bottle."). A murky potion is inert and proud of it. `isGold` is true only for
  a mixed secret blend.
- Blends are twelve unordered recipes matched as multisets and only once mixed; each
  changes the name, lore and gold, not the effect or colour. Each outcome in the spec
  table is asserted. Presets are eight, covering all seven outcomes (the first-visit
  potion is full and not mixed, so its first tap shows the whole mix).

## Consequences

- The pure generator stays three-free and unit-tested; the stage reads `spec.mix`
  and `spec.mixed` and draws the layers unmixed.
- `profile.ts` fills a third of the bottle per ingredient because `MAX_POURS` is 3;
  its maths is unchanged.
- The picker, the shell, the reveal and the close look follow in tickets 21, 22 and 23.
