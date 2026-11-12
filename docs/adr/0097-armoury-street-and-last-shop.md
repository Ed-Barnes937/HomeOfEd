# 0097 - armoury street: flat routes, a landing redirect at the root, the last shop remembered

- **Status:** Accepted
- **Date:** 2026-11-11 (the painted street amended 2026-11-12)
- **Related:** [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (the
  `armoury:shop` key and root-path links this routes), [ADR 0075](0075-armoury-share-links-and-picture.md)
  (links live forever), [ADR 0073](0073-armoury-wand-shop.md) (the wand shop, now at
  `/wands`), [ADR 0101](0101-armoury-smithy-scene-tag-and-picture.md) (the smithy at
  `/swords`).

## Context

The armoury now has two shops, the wand shop and the smithy. The owner decided
(E1) that a first visit lands on a street with both shop fronts, each shop has
a way back to the street, a returning visitor opens straight into the shop they
were last in, and old share links and saves keep working.

Two facts shape the routing:

- **Links are built at the root** (ADR 0096): `<origin>/#w=<payload>`, whatever
  the kind. The root must send a sword link to the smithy and a wand link to
  the wand shop.
- **The fragment must go once the item is loaded**, or a reload opens the link
  again over the visitor's own edits. Clearing it with `history.replaceState`
  from outside the router races the router: TanStack history patches
  `replaceState` and follows it, so writing `/` while the router is redirecting
  re-runs the root and can land in the wrong shop.

## Decision

**Flat routes.**

| Path | Shows |
|---|---|
| `/` | Nothing: `beforeLoad` throws a replace redirect to `landingPath(landing)`. |
| `/street` | The street: one painting of eight shops, a link traced over each open one, and the hub link. |
| `/wands` | The wand shop. |
| `/swords` | The smithy. |
| `/shelf` | One shelf, a section per kind. |

**The landing is worked out once, before the router runs.** The workbench
provider, above the router, decodes the arrival fragment and reads
`armoury:shop` in its initialiser, and exposes
`landing = { arrivalKind, lastShop }`. `App` passes it as the router context
(`createRootRouteWithContext<{ landing: Landing }>()`).
`landingPath` (`src/landing.ts`) picks the link's kind, then the last shop, then
the street. The redirect reads only this value, never the address, so it cannot
be confused by whatever the address says by the time it runs.

**The redirect drops the fragment itself.** It passes no `hash`, so an arrival
at the root has exactly one writer of the address: the router. The provider
calls `clearShareHash` only for an arrival on another path (an old
`/shelf#w=...` link), where no redirect runs.

**The last shop.** Entering a shop writes `armoury:shop` (`wand` or `sword`)
through the injected storage and updates the provider's `lastShop`. The shelf's
way back goes to that shop (`Back to the counter` or `Back to the anvil`; the
counter when nothing is stored), and an empty shelf speaks of that shop's item.
No in-app link points at `/`, so the redirect runs only on a page load, and a
reload on `/street` stays on the street.

**An existing visitor sees the street once.** Someone with a wand save from
before the smithy has no `armoury:shop`, so they land on the street. That is
intended: it is how they find the smithy. The last shop is never inferred from
a save; their wand and shelf are untouched.

**The street is one painting with traced links.** The first street drew two
shop fronts in code; the owner did not like it. The street is now one painted
image of eight shops along a lane (`public/street/`), and the page is one
`<svg>` whose `viewBox` is the painting's coordinate space: the painting as an
`<image>`, then each shop's front traced as a `<path>` in those coordinates.
Image and shapes are one drawing, so one tracing stays registered at every
screen size. `street/shops.ts` holds the coordinate space (the painting's
width and height) and the eight shops (`id`, the painted `name`, `outline`, and
`to` for an open one). The coordinate space is fixed by the painting traced,
not by the file's pixels: a sharper file of the same shape drops in with no
retracing, and nothing else in the code assumes the painting's proportions.

- An open shop's shape is a real link (`Go into the wand shop`, `Go into the
  smithy`): focusable, a real `href`, routed by the router. At rest it is an
  invisible hit target, so the whole front and only it is clickable. On hover,
  keyboard focus and press its edge draws in white with a soft glow and its
  inside brightens slightly and warmly (a colour-dodge fill, about x1.2, so
  the painting keeps its contrast instead of hazing over; 150 ms, no fade
  under reduced motion); that edge is the focus indicator.
- A shop with no `to` is not built yet. Inside its outline its colour is
  partly drained and a light dusk is laid over it, so it reads as shut for
  the night next to the two lit open shops without darkening most of the
  picture (six of the eight shops are shut). It is not a link and is hidden
  from assistive tech. Opening it later is a `to` in the data, not new art.
- A landscape screen always shows the whole painting (contained, never
  cropped), because the open shops stand at its far left and far right. It is
  centred on the page colour, sits below the header when the spare height
  allows, and its edges fade into the page wherever there is spare room.
- A portrait screen shows the painting zoomed out to 58% of the screen's
  height (`--phone-painting`), so about two fifths of the street is in view
  and it plainly carries on; at full height it was almost four screens wide,
  the owner found the panning not obvious and a first visitor could miss the
  smithy. 50% and 65% were tried by eye: 50% left the page mostly empty
  around small shops, 65% showed barely two shops so the street's length
  read less plainly. It sits a little above the
  middle, under the header, its top and bottom fading into the page colour
  (the painting's own dark sky and cobbles), and slides sideways with native
  scrolling. It opens on the shop the visitor was last in (the provider's last
  shop), else on the wand shop, lined up with that shop's own end of the
  street. Under it, one signpost per open shop in street order, named as
  painted (`signposts()` in `street/shops.ts`, so opening a shop adds its
  signpost), slides the street to that shop, smoothly unless reduced motion is
  asked for, and shows the shop's edge for 1.2 s; it does not go in, the shop
  front does. A short caption says "Slide along the street, then tap a shop."
  A keyboard focus brings the whole shop into view. The header stays put.
- The painting is AI-generated by the owner from the brief in
  `.scratch/armoury-swords/street-image-prompt.md`, with original shop names,
  and ships as one webp (`public/street/street.webp`, about 430 KB at the
  painting's full size); its master stays out of the repo.

Why: it is the owner's taste; more shops can be added later without
repainting the street or drawing new fronts in code; and one tracing serves
every screen size.

**Header.** Each shop's top-left button is `Back to the street`. The hub link
(`Back to home of ed`) lives on the street.

**Tests.** `IwftApp({ start })` writes `armoury:shop` before rendering, so the
`test` and `smithyTest` suites open through the real root redirect as returning
visitors of their shop; `streetTest` has no start and opens as a first visit.
The test server serves only the root, so page objects reload at the root
(through `History.prototype.replaceState`, which the router does not follow).

## Considered and rejected

- **Clearing the fragment in the provider for every arrival** (the code before
  this ADR). Two writers of the address during the redirect; see Context.
- **Routing from the fragment in `beforeLoad`.** The provider has already
  decoded it and may have cleared it; one decode, in one place, is simpler.
- **Inferring the wand shop from a wand save.** Existing visitors would never
  see the smithy's door.
- **Nested shop routes under a street layout.** The street is a page, not a
  frame around the shops.
- **Shop fronts drawn in code** (the first street). The owner did not like
  the look, and each new shop meant new drawing code.
- **An HTML image map, or buttons positioned in percent over an `<img>`.**
  Image map coordinates do not follow the image's size, cannot be styled on
  hover, and percent boxes are rectangles that drift once the painting is
  cropped to cover the screen.
- **Covering a landscape screen** (cropping the painting). The open shops at
  either end were cut off on any screen narrower than the painting.
- **Opening a phone between the two open shops.** They stand at opposite
  ends, so the middle shows neither.
- **A JS panning library on a phone.** Native sideways scrolling is enough.
- **The painting at the phone's full height, with an arrow at each edge.**
  The first phone street: the wand shop filled the screen and a bare chevron
  moved most of a screen, so the street did not look like it carried on and
  the arrow did not say where it led.

## Consequences

- Any URL a visitor has bookmarked still works: `/` lands somewhere sensible
  and `/shelf` is unchanged.
- A third shop is a path, a `SHOP_PATHS` entry, a door label in
  `street/shops.ts` and a `to` on its painted shop there.
- A different painting means a new coordinate space and tracing its eight
  outlines again, both in `street/shops.ts`; nothing else changes. A sharper
  file of the same painting changes only the file.
- **For PR #188** (accounts), whichever merges second: the five routes and the
  index redirect go under its pathless `player` layout; its `PROFILE_KEYS`
  gains `armoury:save:sword` and `armoury:shop`; its `SharedView` renders the
  arrival's own shop view. Recorded, not done here.
