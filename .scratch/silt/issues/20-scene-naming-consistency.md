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

**Status:** ready-for-agent

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
