# 02 — The `record-deploys` CI job

**Status:** done
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md) §Shape, §"The three things"

**What to build:** one new job at the bottom of `.github/workflows/deploy.yml`
that runs after every `deploy-*` job, records what actually shipped, and pushes
the result.

**Step 1 — expose each deploy's outcome.** Every `deploy-<app>` job gains an
`outputs:` block forwarding its existing `affected` step:

```yaml
  deploy-silt:
    runs-on: ubuntu-latest
    outputs:
      deployed: ${{ steps.affected.outputs.deploy }}
```

No other change to those jobs. This is the copy-the-job-and-swap-the-name
pattern the file already uses — apply it to all seven homepage apps plus hub.

**Step 2 — the collector.**

```yaml
  record-deploys:
    runs-on: ubuntu-latest
    needs: [deploy-hub, deploy-boids, deploy-espy, deploy-karesansui,
            deploy-boop, deploy-silt, deploy-fridge, deploy-wotd]
    if: always()
    permissions:
      contents: write
```

An app counts as shipped when **both** `needs.deploy-X.result == 'success'` and
`needs.deploy-X.outputs.deployed == 'true'`. `result` alone is not enough: a
skipped app's job is also "success". Build the app list, then:

1. `node apps/hub/src/deployments/recordDeploys.ts --at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" $APPS`
   (built in ticket 01 — it lives in hub, not root `scripts/`, so hub's vitest
   covers it. It needs `pnpm install` in the job for nothing; plain `node` and
   Node 22 type-stripping are enough, matching hub's `start` script.)
2. Nothing changed (`git diff --quiet`)? Exit 0 — no commit, no hub deploy.
3. Commit as `github-actions[bot]`, message
   `chore: record deploys (<apps>) [skip ci]`, then
   `git pull --rebase && git push`, retried once on rejection. A human merge
   landing mid-run is normal, not an error.
4. `flyctl deploy --config apps/hub/fly.toml --remote-only`.

**The three traps:**

- **Push with the default `GITHUB_TOKEN`.** Pushes made with it do not raise
  workflow events, which is the only thing stopping this job from triggering
  itself forever. Do not swap in a PAT, and do not rely on `[skip ci]` — that
  string is a courtesy for the humans reading the log, not a guard.
- **Because of the above, the commit will not redeploy hub.** Step 4 is
  load-bearing. Skip it and the dates are right in git and stale on the site.
- **Keep the same `FLY_API_TOKEN` gate as every other job.** With no token the
  job must print its notice and exit green, exactly like the deploy jobs do
  until Phase 4.

**Accepted cost:** when hub itself is in the push, hub deploys twice — once in
`deploy-hub`, once here. Two minutes of remote build. Not worth a conditional
that could get the ordering wrong.

**Do not run this against real infrastructure.** Writing the workflow is the
task; the first live run happens on a merge to main, human-gated as usual.

- [ ] Every `deploy-*` job exposes `deployed`
- [ ] Collector shows the correct app list for: one app affected, several
      affected, none affected, and one deploy failing while another succeeds
      (verified by reading the expression logic — assert it in the PR
      description, there is no local runner for this)
- [ ] No-change run makes no commit and does not deploy hub
- [ ] Token-less run exits green with a notice
- [ ] `actionlint` (or `pnpm lint` if it covers workflows) is green

## Verification

There is no local runner for GitHub Actions expressions, so the two halves were
checked separately:

- **The YAML and the wiring** parse under `yaml.safe_load`; every `deploy-*`
  job for a homepage app exposes `deployed`, and `record-deploys` needs all
  eight jobs.
- **The shell** was extracted verbatim from the `run:` block and executed
  against a throwaway git repo holding a copy of the seeded file, with the
  `needs.*` expressions stood in as env vars:

  | Scenario | Result |
  | --- | --- |
  | one app affected (silt) | `apps=silt changed=true`, 1-line diff |
  | several affected (silt, boop, fridge) | `apps=boop fridge silt changed=true`, 3-line diff |
  | none affected | `changed=false`, no write, notice printed |
  | silt succeeded, boop's job failed | `apps=silt` — the failure is excluded |

  The three-app case producing exactly three changed lines is the sorted
  serialisation from ticket 01 doing its job.

## Notes for whoever reviews the PR

- `deploy-hub` is in `needs` but has **no** `outputs` block and is never
  recorded. hub has no card on its own homepage; it is in `needs` purely so
  this job's hub deploy cannot race `deploy-hub`'s.
- The sprout jobs are deliberately not in `needs` — gated on `SPROUT_GO_LIVE`,
  no homepage card.
- The workflow's existing `concurrency: deploy-${{ github.ref }}` with
  `cancel-in-progress: false` means two `record-deploys` jobs can never run at
  once, which is a second line of defence behind the rebase-and-retry push.
- The first live run is a merge to main, human-gated as always. Nothing here
  was executed against real infrastructure.
