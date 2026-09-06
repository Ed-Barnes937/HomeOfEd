# Runbook: the DEPLOY_RECORD_TOKEN secret

Human-run - agents must not create or rotate credentials (root CLAUDE.md,
"Infrastructure is human-gated").

`record-deploys` (deploy.yml) pushes the `deploy-record` branch and drives its
auto-merged PR with this token instead of `GITHUB_TOKEN`, so the PR's required
checks actually run in PR context - see
[ADR 0047, as amended](../adr/0047-deploy-record-lands-via-pr.md). Without it,
the land step fails fast with a pointed error and the record is carried
forward by the next deploy; the homepage pills lag but nothing is lost.

## Create (once)

1. GitHub → Settings → Developer settings →
   [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new).
2. Fill in:
   - **Token name:** `hoe-deploy-record`
   - **Resource owner:** `Ed-Barnes937`
   - **Repository access:** Only select repositories → `HomeOfEd`
   - **Repository permissions:** `Contents: Read and write`,
     `Pull requests: Read and write` - nothing else.
   - **Expiration:** 1 year (the maximum; see Rotate below).
3. Generate, copy the token, then store it as the repo secret:

   ```bash
   gh secret set DEPLOY_RECORD_TOKEN --repo Ed-Barnes937/HomeOfEd
   # paste the token at the prompt
   ```

4. Verify on the next recordable deploy: the `deploy-record` PR's checks run
   (they show on the PR, not just the branch) and the PR auto-merges within
   one check cycle (~4 min).

## Rotate (on expiry)

GitHub emails a warning before a fine-grained PAT expires. Repeat Create; the
`gh secret set` overwrites in place. If it lapses, deploy runs fail at "Land
the record through a PR" with `DEPLOY_RECORD_TOKEN is not set` (an expired
token instead fails the push with 401) - rotate and the next deploy self-heals
via carry-forward.

## Why a PAT at all

`GITHUB_TOKEN` pushes raise no `pull_request` events, and the dispatch
workaround's check runs never associate with the PR, so its auto-merge hangs
forever (proven on PR #129, 2026-09-06). The PAT is scoped to this one repo
and to exactly the two permissions the branch push + PR flow needs, and the
record still enters main only through the PR's required checks.
