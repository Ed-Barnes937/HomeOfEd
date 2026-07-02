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

Done — the foundation is live (2026-07-02). Adding the next app = the
checklist in root `CLAUDE.md` + repeating G4.1 (`fly apps create <flyapp>`
then `fly postgres attach hoe-pg --app <flyapp> --database-name <name>`), the
CNAME step of G4.4 with `<name>` instead of `@`, and `fly certs add
<name>.homeofed.com` — proxied subdomains need their own validation records
too (`fly certs setup <name>.homeofed.com` prints them).
