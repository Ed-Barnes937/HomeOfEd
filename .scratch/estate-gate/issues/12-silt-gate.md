# 12 - silt: per-profile scenes and the gate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 7, 8, 10; open call on quota
Blocked by: 01, 02, 10 (merge after 17)

silt has no share links, so no `/shared`.

- **Measure first.** silt stores `silt:scenes`, `silt:scene:<id>`,
  `silt:thumb:<id>`, `silt:fieldNotes` and `silt:seen`. Report the bytes a
  full set of scenes takes and how many profiles fit under the `localStorage`
  quota if every profile copies the legacy set. If three profiles do not fit
  comfortably, stop and put the numbers in a comment here for Ed: the fallback
  is that only the first profile on a device adopts the legacy scenes.
- Scope those keys per profile through `profileScopedKey` (the scene and thumb
  keys are prefixes, so the scoping wraps the key builder in `sceneStore.ts`
  and `fieldNotesStore.ts`, not each call site). Adopt legacy data per the
  outcome above. Save formats are untouched.
- A switch-player link to `accountUrl(<current URL>)` in silt's own chrome.
- Gate wiring in `main.ts` (no public paths) and `FAMILY_ACCOUNT_URL` in
  `fly.toml`. Not `compose.yml` or `deploy.yml`.
- iwft: per-profile scenes and field notes; legacy adoption. Update
  `apps/silt/CLAUDE.md`.

## Comments
