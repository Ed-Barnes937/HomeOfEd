# 0075 - armoury shares a wand as a fragment link or a picture

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** [ADR 0026](0026-boop-share-links.md) (the boop precedent),
  [ADR 0074](0074-armoury-save-format.md), [ADR 0093](0093-estate-gate.md)
  (the gate and `/shared`), [ADR 0094](0094-per-profile-local-saves.md).

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
Share, from the counter or the shelf, now builds
`<origin>/shared#w=<token>`; the token and its decoder are unchanged, and so is
the picture. `/shared` is the one path the estate gate leaves open
([ADR 0093](0093-estate-gate.md) decision 6), so anyone can open a wand. It
keeps nothing: the workbench there runs over `memoryStorage`, the header drops
the shelf and the player chip, and the fragment stays in the address bar, so a
reload reopens the share as it was sent. Its "Keep this wand" button goes to
`<origin>/` with the wand as it is now, edits and rename included, re-encoded
with the same `encodeShare`; with no edits it carries the arrival fragment byte
for byte (`keepFragment`), or no fragment when the link held no wand, so the
root opens the player's own counter. At the root the gate asks who is playing, and the
fragment becomes that player's wand on the counter as before. A root `/#w=`
link, as every link sent before this change, still opens there for a signed-in
visitor. The fragment is read through `arrivalFragment()` from
`@hoe/accounts`, because the router decodes the address bar on mount.

## Consequences

- Link previews in chat apps can't show the wand: the fragment never reaches a
  server, so there's nothing to render an image from. They show the page's
  generic title and description. The picture is the way to send a wand that
  looks like one. A server-rendered preview would need a short-link store and
  is deliberately out of scope.
- A wand link is ~600 characters; fine for messaging apps.
