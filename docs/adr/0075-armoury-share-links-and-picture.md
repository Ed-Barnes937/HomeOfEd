# 0075 - armoury shares a wand as a fragment link or a picture

- **Status:** Accepted - **amended 2026-11-11** (see the note below the header)
- **Date:** 2026-11-08
- **Related:** [ADR 0026](0026-boop-share-links.md) (the boop precedent),
  [ADR 0074](0074-armoury-save-format.md), [ADR 0093](0093-estate-gate.md)
  (the gate and `/shared`), [ADR 0094](0094-per-profile-local-saves.md).

> **Amended by [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) and
> [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md) (2026-11-11).** The
> payload now names the kind of item by its field: `{ version: 1, wand }` as
> below, or `{ version: 1, sword }`; a link made before swords has the `wand`
> field and opens as a wand. The prefix and `SHARE_FORMAT_VERSION` are
> unchanged. Links are built at the root path, whichever page built them, and the
> root sends the arrival to its own shop. The picture is a shared card frame
> with a painter per shop: the smithy's paints its forge, anvil and the sword's
> shadow where this ADR's card has the shop wall and box. Read `StoredWand` and
> `decodeStoredWand` below as `StoredItem` and `decodeStored`.

## Context

Wands should be sharable without a backend. A link lets someone else open and
play with the wand; a picture is what a child actually wants to send a
grandparent.

## Decision

**Link.** `#w=<base64url(JSON({ version, wand }))>`, where `wand` is the save
format's `StoredWand` decoded by the same `decodeStoredWand`. The share format
has its own `SHARE_FORMAT_VERSION`, separate from the save format's, because
links live forever. Decode is total: anything else opens the shop as a normal
visit. The fragment is read once on load, becomes the wand on the counter, and
is removed with `replaceState`, so a reload keeps the visitor's own edits.

The Share button follows boop: the OS share sheet on touch devices, the
clipboard and a "Copied!" flip elsewhere, never a modal or a link field.

**Picture.** "Picture" asks the stage for a 2000px capture of the bare wand on a
transparent background, then draws a 1080x1350 card on a 2D canvas: the shop
wall, the wand in its box with its tip glowing, the tag with name, tag line and
lore, and the address. On a touch device that can share files it opens the
share sheet; otherwise it downloads `<slugged-name>.png`. This is boop's export
action, reused.

**Amended 2026-11-10 (estate-gate ticket 11): links open at `/shared`.**
Share, from either shop or the shelf, now builds
`<origin>/shared#w=<token>` for a wand or a sword alike; the token and its
decoder are unchanged (the payload field still names the kind,
[ADR 0096](0096-armoury-item-kinds-saves-and-links.md)), and so is the picture.
This replaces ADR 0096's "built at the root" for new links. `/shared` is the
one path the estate gate leaves open ([ADR 0093](0093-estate-gate.md)
decision 6), so anyone can open a shared wand or sword. It opens the link's own
shop (the wand shop when the link holds nothing) and keeps nothing: the
workbench there runs over `memoryStorage`, nothing writes the last shop, the
header drops the shelf and the player chip, its way back to the street is a
page load the gate sees, and the fragment stays in the address bar, so a reload
reopens the share as it was sent. Its "Keep this wand" or "Keep this sword"
button goes to that kind's shop, `<origin>/wands` or `<origin>/swords`, with the
item as it is now, edits and rename included, re-encoded with the same
`encodeShare`; with no edits it carries the arrival fragment byte for byte
(`keepFragment`), or no fragment when the link held no item, so the shop opens
the player's own counter. There the gate asks who is playing, and the fragment
becomes that player's item on the counter. A root `/#w=` link, as every link
sent before this change, still lands in its kind's shop for a signed-in
visitor, as do `/wands#w=`, `/swords#w=` and `/shelf#w=`
([ADR 0097](0097-armoury-street-and-last-shop.md)). The fragment is read once,
in `App` before the router mounts, through `arrivalFragment()` from
`@hoe/accounts`, because the router decodes the address bar on mount and the
root's redirect drops it.

## Consequences

- Link previews in chat apps can't show the wand: the fragment never reaches a
  server, so there's nothing to render an image from. They show the page's
  generic title and description. The picture is the way to send a wand that
  looks like one. A server-rendered preview would need a short-link store and
  is deliberately out of scope.
- A wand link is ~600 characters; fine for messaging apps.
