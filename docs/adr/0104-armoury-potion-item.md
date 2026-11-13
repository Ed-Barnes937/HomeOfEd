# 0104 - armoury potion: pours as ordered slots, compaction, the ingredient table

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (item kinds,
  saves and links), [ADR 0097](0097-armoury-street-and-last-shop.md) (the street).

## Context

The third shop, Bubble & Brew, makes a potion: the child pours ingredients into a
bottle, each pour a coloured layer with one visible trait, and designs the bottle,
its stopper and its label. The pours are an ordered list of up to four, and the
order is the recipe. The item schema (`engine/schema.ts`) has no list param, and
save, share, undo, locks and the shop number all work on flat params.

## Decision

- **Pours are four ordered choice slots**, `pour1` to `pour4`, bottom first, not a
  list param. Save, share, undo (`previous`), the lock on the "pours" group and the
  shop number work unchanged, and the engine learns nothing about potions.
- **No gaps, through `allowed`.** A slot above an empty one allows only `none`,
  and `none` is first in every pour's options so it is the fallback. `normalise`
  runs its second pass in schema order, so a gap in a link or save empties
  everything above it and the potion opens with the pours below the gap.
- **Compaction, through `follows`.** `followPours` (in `potion/pours.ts`) returns
  the pours a `set` brings with it: taking one out shifts the rest down, and
  pouring into a slot above a gap lands in the lowest empty slot. It returns
  nothing when a plain set already gives that result. The workbench reducer is
  unchanged.
- **Try another keeps nothing but locks** (`keeps: []`), there being no Kind to
  hold. A lock on any of the three groups keeps that group.
- **The ingredient table is data** (`potion/ingredients.ts`), nine rows with an id,
  label, name word, colour, trait, effect and lore line. **The ids are permanent**:
  they are written into saves and links. Labels, words, colours and lore may change.
- **Traits and effects are columns**, not separate tables. A trait is what a layer
  looks like at rest; an effect is what the potion does when uncorked. Each
  ingredient has one of each, and later tickets derive names and shows from them.
- **The murky rule.** Murk exists only as the Bog murk ingredient, with the same
  weight as every other ingredient in every slot. A murky layer is therefore as
  likely under Try another as a layer of anything else, and four Bog murks exactly
  as likely as four of any other ingredient. Layers never mix, so nothing converges
  on brown, and no rule favours or forbids murk. Tests pin it by computing from the
  schema's weights, not by sampling.
- **Pour odds.** `none` weighs 0 in slots one and two and 2 in slots three and
  four, so Try another gives four pours about 67 percent of the time, three about
  15 and two about 18, and never an empty or one-pour bottle.
- **The bottle is data too** (`potion/bottles.ts`): one row per shape with its
  lathe profile and neck range. The numbers are starting values for the form gate.

## The cut: "Stir it"

A "Stir it" mode (Layered or Mixed, through a curated pair table) is cut from the
epic. It needs a pair table, a second liquid look and a murky-odds argument for
little play, and mixing is the road to brown, which the murky rule rules out.

## Consequences

- A save or link with a gap, or a potion with more than four pours, cannot be
  expressed: a hand-edited link opens with its pours below the gap.
- Adding an ingredient later is a new row and a new option in each pour slot; the
  jar grid is three by three, so a tenth needs a layout decision first.
- The picker must call the item's `follows` through the reducer's `set`, so it
  never has to compact the pours itself.
