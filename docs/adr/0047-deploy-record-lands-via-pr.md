# 0047 - the deploy record lands on main through a PR

- Status: accepted
- Date: 2026-09-04

## Context

The `record-deploys` job (deploy.yml) writes `apps/hub/src/generated/deployments.json`
after every green deploy, so the homepage's New / Updated pills follow real
releases. It used to `git push origin HEAD:main` with the checkout's
`GITHUB_TOKEN` - the token was doing double duty as the recursion guard, because
GitHub raises no workflow events for pushes made with it.

Branch protection on main (required checks `verify` + `real-Postgres suite`,
since 2026-08-26) rejects that push with GH006: required status checks are
expected on every push, whoever makes it, and classic branch protection has no
per-actor bypass for them. Every Deploy run from 2026-08-26 to 2026-09-04 went
red at this step, and fourteen runs' worth of deploys (mostly silt, plus boids,
boop, espy, fridge, karesansui, wotd) never reached the record. This ADR's PR
backfills them from the failed runs' logs, replayed through `recordDeploys.ts`.

## Decision

The record lands through a short-lived, auto-merged PR, and the recursion guard
moves from the token to the workflow triggers:

1. `record-deploys` commits the updated record to a `deploy-record` branch
   (always exactly one commit ahead of main, force-pushed), opens or refreshes
   a PR to main, and arms `gh pr merge --squash --auto`.
2. A branch pushed with `GITHUB_TOKEN` raises no `pull_request` event - the
   same suppression the old design leaned on - so the required checks would
   never run and the auto-merge would hang. `workflow_dispatch` is GitHub's
   documented exception to the suppression, so pr.yml gains that trigger and
   `record-deploys` dispatches it onto the branch; the check runs attach to the
   PR's head SHA, where branch protection finds them.
3. Recursion guard: deploy.yml's push trigger gets
   `paths-ignore: apps/hub/src/generated/deployments.json`, so the record
   merging is invisible to the deploy workflow. `[skip ci]` stays in the commit
   message as a second, independent lock (GitHub honours it natively for push
   events). Even with both locks off, the loop self-terminates: a record-only
   push makes only hub affected, and hub is never recorded.
4. The site does not wait for the PR: `record-deploys` still redeploys hub from
   its own working tree, which already holds the new record.
5. A record stuck in an unmerged PR (a flaky check, a dropped dispatch) is
   self-healing: the next run seeds the recorder from the `deploy-record`
   branch's file, counts the carry-forward as a change (diff against HEAD, not
   the index), and re-pushes, re-arms and re-dispatches.
6. The repo setting "Allow GitHub Actions to create and approve pull requests"
   is enabled - required for step 1, and not a weakening of branch protection:
   the bot's PRs face the same required checks as everyone else's.

## Consequences

- Deploy runs go green again, and the pills follow real deploys again.
- The record reaches main a few minutes after the deploy (one PR-check cycle)
  instead of immediately; the live site is fresh immediately regardless (4).
- One recorded push now costs a full PR-check cycle of CI (~4 min of runner
  time) - the price of keeping required checks unconditional on main.
- `deploy-record` is a bot-owned branch: never commit to it by hand, anything
  there is force-pushed away on the next deploy.
- Rejected alternatives: a PAT or deploy key pushing straight to main
  (re-opens the recursion problem the old comment warned about, and bypassing
  required checks per-actor needs rulesets, not classic protection); moving
  the record out of git (the record is build-time input to hub, and git is
  what makes it reviewable and revertable).
