# 0074 - armoury save format: one versioned document, lenient wands

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** [ADR 0025](0025-boop-save-format.md) (the boop precedent),
  [ADR 0073](0073-armoury-wand-shop.md), [ADR 0075](0075-armoury-share-links-and-picture.md).

## Context

A child's wand on the counter must survive a reload, and the wands they keep
must survive for good, with no account and no server. boop solved the same
shape with one versioned document under one key (ADR 0025).

## Decision

One `localStorage` key, `armoury:save`, holds
`{ version: 1, working: StoredWand | null, shelf: StoredWand[] }`, where a
`StoredWand` is `{ params, name? }`. `working` autosaves 400 ms after a change
and on `pagehide`; the shelf is written on keep, rename and remove. Every
storage call is wrapped so a locked-down browser loses its saves, never the app.

Decode is total, like boop's, but **lenient per wand** where boop is strict per
document: params always pass through the schema's `normalise`, which clamps,
snaps and fills defaults, so a wand from an older or newer build always opens as
the nearest valid wand. Only an entry that isn't a wand at all (no params
object, a non-string name) is dropped, and only that entry, not the shelf. An
unknown document `version` reads as empty.

Names are optional and stored only when a child renames a wand; everything else
on the tag (name, shop number, tag line) is derived from params, so it can be
improved later without migrating saves.

## Consequences

- Adding a param needs no version bump: old wands get its default.
- Removing or renaming a param silently drops it from old wands. If that ever
  matters, map the old key in `normalise`'s input before bumping anything.
- Because the shop number hashes the params, changing a param's range or step
  can change the numbers of existing wands. It is decoration, not identity, so
  that is accepted.
