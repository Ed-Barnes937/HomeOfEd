# 20 — One scene operation, three names across three layers

**What's wrong:** Deleting a scene is called something different at every layer:

- `remove` — `apps/silt/src/features/scenes/useScenes.ts:20`
- `onDelete` — `apps/silt/src/features/scenes/ScenesPopover.tsx:23`
- `deleteScene` — `apps/silt/src/testing/SiltPagePom.ts:159`

Nothing is broken; it just costs a lookup every time you follow the call path,
and it's the kind of thing that compounds as the roster and the popover grow.

Also in scope, same class:

- `apps/silt/src/silt.iwft.tsx` is named after the app while its four siblings
  (`chrome`, `scenes`, `spawners`, `mobile`) are named after what they test. It's
  the render/painting suite — `render.iwft.tsx` or `painting.iwft.tsx` would say
  so.

**What to build:** Pick one verb (`delete` reads best — it's what the UI says and
what the user is doing) and use it at all three layers. Rename `silt.iwft.tsx`.

**Status:** claimed

- [ ] One verb for the delete operation across hook, component and POM
- [ ] `silt.iwft.tsx` renamed to match its siblings' convention
- [ ] Full suite green

**Severity:** low — pure naming.

**Deliberately not included:** `SiltPagePom.clickCell` delegating to `paintCell`
(`apps/silt/src/testing/SiltPagePom.ts:61-63`) was flagged as a Middle Man. It's
being kept: in spawner mode the same gesture places an entity rather than
painting, and its six call sites in `spawners.iwft.tsx`/`scenes.iwft.tsx` read
correctly *because* it isn't called `paintCell`. It's an intent-carrying alias,
not a pointless hop.

**Source:** whole-branch drift review (2026-08-06), Standards axis.

## Comments

- Chose `delete` as the verb (matches the ticket's own reasoning). By the time
  this landed, `ScenesPopover.tsx` (`onDelete`) and `SiltPagePom.ts`
  (`deleteScene`) already used it — only `useScenes.ts`'s `remove` (the
  `ScenesController` interface member and its implementation) and the one
  call site in `HomePage.tsx` (`scenes.remove` → `scenes.delete`) needed
  renaming.
- `SceneStore.remove` (`sceneStore.ts`) was **left unrenamed**. The ticket
  scopes this to "hook, component and POM" — three layers, not four — and
  `SceneStore`'s own vocabulary (`list`, `save`, `update`, `rename`, `read`,
  `thumbnail`, `remove`) mirrors the underlying `SceneStorage`/`Storage` API
  it wraps (`removeItem`), not the UI's delete affordance. Renaming it would
  drift the store's naming away from the primitive it wraps for a
  consistency win that wasn't asked for at that layer.
- `silt.iwft.tsx` renamed to `render.iwft.tsx` (of the ticket's two suggested
  options) — the suite covers both paint interaction and canvas-rendering
  assertions, and `render` reads as the broader of the two without leaning on
  "painting" as the primary framing.
- Noting, not acting on (out of scope for this ticket): `useArmedConfirm.iwft.tsx`
  (landed with ticket 14) is named after a unit under test rather than after
  what it tests, same class of drift as `silt.iwft.tsx` was. Worth a follow-up
  ticket if the "named after what it tests" convention is meant to hold for
  every `.iwft.tsx` file.
