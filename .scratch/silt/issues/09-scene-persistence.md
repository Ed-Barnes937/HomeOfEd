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

**Status:** claimed

- [ ] Save → reload page → load restores cells (pixel-identical: `ra`/`rb` kept), spawners, entering paused
- [ ] Round-trip, remap-unknown-element, dimension-mismatch (paste and refuse), and quota-failure behaviours covered by tests
- [ ] Popover supports save, load, rename, second-click delete, thumbnails
- [ ] Boot reconcile handles dangling index rows and orphan blobs
- [ ] `*.iwft` covers paint → save → reload → load; lint/typecheck/tests green
