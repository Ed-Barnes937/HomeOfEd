# 0097 - armoury street: flat routes, a landing redirect at the root, the last shop remembered

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (the
  `armoury:shop` key and root-path links this routes), [ADR 0075](0075-armoury-share-links-and-picture.md)
  (links live forever), [ADR 0073](0073-armoury-wand-shop.md).

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
| `/street` | The street: two shop fronts, each one link, and the hub link. |
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

## Consequences

- Any URL a visitor has bookmarked still works: `/` lands somewhere sensible
  and `/shelf` is unchanged.
- A third shop is a path, a `SHOP_PATHS` entry and a door on the street.
- **For PR #188** (accounts), whichever merges second: the five routes and the
  index redirect go under its pathless `player` layout; its `PROFILE_KEYS`
  gains `armoury:save:sword` and `armoury:shop`; its `SharedView` renders the
  arrival's own shop view. Recorded, not done here.
