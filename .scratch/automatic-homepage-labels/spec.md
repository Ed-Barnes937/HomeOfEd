# Spec — automatic "New" / "Updated" labels on the hub homepage

**Status:** ready-for-agent

## Problem

The two pills on the homepage cards are driven by hand-written ISO dates in
`apps/hub/src/pages/HomePage.tsx` (`deployedAt`, `updatedAt`), read by
`isNew.ts` (14-day window) and `isUpdated.ts`. Nobody remembers to update them,
so they drift: Silt shipped four stacked material PRs before its `updatedAt`
moved, and boids/fridge/wotd have never had a date at all.

## Decision

**Record deploys, not commits.** The deploy workflow already knows the one fact
the badge claims — "a new version of this app is now serving traffic". After a
green post-deploy smoke, CI appends that fact to a committed
`apps/hub/src/generated/deployments.json`, and hub reads the file at build time.

Rejected alternatives (see the conversation of 2026-08-25):

- **Last commit touching `apps/<name>/`, via the GitHub commits API or `git log`.**
  Cheap, but it fires on typo fixes, dependency bumps and test-only changes.
  A badge that is always on means nothing.
- **A runtime tRPC procedure in hub that queries GitHub and caches in Postgres.**
  Schema, migration, store, handler, fake, fallback path — days of machinery,
  and a runtime dependency on GitHub for a decorative pill.

## Shape

```
deploy-<app> jobs (parallel, unchanged)
        │  each exposes `deployed: true|false` as a job output
        ▼
record-deploys job   needs: [every deploy-* job]
        │  1. merge the successful deploys into deployments.json
        │  2. commit + push to main with the default GITHUB_TOKEN
        │  3. flyctl deploy hub, so the new dates reach the browser
        ▼
homepage cards read the generated file at build time
```

### `apps/hub/src/generated/deployments.json`

Keyed by **workspace package name** (`silt`, not `Silt`):

```json
{
  "silt": { "firstDeployedAt": "2026-08-07T00:00:00Z", "lastDeployedAt": "2026-08-24T19:02:11Z" },
  "boop": { "firstDeployedAt": "2026-08-07T00:00:00Z", "lastDeployedAt": "2026-08-07T00:00:00Z" }
}
```

`firstDeployedAt` drives **New** (unchanged 14-day rule). `lastDeployedAt`
drives **Updated**. "New" still wins while both windows are open.

## The three things that make or break this

1. **The write-back must not re-trigger the workflow.** Push with the default
   `GITHUB_TOKEN`. GitHub does not raise workflow events for pushes made with
   it, which is exactly the loop protection we need. A PAT or a deploy key
   would loop forever — do not "fix" the push that way.
2. **Because of (1), the commit alone cannot redeploy hub.** The collector job
   must call `flyctl deploy --config apps/hub/fly.toml --remote-only` itself,
   after the commit. Without that step the file is correct in git and stale in
   the browser, which looks like the feature working right up until you check.
3. **One committer, not ten.** The `deploy-*` jobs run in parallel; a
   shared-package change makes every app affected. Ten jobs racing to push to
   main is ten rejected pushes. All recording happens in the single collector
   job.

## Seeding

An empty file would make every live app's next deploy look like a launch, so
every app gets seeded with a `firstDeployedAt` before the first automated run.
Done in ticket 01: the existing literals where they existed (espy `2026-07-09`,
karesansui `2026-07-10`, boop `2026-08-07`, silt `2026-08-07`), and for boids
(`2026-07-03`), fridge (`2026-07-04`) and wotd (`2026-07-05`) — which predate
the pill — the date their `fly.toml` was added.

`lastDeployedAt` is seeded equal to `firstDeployedAt` **except for silt**, which
takes its `2026-08-24` `updatedAt` literal. Silt is showing an Updated pill
today and the seed should not silently take it away.

## Scope

**In:** the merge script and its tests (lives in hub, see ticket 01), the collector job, the seed file, hub
reading it, iwft coverage of both pills.

**Out:**
- Suppressing badge-noise from deploys that only touched config or tests. If a
  dependency bump marking an app "Updated" turns out to grate, a `[skip-badge]`
  commit-message marker is the follow-up — not part of this.
- sprout and sprout-pipeline. They are gated on `SPROUT_GO_LIVE` and have no
  homepage card.
- HEIG and any other `SOON` card. No deploy, no entry, no pill.
