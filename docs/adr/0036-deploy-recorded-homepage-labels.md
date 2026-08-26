# 0036 — The homepage's New / Updated labels are recorded by CI

- **Status:** Accepted
- **Date:** 2026-08-26
- **Related:** [0002-documentation-and-delivery.md](0002-documentation-and-delivery.md)
  (the deploy workflow this extends).
- **Spec:** `.scratch/automatic-homepage-labels/spec.md`.

## Context

The two pills on the hub homepage cards were driven by hand-written ISO dates in
`HomePage.tsx`. Nobody remembered to update them. Silt shipped four stacked
material PRs before its `updatedAt` moved, and boids, fridge and wotd never had
a date at all.

The obvious automation — ask GitHub when `apps/<name>/` last changed — answers
the wrong question. That date moves for a typo fix, a dependency bump or a
test-only change. A badge that is always lit says nothing.

## Decision

**Record deploys, not commits.** The deploy workflow already knows the fact the
badge actually claims: this app is now serving a new version. After a green
post-deploy smoke, a single `record-deploys` job appends that fact to
`apps/hub/src/generated/deployments.json`, commits it to main, and redeploys
hub. `firstDeployedAt` drives **New** and is written once; `lastDeployedAt`
drives **Updated** and moves on every deploy.

Three consequences worth stating, because each is easy to undo by accident:

1. **The write-back push uses the default `GITHUB_TOKEN`.** GitHub raises no
   workflow events for pushes made with it, and that is the loop guard. A PAT or
   deploy key would make the job trigger itself forever. `[skip ci]` in the
   message is a courtesy to the log reader, not the guard.
2. **Because of (1), the commit cannot redeploy hub** — so the job runs
   `flyctl deploy` on hub itself. Without that step the dates are right in git
   and stale on the site.
3. **One collector job, not a step per app.** The `deploy-*` jobs run in
   parallel and a shared-package change makes every app affected, so per-job
   pushes would mostly be rejected pushes.

## Consequences

**Accepted:** a deploy that only touched config or tests still lights the pill.
Turbo's affected-set is the definition of "changed", and it is coarser than
"worth telling a visitor about". If that grates, a `[skip-badge]` commit-message
marker is the follow-up.

**Accepted:** when hub is itself in a push it deploys twice — once in
`deploy-hub`, once in the collector. Two minutes of remote build, cheaper than
a conditional that could get the ordering wrong.

**Rejected:** a runtime tRPC procedure in hub querying the GitHub API and caching
in Postgres. Schema, migration, store, handler, fake and fallback path — days of
machinery, plus a runtime dependency on GitHub, for a decorative pill.
