# Phase 4 runbooks — going live (human-in-the-loop)

The exact commands for G4.1–G4.5 of the
[implementation plan](../plans/0001-foundation-implementation-plan.md). These
create and mutate real infrastructure — **they are run by a human, never by an
agent** (root `CLAUDE.md`). Prerequisites: a Fly.io account, `flyctl`
installed and logged in (`fly auth login`), the `homeofed.com` zone in a
Cloudflare account, admin on the GitHub repo.

Values used throughout (change if you picked different names):

| Thing | Value |
| --- | --- |
| Fly app | `hoe-hub` (must match `apps/hub/fly.toml`) |
| Fly region | `lhr` (London) |
| Postgres cluster (unmanaged) | `hoe-pg` |
| hub's database | `hub` |
| Apex domain | `homeofed.com` |

---

## G4.1 — Fly app + Postgres

Unmanaged Fly Postgres, not Managed Postgres — see
[ADR 0005](../adr/0005-unmanaged-fly-postgres.md) for why and for the later
migration plan to MPG.

> **Stateless apps skip Postgres.** An app with no database
> ([ADR 0008](../adr/0008-apps-without-a-database.md)) runs only
> `fly apps create <flyapp>` here — no `fly postgres attach`, no `DATABASE_URL`
> secret — and drops the `release_command` from its `fly.toml`. Its `/health` is
> a shallow liveness check; the deploy smoke still fetches the SPA index + an
> asset. The steps below assume a DB-backed app.

```bash
# The app shell (no deploy yet). --name must match fly.toml.
fly apps create hoe-hub

# Unmanaged Postgres cluster in London (plain Fly Machines billed as compute).
# Pick the Development single-node configuration — it can be scaled later.
fly postgres create --name hoe-pg --region lhr

# Create hub's database (one DB per app — ADR 0001), a scoped user, AND set
# hub's DATABASE_URL secret, all in one step:
fly postgres attach hoe-pg --app hoe-hub --database-name hub

# Sanity-check the secret exists (value stays hidden):
fly secrets list --app hoe-hub
```

Notes: the attach-set secret uses the private `hoe-pg.flycast` host, which the
app reaches over Fly's internal network. A secret set on an app with no
releases is staged; it applies on the first deploy.

## G4.2 — GitHub deploy secret

```bash
# A deploy-scoped token (preferred over a personal token), piped straight
# into the repo secret so .github/workflows/deploy.yml comes alive. Pipe it —
# the token contains a space after "FlyV1", which breaks passing it as a
# shell argument, and piping keeps it out of shell history:
fly tokens create deploy --app hoe-hub |
  gh secret set FLY_API_TOKEN --repo Ed-Barnes937/HomeOfEd
```

The deploy workflow is inert until this secret exists; afterwards every merge
to `main` that affects an app deploys it.

## G4.3 — First deploy

Either merge a PR touching `apps/hub` and watch the `Deploy` workflow, or run
the same thing locally **from the repo root** (the Docker build context must
be the monorepo):

```bash
fly deploy --config apps/hub/fly.toml --remote-only
```

Verify:

```bash
# release_command ran the migrations — check the release logs:
fly logs --app hoe-hub | head -50     # look for {"msg":"migrations applied"}

curl -fsS https://hoe-hub.fly.dev/health          # → {"ok":true}
curl -fsS https://hoe-hub.fly.dev/api/trpc/health # → "hello from postgres"
open  https://hoe-hub.fly.dev                     # the landing page
```

## G4.4 — Cloudflare DNS + TLS

In the Cloudflare dashboard for `homeofed.com`:

1. **Delete any existing `A` records** for the apex (and `www`) — Cloudflare
   won't allow a CNAME at a name that already has an A record. Check what the
   old IP serves before deleting.
2. **DNS → Records → Add record**: type `CNAME`, name `@` (the apex),
   target `hoe-hub.fly.dev`, **Proxied** (orange cloud). Cloudflare flattens
   the apex CNAME automatically.
3. **SSL/TLS → Overview**: set encryption mode to **Full (strict)**.

Then request the Fly certificate and add its validation records:

```bash
fly certs add homeofed.com --app hoe-hub
fly certs setup homeofed.com --app hoe-hub   # prints the records below
```

Because the domain is proxied, Fly can't see it pointing at the app (it
resolves to Cloudflare's IPs) and the ACME HTTP challenge can't reach Fly —
so **both** "additional" records from the setup output are required, added in
Cloudflare as **DNS-only (grey cloud)**, names entered *without* the domain
suffix (Cloudflare appends it):

| Type | Name | Content |
| --- | --- | --- |
| TXT | `_fly-ownership` | `app-<id>` (from the setup output) |
| CNAME | `_acme-challenge` | `homeofed.com.<id>.flydns.net` |

```bash
fly certs check homeofed.com --app hoe-hub   # re-checks; wait for Issued
```

If it sits at not-verified, `dig +short TXT _fly-ownership.homeofed.com @1.1.1.1`
(and the CNAME equivalent) — empty output means the records aren't live:
check for truncated names/values and the grey cloud.

**`www`** gets no Fly cert: keep a proxied CNAME `www → homeofed.com` and add
the Cloudflare Redirect Rule template **"Redirect from WWW to Root"**
(Rules → Redirect Rules). The redirect happens at Cloudflare's edge, so
`www` traffic never reaches Fly. (Without the rule, `www` returns a 525 under
Full (strict) — Cloudflare can't handshake with an origin that has no cert
for it.)

## G4.5 — Verify end-to-end

```bash
curl -fsS https://homeofed.com/health          # deep health through Cloudflare → Fly → Postgres
curl -fsSI https://homeofed.com | head -5      # 200, served over TLS
open https://homeofed.com                      # the hub landing page
```

Done — the foundation is live. Adding the next app = the checklist in root
`CLAUDE.md` + repeating G4.1 (`fly apps create <flyapp>`, then — **DB-backed apps
only** — `fly postgres attach hoe-pg --app <flyapp> --database-name <name>`), the
CNAME step of G4.4 with `<name>` instead of `@`, and `fly certs add
<name>.homeofed.com`. A stateless app ([ADR 0008](../adr/0008-apps-without-a-database.md))
omits the `fly postgres attach` step.

## G4.6 — boids (DB-less app, go-live)

boids (`apps/boids`, [0002-boids-implementation-plan.md](../plans/0002-boids-implementation-plan.md))
has no database — see [ADR 0006](../adr/0006-db-less-apps.md) — so this is
shorter than G4.1–G4.4: no `fly postgres attach`, no release_command.

```bash
fly apps create hoe-boids          # must match apps/boids/fly.toml
# NO fly postgres attach — ADR 0006
fly certs add boids.homeofed.com --app hoe-boids   # after first deploy
```

Cloudflare: proxied CNAME `boids → hoe-boids.fly.dev` (Full-strict TLS is
zone-wide already, set in G4.4); grey-cloud any ACME validation record
`fly certs add` asks for.

> **⚠ Deploy-token gotcha:** the existing `FLY_API_TOKEN` GitHub secret (G4.2)
> was minted with `fly tokens create deploy --app hoe-hub` — it is **scoped to
> hoe-hub** and cannot deploy `hoe-boids`. Before deploying boids, mint a
> token that covers both apps (e.g. an org-scoped deploy token) and replace
> the repo secret, or the `deploy-boids` job will fail auth.

Verify:

```bash
curl -fsS https://hoe-boids.fly.dev/health           # → {"ok":true} — in-memory ping, not a DB round-trip
curl -fsS https://boids.homeofed.com/health          # same, through Cloudflare
open  https://boids.homeofed.com                     # push some sliders
```

## G4.7 — fridge (go-live A: stateless)

fridge (`apps/fridge`, [0003-fridge-implementation-plan.md](../plans/0003-fridge-implementation-plan.md))
ships in two go-lives. **Go-live A** is the stateless app (local saves only —
[ADR 0008](../adr/0008-apps-without-a-database.md)): no `fly postgres attach`,
no release_command. **Go-live B** (G4.8) adds the shared-boards database in
phase 3 of the plan.

```bash
fly apps create hoe-fridge         # must match apps/fridge/fly.toml
# NO fly postgres attach yet — that is go-live B
fly certs add fridge.homeofed.com --app hoe-fridge   # after first deploy
```

Cloudflare: proxied CNAME `fridge → hoe-fridge.fly.dev` (Full-strict TLS is
zone-wide already); grey-cloud any ACME validation record `fly certs add`
asks for.

> **⚠ Deploy-token gotcha (same as boids):** `FLY_API_TOKEN` must cover
> `hoe-fridge`. If the org-scoped token from the boids go-live is in place,
> nothing to do; an app-scoped token will fail the `deploy-fridge` job.

Verify:

```bash
curl -fsS https://hoe-fridge.fly.dev/health          # → {"ok":true} — process liveness, no DB yet
curl -fsS https://fridge.homeofed.com/health         # same, through Cloudflare
open  https://fridge.homeofed.com                    # drag some magnets; save a fridge; reload
```

## G4.8 — fridge (go-live B: shared boards database)

Run only after phase 3 of the plan (DB wiring + share handlers) is merged.

```bash
fly postgres attach hoe-pg --app hoe-fridge --database-name fridge
```

Then merge/deploy: the `release_command` added in phase 3 runs the
migrations. Verify:

```bash
curl -fsS https://fridge.homeofed.com/health         # now a DEEP check — round-trips the Store
# share a board from one browser, open the /b/<id> link in another
```

## G4.9 — scripted go-live (`scripts/go-live.sh`)

Everything above from "create the app" onward is now one idempotent script
([ADR 0011](../adr/0011-scripted-go-live.md)) — still **human-run**, under
your own credentials:

```bash
fly auth login                                     # once
export CLOUDFLARE_API_TOKEN=...                    # Zone.DNS:Edit on homeofed.com
                                                   # (dashboard → My Profile → API Tokens
                                                   #  → Create Token → "Edit zone DNS")

scripts/go-live.sh <app>            # stateless app (ADR 0008)
scripts/go-live.sh <app> --db       # DB-backed: also attaches hoe-pg
scripts/go-live.sh <app> --dry-run  # print every mutating command, run nothing
```

It creates the fly app, deploys, adds the CNAME **grey-cloud** (so the Fly
cert validates), waits for Issued, flips the record to proxied, and runs the
health/index verification. Safe to re-run after a partial failure — every
step skips what already exists. G4.1–G4.8 above remain the manual reference
for what the script does.

## G4.10 — karesansui (go-live, DB-less)

karesansui (`apps/karesansui`, "Zen Gear Garden" —
[0006-karesansui-implementation-plan.md](../plans/0006-karesansui-implementation-plan.md))
is a stateless app: presets live in the browser's localStorage
([ADR 0008](../adr/0008-apps-without-a-database.md)), so — like boids — there is
no `fly postgres attach`, no `DATABASE_URL`, and no `release_command`. Its
`/health` is an in-memory liveness ping.

### The one-command path (recommended)

```bash
fly auth login                                     # once, if not already
export CLOUDFLARE_API_TOKEN=...                    # Zone.DNS:Edit on homeofed.com
scripts/go-live.sh karesansui                      # NO --db (stateless)
# scripts/go-live.sh karesansui --dry-run          # preview every command first
```

That creates `hoe-karesansui`, deploys it, adds the `karesansui` CNAME
grey-cloud, waits for the Fly cert to be Issued, flips the record to proxied,
and verifies `/health` + the SPA index. Idempotent — safe to re-run.

> **⚠ Deploy-token gotcha (same as boids/fridge):** the GitHub
> `FLY_API_TOKEN` secret must cover `hoe-karesansui`. The original token was
> minted `--app hoe-hub` (hub-scoped). If you have not already replaced it with
> an org-scoped deploy token during a previous app's go-live, do so now, or the
> `deploy-karesansui` CI job will fail auth:
>
> ```bash
> fly tokens create org --name hoe-deploy |
>   gh secret set FLY_API_TOKEN --repo Ed-Barnes937/HomeOfEd
> ```
>
> (The script's own `fly deploy` uses your logged-in `flyctl` session and is
> unaffected — this only bites the CI-driven deploy on future merges to `main`.)

### Manual fallback (what the script does)

```bash
fly apps create hoe-karesansui                     # must match apps/karesansui/fly.toml
# NO fly postgres attach — stateless (ADR 0008)
fly deploy --config apps/karesansui/fly.toml --remote-only   # from the repo root
fly certs add karesansui.homeofed.com --app hoe-karesansui   # after the first deploy
```

Cloudflare (dashboard): proxied CNAME `karesansui → hoe-karesansui.fly.dev`
(Full-strict TLS is zone-wide already, set in G4.4). Grey-cloud any ACME
validation record `fly certs add` prints, then:

```bash
fly certs check karesansui.homeofed.com --app hoe-karesansui   # wait for Issued
```

### Verify end-to-end

```bash
curl -fsS https://hoe-karesansui.fly.dev/health    # → {"ok":true} — in-memory ping, no DB round-trip
curl -fsS https://karesansui.homeofed.com/health   # same, through Cloudflare
open  https://karesansui.homeofed.com              # build a gear train, turn the crank, Save a garden, reload
```

The Save/reload check exercises localStorage persistence — there is no
server-side state to verify.
