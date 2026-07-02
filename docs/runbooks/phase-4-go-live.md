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
# A deploy-scoped token (preferred over a personal token):
fly tokens create deploy --app hoe-hub

# Add it to the repo so .github/workflows/deploy.yml comes alive:
gh secret set FLY_API_TOKEN --repo Ed-Barnes937/HomeOfEd
# (paste the token when prompted — including the "FlyV1 " prefix)
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

1. **DNS → Records → Add record**: type `CNAME`, name `@` (the apex),
   target `hoe-hub.fly.dev`, **Proxied** (orange cloud). Cloudflare flattens
   the apex CNAME automatically.
2. **SSL/TLS → Overview**: set encryption mode to **Full (strict)**.

Then issue the Fly certificate so Fly terminates TLS for the custom domain:

```bash
fly certs add homeofed.com --app hoe-hub
fly certs check homeofed.com --app hoe-hub   # wait until it shows Issued
```

(`fly certs add` prints an ACME validation record if it needs one — add it in
Cloudflare DNS as instructed, **DNS-only/grey cloud** for the validation
record.)

## G4.5 — Verify end-to-end

```bash
curl -fsS https://homeofed.com/health          # deep health through Cloudflare → Fly → Postgres
curl -fsSI https://homeofed.com | head -5      # 200, served over TLS
open https://homeofed.com                      # the hub landing page
```

Done — the foundation is live. Adding the next app = the checklist in root
`CLAUDE.md` + repeating G4.1 (`fly apps create <flyapp>` then
`fly postgres attach hoe-pg --app <flyapp> --database-name <name>`), the CNAME
step of G4.4 with `<name>` instead of `@`, and `fly certs add
<name>.homeofed.com`.
