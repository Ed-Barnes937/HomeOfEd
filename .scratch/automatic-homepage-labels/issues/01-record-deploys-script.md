# 01 — The merge script and the seeded deployments.json

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)

**What to build:** `apps/hub/src/deployments/` — the pure bit of the feature,
so the shell in the workflow stays dumb. It lives inside hub rather than root
`scripts/` because the root workspace has no test runner (`pnpm test` is just
`turbo run test` over the packages) and hub owns the file being written. It reads the current
`apps/hub/src/generated/deployments.json`, merges in the apps named on argv, and
writes the file back.

```
node scripts/record-deploys.mjs --at 2026-08-25T20:44:07Z silt boop
```

Rules:

- An app with no existing entry gets `firstDeployedAt` **and** `lastDeployedAt`
  set to `--at`.
- An app with an entry gets only `lastDeployedAt` moved. `firstDeployedAt` is
  written once and never rewritten — it is the launch date.
- Keys stay sorted and the file ends with a newline, so the CI commit diff is
  one line per app and never a reordering.
- No apps on argv → write nothing and exit 0. The collector calls it
  unconditionally.
- `--at` must parse as a date; anything else is a hard exit 1. A malformed
  timestamp silently poisoning the file is worse than a red build.

Also create the seeded file itself, per spec §Seeding. Every app with a LIVE
homepage card gets a `firstDeployedAt`; set `lastDeployedAt` to the same value.
Keys are workspace package names: `boids`, `fridge`, `wotd`, `espy`,
`karesansui`, `boop`, `silt`. Not `hub` — the hub card is not on its own
homepage.

**Easy to get wrong:** the script runs in CI *before* the commit, against a
checkout that may be several deploys old. Read-modify-write the file on disk;
never reconstruct it from a hard-coded app list, or an app someone adds later
gets dropped on the next deploy.

- [ ] Unit tests first: new app seeds both fields; existing app moves only
      `lastDeployedAt`; empty argv is a no-op; bad `--at` exits non-zero
- [ ] Output is stable — running the script twice with the same `--at` produces
      a byte-identical file
- [ ] The seeded `deployments.json` is committed, with every LIVE card covered
- [ ] `pnpm lint`, `pnpm typecheck` green
