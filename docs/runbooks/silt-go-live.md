# silt go-live (human-gated)

silt (`apps/silt`) is a basic cellular-automaton sandbox at
`silt.homeofed.com`. It is **stateless**
([ADR 0008](../adr/0008-apps-without-a-database.md)) — client-side simulation
and scene persistence, nothing server-owned. Same shape as espy/karesansui
(runbook [G4.10](phase-4-go-live.md#g4-10-espy-db-less-app-go-live) /
[G4.11](phase-4-go-live.md#g4-11-karesansui-go-live-db-less)): no
`fly postgres attach`, no `DATABASE_URL`, no `release_command`.

Values used below — confirmed against `apps/silt/fly.toml` and the other
live apps' `fly.toml`s (all `primary_region = 'lhr'`):

| Thing | Value |
| --- | --- |
| Fly app | `hoe-silt` (matches `apps/silt/fly.toml`) |
| Fly region | `lhr` (London) |
| Subdomain | `silt.homeofed.com` |

This file follows the structure of
[phase-4-go-live.md](phase-4-go-live.md) G4.6–G4.11, adapted to silt.

## Pre-flight — this file records only what could NOT be verified by the agent

- **`FLY_API_TOKEN` scope**: could not check from the repo whether the
  GitHub secret currently covers `hoe-silt` — the token itself isn't
  readable from config. If the org-scoped deploy token from a previous
  go-live (boids/espy/karesansui) is already in place, nothing to do;
  an app-scoped `hoe-hub` token will make the `deploy-silt` CI job fail
  auth. If needed:

  ```bash
  fly tokens create org --name hoe-deploy |
    gh secret set FLY_API_TOKEN --repo Ed-Barnes937/HomeOfEd
  ```

- Everything else below (fly.toml shape, CI job, compose service, Docker
  build/run, repo-wide lint/typecheck/test) **was** verified directly — see
  the agent's report for the commands and output.

## The one-command path (recommended)

```bash
fly auth login                                     # once, if not already
export CLOUDFLARE_API_TOKEN=...                    # Zone.DNS:Edit on homeofed.com
scripts/go-live.sh silt                            # NO --db (stateless)
# scripts/go-live.sh silt --dry-run                # preview every command first
```

That creates `hoe-silt`, deploys it, adds the `silt` CNAME grey-cloud, waits
for the Fly cert to be Issued, flips the record to proxied, and verifies
`/health` + the SPA index. Idempotent — safe to re-run.

## Manual fallback (what the script does)

```bash
fly apps create hoe-silt                           # must match apps/silt/fly.toml
# NO fly postgres attach — stateless (ADR 0008)
fly deploy --config apps/silt/fly.toml --remote-only   # from the repo root
fly certs add silt.homeofed.com --app hoe-silt         # after the first deploy
```

First deploy can also happen by merging this branch to `main` — the
`deploy-silt` job in `.github/workflows/deploy.yml` is gated on
`FLY_API_TOKEN` being set and on silt being affected by the push; once the
token exists it runs automatically on every merge that touches silt.

Cloudflare (dashboard): **DNS → Records → Add record**, type `CNAME`, name
`silt`, target `hoe-silt.fly.dev`, **Proxied** (orange cloud) — Full (strict)
TLS is zone-wide already (set in G4.4). Grey-cloud any ACME validation
record `fly certs add` prints, then:

```bash
fly certs check silt.homeofed.com --app hoe-silt   # wait for Issued
```

## Verify it worked

```bash
curl -fsS https://hoe-silt.fly.dev/health          # → {"ok":true} — in-memory liveness, no DB round-trip
curl -fsS https://silt.homeofed.com/health         # same, through Cloudflare
open  https://silt.homeofed.com                    # the app itself
```

Smoke the core loop in the browser:

1. **Paint** — select an element (e.g. sand), paint a few cells onto the
   grid while paused.
2. **Play** — press play; painted sand falls and settles.
3. **Save** — open the scenes popover, save the current world as a scene.
4. **Load** — reload the page, open the scenes popover, load the saved
   scene back — it should arrive paused with the same cells in place.

There is no server-side state to verify beyond process liveness — the
save/reload round-trip exercises `localStorage`, entirely client-side
(`src/features/scenes/`).

## Not this agent's job (post-go-live)

Confirming the CI-driven deploy actually ran clean on merge, and re-running
the smoke checks above against the real `silt.homeofed.com` domain once DNS
and the cert have propagated, happens after the human completes the steps
above — that follow-up is separate from this checklist.
