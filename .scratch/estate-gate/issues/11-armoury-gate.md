# 11 - armoury: per-profile saves, `/shared`, and the gate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 5-8, 10
Blocked by: 01, 02, 10 (merge after 17)

Copy the merged pattern from ticket 10 (boop), without sync; armoury is not a SaveStore client.

- `armoury:save` (`src/persistence/storage.ts`) goes through
  `profileScopedKey`; `adoptLegacyDocument` on first open. The save format
  (ADR 0074) is untouched.
- `/shared`: decodes the existing `#w=` payload (ADR 0075) and shows the wand
  with the workbench usable and nothing persisted. "Keep this wand" links to
  `/#w=...`. Share now produces `/shared#w=...`; picture sharing is unchanged.
  A root `/#w=` link keeps today's behaviour for a signed-in visitor.
- A way to switch player: a link to `accountUrl(<current URL>)` in the app's
  existing chrome, in armoury's own style.
- Gate wiring in `main.ts` with `publicPaths: ['/shared']`, and
  `FAMILY_ACCOUNT_URL` in `fly.toml`. Not `compose.yml` or `deploy.yml`.
- iwft: per-profile shelf, legacy adoption, `/shared` writes nothing. Update
  `apps/armoury/CLAUDE.md`; amend ADR 0075.

## Comments
