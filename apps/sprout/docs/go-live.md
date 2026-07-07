# sprout go-live (P11 — human-in-the-loop)

The infra steps to bring **hoe-sprout** (web + worker) and **hoe-sprout-pipeline**
(private) live. These create/mutate real infrastructure — **run by a human, never
an agent** (root `CLAUDE.md`). This is a sprout-specific supplement to the platform
runbook [`docs/runbooks/phase-4-go-live.md`](../../../docs/runbooks/phase-4-go-live.md);
where they differ, this doc wins for these two apps.

> **Two gates, both required.** This is the *infrastructure* gate. There is also a
> *legal / safeguarding* release gate — [`launch-readiness.md`](launch-readiness.md)
> — that blocks launch to real users until counsel sign-off and a named
> Designated Safeguarding Lead exist. Deploying the apps does **not** satisfy that
> gate. Do not open the product to real children/parents until both are closed.

Values:

| Thing | Value |
| --- | --- |
| Web Fly app | `hoe-sprout` (matches `apps/sprout/fly.toml`) |
| Pipeline Fly app | `hoe-sprout-pipeline` (matches `apps/sprout-pipeline/fly.toml`) |
| Region | `lhr` |
| Postgres | **Managed** Fly Postgres (MPG), sprout-only — **not** the shared `hoe-pg` |
| Web domain | `sprout.homeofed.com` (pipeline gets **no** public hostname) |

---

## What differs from the standard runbook

1. **Managed Postgres, not unmanaged** ([ADR 0005](../../../docs/adr/0005-unmanaged-fly-postgres.md),
   D10). ADR 0005 names "the child-safe LLM app goes live" as the trigger to move
   from the unmanaged `hoe-pg` cluster to **Managed Fly Postgres** (backups + PITR
   for the compliance weight of children's data). So sprout does **not**
   `fly postgres attach hoe-pg`; provision MPG and set `DATABASE_URL` by hand.
2. **Org-scoped deploy token.** The existing `FLY_API_TOKEN` repo secret was minted
   `--app hoe-hub` (app-scoped) and **cannot** deploy either new app. Mint an
   **org-scoped** token and replace the repo secret before the `deploy-sprout*` CI
   jobs run.
3. **A private second app.** `hoe-sprout-pipeline` has no `[http_service]`, so it
   gets **no public IP, no Cloudflare CNAME, no Fly cert** — it stays on the
   private `.flycast` network. The Cloudflare step is sprout-only.
4. **A worker process group.** `hoe-sprout` runs `web` + `worker` from one image;
   the worker's machine count is set out of band after the first deploy.

---

## Steps

### 1. Create both Fly apps

```bash
fly apps create hoe-sprout
fly apps create hoe-sprout-pipeline
```

### 2. Managed Postgres for hoe-sprout (D10)

Provision **Managed** Postgres in `lhr` (console or `fly managed-postgres`, per
current Fly CLI), create sprout's database, then set the connection string as a
secret on the web app only:

```bash
fly secrets set --app hoe-sprout DATABASE_URL='postgres://…the MPG connection string…'
```

Do **not** run `fly postgres attach hoe-pg` for this app.

### 3. Secrets

`main.ts` and `worker.ts` refuse to boot in prod without `CHILD_SESSION_SECRET`
and `PIPELINE_API_KEY`; the pipeline refuses to boot without `OPENROUTER_API_KEY`
and `PIPELINE_API_KEY`. `PIPELINE_API_KEY` must be the **same value** on both apps
(the caller sends it as `x-pipeline-key`).

```bash
fly secrets set --app hoe-sprout \
  BETTER_AUTH_SECRET='…' \
  BETTER_AUTH_URL='https://sprout.homeofed.com' \
  CHILD_SESSION_SECRET='…' \
  PIPELINE_API_KEY='…shared…'
# (DATABASE_URL already set in step 2.)

fly secrets set --app hoe-sprout-pipeline \
  OPENROUTER_API_KEY='…lives ONLY here…' \
  PIPELINE_API_KEY='…same shared value as hoe-sprout…'
```

`OPENROUTER_API_KEY` lives **only** on the pipeline — that secret isolation is the
reason it is a separate app ([ADR 0013](../../../docs/adr/0013-headless-service-app-shape.md)).
`PIPELINE_URL` defaults to `http://hoe-sprout-pipeline.flycast:8080`; override only
if the pipeline app is renamed.

### 4. Org-scoped deploy token

Mint an org-scoped token and set it as the `FLY_API_TOKEN` repo secret (replacing
the hoe-hub app-scoped one), so `deploy-sprout` and `deploy-sprout-pipeline` in
`.github/workflows/deploy.yml` can run. Confirm the hub deploy still works with the
org token.

### 5. First deploy

Deploy the **pipeline first** (the web app calls it at runtime; it fails closed if
the pipeline is down, but deploying it first avoids a cold window). CI does this on
push once the token is set, or manually:

```bash
fly deploy --config apps/sprout-pipeline/fly.toml --remote-only
fly deploy --config apps/sprout/fly.toml --remote-only   # release_command runs migrations
```

### 6. Scale the worker

`min_machines_running` in `fly.toml` is an `http_service` setting and governs the
`web` group only ([ADR 0014](../../../docs/adr/0014-worker-process-scheduled-work.md)).
After the first deploy, guarantee exactly one always-on worker:

```bash
fly scale count worker=1 web=1 --app hoe-sprout
```

### 7. Cloudflare — sprout only

Proxied CNAME `sprout → hoe-sprout.fly.dev`, Full (strict) TLS, Fly cert for
`sprout.homeofed.com`. **Do not** create any DNS/cert for `hoe-sprout-pipeline` —
it stays private.

### 8. Verify

```bash
curl -fsS https://sprout.homeofed.com/health        # deep Store→Postgres round-trip
fly status --app hoe-sprout-pipeline                 # machine healthy (no public URL)
fly logs --app hoe-sprout                            # worker sweep fires on its interval
```

Then confirm `hoe-sprout` reaches `hoe-sprout-pipeline.flycast` (same Fly org / 6PN)
by exercising a chat turn end-to-end.

---

## Before real users

The infra above being green is **necessary but not sufficient**. Close every item
in [`launch-readiness.md`](launch-readiness.md) — counsel sign-off on the OSA scope
determination and the safeguarding runbook, a named Designated Safeguarding Lead
with reachable contact, the flag-review cadence, and the secure incident log —
before the product is opened to real children and parents. Those items require a
human lawyer and a human owner; an agent must not tick them.
