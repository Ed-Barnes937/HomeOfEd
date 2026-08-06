# 09 — Scene persistence

**What to build:** Saving and loading scenes to localStorage, plus the scenes
popover — per `.scratch/sand-sim/spec.md` §8 (envelope reproduced there from
the resolved format ticket):

- Versioned JSON envelope per scene: `version`, `width`/`height`, `encoding:
  "raw"`, element-id→name table, `species`/`ra`/`rb` as planar base64,
  minimal `{x, y, element}` spawners. `clock` is not persisted (reset to 0 on
  load)
- **Remap by name** on load against the current registry; unknown element
  name → empty cell with a console warning; spawner with unknown element
  dropped; unknown extra spawner fields tolerated
- Storage: `silt:scene:<uuid>` blobs + `silt:scenes` index
  `[{id, name, updatedAt}]`; boot-time reconcile (drop dangling index rows,
  adopt orphan blobs)
- Dimension mismatch: smaller-than-current → paste anchored bottom-centre
  (spawner coords offset too); larger → refuse with a clear error
- Failure handling — loud, never silent, never destructive: quota-full
  message on save ("storage full, delete a scene"); blob written before
  index; load failure leaves the scene listed with an error, never
  auto-deletes
- **Loads always enter paused**
- **Scenes popover** (header button from ticket 07 goes live): save current
  at top, rows with canvas-snapshot thumbnails, inline rename, **delete
  behind a second click** (required — the only escape from a full quota),
  footer "this browser only". `Ctrl+S` saves

**Blocked by:** 08 — Spawners

**Status:** resolved

- [x] Save → reload page → load restores cells (pixel-identical: `ra`/`rb` kept), spawners, entering paused
- [x] Round-trip, remap-unknown-element, dimension-mismatch (paste and refuse), and quota-failure behaviours covered by tests
- [x] Popover supports save, load, rename, second-click delete, thumbnails
- [x] Boot reconcile handles dangling index rows and orphan blobs
- [x] `*.iwft` covers paint → save → reload → load; lint/typecheck/tests green

## Comments

Resolved in commit `5b0a9eb` (Opus agent). `features/scenes/` — `sceneCodec.ts`
(pure, headless, DOM-free), `sceneStore.ts` (localStorage layer),
`useScenes.ts` (React seam), `ScenesPopover.tsx`. **ADR 0025 — Silt scene
persistence** records the decisions.

Every spec §8 trap is covered by a named test: round-trip pixel-identical with
`ra`/`rb` kept; remap by NAME not id when the registry has renumbered; unknown
element name → empty cell + warning, load still succeeds; spawner with a gone
element dropped and unknown spawner fields tolerated; smaller scene pasted
bottom-centre with spawner coords offset; larger scene refused, naming both
sizes; unparseable JSON / unknown version / short plane all refused. Storage
side: blob written before index, quota-full reported as an actionable message
writing nothing, a scene kept when only its thumbnail won't fit, blob freed
before the index is rewritten so a full quota is escapable, reconcile drops
dangling index rows and adopts orphan blobs, a corrupt index survived, and a
scene whose blob is gone is refused rather than silently read as empty.

The iwft does a real `page.reload()` between save and load, so it exercises
persistence across a page lifetime rather than a reset.

Engine additions: `Sim.restore(species, ra, rb)` (clear → write → activate
chunks per occupied cell, clock at the settled value), `ElementRegistry.all()`
(remap-by-name needs both directions), `SimRenderer.snapshot()` → PNG data URL
for thumbnails.

Deviations, all deliberate — **worth a look at whole-branch review**:
- Thumbnails live in their own `silt:thumb:<uuid>` key, not the index; the spec
  pins the index shape, and a PNG there would be re-read every render. A
  thumbnail lost to quota doesn't lose the scene.
- **Save always creates a new row** (first unused `scene N`, renamed inline) —
  no overwrite. Overwrite needs a reliable notion of "the scene I'm editing"
  that the header name only approximates, and getting it wrong destroys a
  scene. This is the deviation most worth a second opinion.
- `Ctrl+S` (and `Cmd+S`) also opens the popover, because the save result
  message lives there and saving with it shut would be silent — against §8's
  "loud, never silent".
- Popover has a close × and Escape closes it (not in §9, but a popover needs an
  exit). Global keydown now ignores events from `<input>` so typing "1" in a
  rename field no longer switches element.

Its code review caught five real bugs, all fixed before commit — the sharpest
being that boot `reconcile()` could throw out of a `useEffect` on a full quota,
taking the page down and removing the only route to the delete button, i.e.
breaking the exact escape hatch spec §8 requires. Also: `remove()` wrote the
index before freeing the blob (so a full quota broke delete), orphan thumbnail
keys were unreclaimable, a warning-but-successful load was reported in the
destructive tone, and auto-names could collide after deleting a middle row.

Follow-up commit `45b8627` pins spec §8's "`clock` is not persisted, reset to 0
on load" as a standing assertion — it had rested on a structural argument plus
a manual check, which is exactly what regresses silently when someone later
adds a fourth plane. The test asserts the source world has non-zero clock bytes
first (so it can't pass vacuously), that the serialised envelope contains no
"clock" string, and that every restored clock byte is 0. Verified red before
green by making `Sim.restore` write a non-zero clock.

Gate run by the orchestrator on the merged 09+10 tree: lint/typecheck clean,
105 vitest + 23 iwft green.
