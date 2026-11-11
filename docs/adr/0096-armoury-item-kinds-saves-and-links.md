# 0096 - armoury item kinds: a save document per kind, the kind named in the link

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** [ADR 0074](0074-armoury-save-format.md) (the save format this
  keeps), [ADR 0075](0075-armoury-share-links-and-picture.md) (the link format
  this keeps), [ADR 0073](0073-armoury-wand-shop.md), [ADR 0077](0077-armoury-close-look.md)
  (its `cast` is now `flourish`). Built on by [ADR 0097](0097-armoury-street-and-last-shop.md)
  (the routes), [ADR 0098](0098-armoury-sword-generator.md) (the sword),
  [ADR 0099](0099-armoury-smithy-stage.md) and [ADR 0100](0100-armoury-sword-close-look-and-stage-rigs.md)
  (its stage and close look), [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md)
  (its scene and picture).

## Context

The armoury is gaining a second thing to make: swords. Until now "the item" was
a wand everywhere: the workbench reducer imported `wandSchema` and carried two
wand rules, the save format decoded through `wandSchema`, and a share link's
payload was `{ version, wand }`.

Two facts constrain how a second kind is stored and shared:

- **Stale tabs.** A tab still running an older bundle reads a save document
  with an unknown `version` as empty (ADR 0074), and its 400 ms autosave then
  writes that empty document back. A version bump would wipe shelves.
- **Links live forever** (ADR 0075). Every wand link ever sent has the payload
  `{ version: 1, wand }` and must keep opening that wand.

## Decision

**Item kinds.** `ItemKind` is `'wand' | 'sword'`. Each kind is one pure
`ItemDef` (`src/items/item.ts`): its schema, its `localStorage` key, its
first-visit item, the groups Try another always keeps, the params that follow a
change, and the functions that describe it (name, shop number, tag line, lore,
shelf line, glow colour, drawn length). `src/items/registry.ts` holds them by
kind. The wand's is `wand/item.ts`, built from the functions it already had.
Two kinds are written as two kinds: there is no plugin system.

Everything generic takes an `ItemDef` and imports neither `wand/` nor `sword/`:
`createWorkbench(def)` makes the reducer (the wand's "Try another keeps the
kind" and "a new Branch starts with bark" are now `def.keeps` and
`def.follows`), the provider holds one bench per kind, and the save and share
codecs take the schema. The shop number's hash moves to `items/shopNumber.ts`
unchanged, so every wand keeps its number.

**Shops.** A shop is a `ShopView` (`src/shop/shopView.ts`): its `ItemDef`, path, palette
key, copy, scene component, group summaries, an optional widget per param, the picture's
painter and its close look's flash timing. One shell (`ShopPage`, header, tag, controls,
close look) renders any view; the wand shop is `shop/wandShop.ts`, the smithy
`smithy/smithy.ts`. The stages are a pair per kind, `StagesByKind`, and a kind with none
shows its shop without a 3D view. The seam's `cast` became `flourish()` (ADR 0077's
amendment, [ADR 0100](0100-armoury-sword-close-look-and-stage-rigs.md)).

**Saves: one document per kind.** Each kind has its own key holding the
document ADR 0074 describes, decoded with that kind's schema:

| Kind | Key | Document |
|---|---|---|
| wand | `armoury:save` | `{ version: 1, working, shelf }`, entries `{ params, name? }` |
| sword | `armoury:save:sword` | the same shape |

The wand's key, shape and bytes do not change, and `SAVE_FORMAT_VERSION` stays
1. A document written before this change is read and rewritten byte for byte.
A third key, `armoury:shop`, holds the bare kind of the shop last visited
(`wand` or `sword`); anything else reads as none.

**Links: the kind is the payload's field name.** The fragment prefix stays
`#w=` and `SHARE_FORMAT_VERSION` stays 1. The payload is
`{ version: 1, wand: StoredItem }` or `{ version: 1, sword: StoredItem }`.
`decodeShare` returns `{ kind, item }` for the first kind, wands first, whose
field is present and decodes; it stays total. A link is always built at the
root path (`<origin>/#w=...`), whichever page built it, and the root sends an
arrival to its own shop.

## Considered and rejected

- **A version bump** to a document that holds both kinds. Wipes the shelf of
  anyone with a stale tab, as above. Nothing about the wand's data changed, so
  there is nothing for a new version to mean.
- **One document with a `kind` on each entry.** An older bundle decodes every
  entry through `wandSchema`, and decode is lenient per entry, so its next
  shelf write would turn each kept sword into a default wand.
- **A `kind` field beside the item in the link**, or a second prefix (`#s=`).
  The field name already says it, costs old links nothing, and one prefix keeps
  one place that reads the fragment.

## Consequences

- An older bundle never reads or writes `armoury:save:sword`, and given a sword
  link it finds no `wand` field and opens as an ordinary visit.
- A link made before there were kinds has a `wand` field, so it opens as a wand.
- The shelf cannot order wands and swords together by when they were kept: it
  has no timestamps and two lists. It groups by kind.
- A link shared from the shelf used to point at `/shelf#w=...`; it now points
  at the root like every other link.
- Shop numbers share one hash space across kinds, so a wand and a sword can
  have the same number. It is decoration, not identity (ADR 0074).
- A third kind is a new `ItemDef`, a new key and a new field name. No format
  changes.
