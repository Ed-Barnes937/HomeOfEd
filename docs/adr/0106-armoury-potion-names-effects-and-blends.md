# 0106 - armoury potion: effects, names, secret blends and the DO_NOT_USE list

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0104](0104-armoury-potion-item.md) (pours, compaction, the
  ingredient table), [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (item
  kinds), [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md) (the sword's
  derived names).

## Context

A potion has to say what it does and what it is called without storing either:
names, tag lines and lore are derived from the params, as the wand's and sword's
are. The owner's brief was that what a potion does matters only as far as the
effect when it is unbottled, and the name it has. Names must also be original: no
franchise or game vocabulary.

## Decision

- **Effects are one parameterised system.** Six kinds (floating, sparkling,
  dreamy, glowing, whirling, whiffy), each a bounded show in the potion's colours,
  chosen from the pours by `potionEffect` (`potion/effects.ts`). Every ingredient
  carries one kind. The most common kind among the pours wins; strength is that
  count (1-4); the colours are those of the pours carrying it, top first. There is
  no bespoke animation per effect, which keeps the close look's size bounded.
- **A tie goes to the highest pour.** The pour nearest the cork is the one that
  comes out first, so it is also the one a child reads as "the last thing I
  added". It makes the order matter, which is the point of layers, and it is
  stable under taking a pour out. Whiffy follows only from Bog murk on top or in
  the majority, so murk is as likely to be smelly as any other layer is to be
  anything: no rule favours or forbids it.
- **Names, first match wins:** a secret blend's own name; "An Empty Bottle"; two or
  more of one ingredient, "Pure {Label}" in capitals ("Pure Bluebell Dew");
  otherwise "{Effect word} {Main ingredient word} {Noun}" with the noun from the
  bottle's shape (Brew, Tonic, Drops, Mixture, Potion). The main ingredient is the
  most poured, a tie going to the highest.
- **Fallbacks.** A generated name that `isForbiddenName` matches becomes the same
  name with the round shape's noun, then "{Label} {Noun}". A unit test sweeps every
  effect word, ingredient word and noun, so the fallbacks are insurance and not a
  path any current name takes.
- **Secret blends are exact sequences.** `SECRET_BLENDS` is a table of at most
  twelve pour lists, bottom first, each with a name and two lore sentences.
  `secretBlend` matches the whole list: a prefix, an extra pour or a different
  order is not a match. There is no book of discovered blends and nothing is
  persisted: a blend is found by making it, and it is the same blend on a link,
  on the shelf and on a friend's screen because it is derived. A blend only
  changes the name, the lore and a gold flag the label and recipe card read; the
  layers and the effect are the ordinary rule's. A blend's name beats "Pure", so
  four Bog murks is "Bottom of the Pond".
- **DO_NOT_USE.** `potion/doNotUse.ts` lists franchise and game potion names,
  generic game terms and legend names used as products, and `isForbiddenName`
  compares them with case, spaces and punctuation removed. Entries of nine or
  more characters also count inside a longer name (a coinage like Polyjuice is
  never an ordinary word); shorter ones count only as the whole name, so
  "Together" and "Chi Potion" pass. Patterns catch a name beginning "Potion of",
  "Draught of", "Elixir of" or "Philter", and Super, Hyper, Max, Mega, Hi or X
  directly before "Potion". The guard is run on every blend name and lore
  sentence, every preset, and every ingredient label, word and lore line.
- **Names never mention drinking or tasting.** The shop is a place to make
  and look at potions, and the effect is the uncorking, so the words are about
  colour, layers and what comes out of the neck. A unit test keeps blend lore free
  of drinking and tasting words.

## Consequences

- Names and lore are free to retune in `describe.ts`, `blends.ts` and `effects.ts`
  without a migration; only ingredient ids and the pour slots are persisted.
- Adding an ingredient needs an effect kind from the six and a name word; the
  sweep tests cover the new combinations without edits.
- Presets (`potion/presets.ts`) are plain data and are re-tuned at the materials
  gate.
