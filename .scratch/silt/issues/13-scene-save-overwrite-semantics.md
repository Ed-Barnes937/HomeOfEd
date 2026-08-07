# 13 — Scene save has no overwrite, and `updatedAt` is a dead field

**What's wrong:** Every save creates a new scene row. Nothing is ever replaced,
so `updatedAt` is written once at creation and never again — `rename` doesn't
bump it either, and nothing displays it.

`apps/silt/src/features/scenes/sceneStore.ts:138-152`,
`apps/silt/src/features/scenes/useScenes.ts:105-112`,
`apps/silt/src/features/scenes/sceneStore.ts:166`.

**Why it's a spec problem, not a preference.** Spec §8 pins the index as
`[{id, name, updatedAt}]`. Three things in the spec only make sense if a scene
is a durable slot you revise:

- The field is `updatedAt`, not `createdAt`.
- §9 gives each row an **inline rename** — you name a thing you intend to keep.
- §8 budgets *"~240KB worst case per scene ≈ 20 scenes in the 5MB quota"* and
  makes *"storage full, delete a scene"* the **only** escape from a full quota.

Save-as-new turns every iteration on one scene into a fresh ~240KB row, so
ordinary use — paint, save, adjust, save — walks into the quota wall in about
twenty saves, and the escape is manual deletion of rows the user never meant to
create.

**Status:** claimed

**Decided (Ed, 2026-08-07): save updates the current scene.** Of the three
candidates — update-current, always-new-plus-per-row-overwrite, and
autosave-a-working-scene — this is the one that matches §8's `updatedAt` and
§9's inline rename.

What that implies, and what still needs designing as part of the build:

- The page has a notion of a **current scene** (`id`, or none for an unsaved
  world). A load sets it; a save writes to it and bumps `updatedAt`.
- **Saving with no current scene** creates one — the existing `scene N`
  auto-naming covers this.
- The header shows the current scene's name and stays in step with it: a save
  adopts the name, a rename of the current scene updates it. This subsumes the
  "header never follows a save or rename" bug listed below.
- **A duplicate affordance is needed** — without one, update-in-place removes
  the only way to fork a variant, which the old behaviour gave for free. A
  "duplicate" action on each row is the cheap version; decide during the build
  whether it earns its place in v1 or the row's rename is enough.
- `updatedAt` should now be **displayed** on the row — it means something once
  it moves, and it's the natural way to see which scene you touched last.

### Acceptance criteria

Core behaviour:

- [ ] The page tracks a **current scene** (`id`, or none for an unsaved world);
      a load sets it, a save writes to it
- [ ] Saving with **no** current scene creates a row and adopts it as current
      (existing `scene N` auto-naming)
- [ ] Saving with a current scene **replaces that row's blob and thumbnail** —
      the scene count does not change, and `updatedAt` moves
- [ ] `rename` bumps `updatedAt` too (the row changed)
- [ ] `updatedAt` is rendered on each row in the popover
- [ ] The header name stays in step: a save adopts it, renaming the current
      scene updates it, a load sets it — subsumes the header bug below

Storage:

- [ ] The index filter requires `updatedAt`, so a row missing it is treated as
      malformed rather than valid (`sceneStore.ts:85-91`)
- [ ] Re-saving one scene N times leaves **one** scene blob and **one**
      thumbnail — the test that proves the quota problem is gone
- [ ] Quota accounting covers the thumbnail key class, not just the scene blob

Duplicate affordance:

- [ ] Either a per-row "duplicate" action exists, **or** a line in this ticket's
      Comments records why it was deferred. Do not leave it undecided — without
      one, update-in-place removes the only way to fork a variant, which the old
      save-as-new behaviour gave for free.

Regressions to hold:

- [ ] Loads still enter paused (spec §8) — `scenes.iwft.tsx` case still green
- [ ] Failure handling still loud and never destructive (spec §8): quota errors,
      a scene that will not load keeps its blob and its row
- [ ] Ctrl+S still saves and still doesn't fire inside the rename field
- [ ] Every new behaviour above is verified **red before green** — the
      re-save-once-not-twice case especially, since that is the actual bug
- [ ] lint / typecheck / `pnpm --filter silt run test` green
- [ ] ADR 0029 updated — it currently records the no-overwrite model as the
      decision, and that is what this ticket reverses

**Three smaller things that are downstream of the same decision** — fix them
with it, not before:

- **The header scene name never follows a save or a rename**
  (`apps/silt/src/pages/HomePage.tsx:32`, `:55-57`). Ctrl+S creates `scene 1`
  while the header still reads `untitled`; renaming a row leaves it stale. Only
  a *load* sets it. Spec §9: *"Header: SILT · scene name"*.
- **The index accepts rows with no `updatedAt`**
  (`apps/silt/src/features/scenes/sceneStore.ts:85-91`) — the filter only
  requires `id` and `name`, so a malformed index survives as valid. Whatever
  `updatedAt` ends up meaning, it should be validated.
- **Thumbnails are unbudgeted.** `silt:thumb:<uuid>`
  (`apps/silt/src/features/scenes/sceneStore.ts:34`, `:140-148`) is a third key
  class beyond §8's two, holding a PNG per scene. Required by §9's thumbnail
  rows and recorded in ADR 0029, but nothing accounts for it against the quota
  §8 sized for 20 scenes.

**Source:** whole-branch drift review (2026-08-06), highest-severity Spec-axis
finding. The no-overwrite behaviour itself is recorded in ticket 09's Comments
and ADR 0029 and was self-flagged as "most worth a second opinion"; the
`updatedAt` degeneration was not noticed at the time.

## Comments

**Duplicate affordance: built, not deferred.** Each row has a `copy` button
(`store.duplicate` → the stored blob and thumbnail under a new id, named
`<name> copy`, then `<name> copy 2`). Reasoning: update-in-place takes away the
only route to a variant, and with save overwriting there is no "save as new"
left to fall back on — the alternative to building it was a user having to
delete-and-re-save to keep an old version, which is exactly the destructive
move spec §8 rules out. It cost one store method that is `save(read(id))`, one
button and one iwft case, so it earns its place in v1.

The copy deliberately does **not** become the current scene: what is on screen
still belongs to the scene you were editing, so the header keeps answering
"which scene does save write to?". Forking is copy → load the copy → carry on.

**Deleting the current scene clears it**, so the next save creates a new row
rather than resurrecting the row that was just deleted. Not in the acceptance
criteria; it falls out of "a save writes to the current scene" and there was no
safe alternative.

**Reset also lets go of the current scene** (spec-axis review finding). The
ticket pins only load and save, but leaving the scene attached across a reset
means reset-then-Ctrl+S writes an empty world over a saved scene with no
confirm and no way back — the destructive move overwrite was always going to
have to avoid. Decided rather than deferred: reset detaches, the header returns
to `untitled`, and the next save creates a new row. iwft case included.

**The Ctrl+S regression case was rewritten, not just kept.** Under overwrite it
could no longer create `scene 2`, so `verifyNoSceneRow('scene 2')` passed for
the wrong reason and would have stayed green with the input guard deleted. It
now saves a world, moves the world on, presses Ctrl+S inside the rename field
and reloads the scene to prove it still holds the world it was saved with —
verified red by removing the guard.

**Unrelated, pre-existing:** `apps/silt/src/pages/HomePage.tsx` and
`src/testing/SiltPagePom.ts` fail `prettier --check` on `origin/basic-cellular-
automaton` (one long line each, both untouched by this ticket). `pnpm lint`
does not check formatting, so nothing is failing — left alone as out of scope.
