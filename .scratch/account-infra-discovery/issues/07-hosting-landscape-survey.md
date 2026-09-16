# 07 - Research: cheap deployment landscape for this estate's shape

**Status:** resolved
**Type:** research
**Map:** ../map.md

## Question

Beyond Fly, what would an estate of this shape cost - in money and in ops -
elsewhere? The shape: ~10 dockerised apps, mostly SPAs with small Node/tRPC
backends, a homepage (hub) acting as the gate/launcher, low DB and backend
usage (Postgres, a few logical DBs), a wanted account layer (identity + save
blobs), future monetisation (payments someday), and sprout as the bigger
SaaS-like app (always-on-ish web, private LLM pipeline worker with secret
isolation, stricter kids-data posture).

Survey with real 2026 prices (cite sources):

- **Stay on Fly** (baseline - numbers from tickets 02/06, don't redo).
- **VPS** (Hetzner, DigitalOcean, etc.) + Docker Compose, or a self-hosted
  PaaS (Coolify, Dokploy): monthly price for a machine that fits the estate,
  the ops burden being taken on (OS patching, Postgres backups, TLS, uptime),
  and what happens to the per-app affected-path CI deploys.
- **PaaS per-service** (Render, Railway, DO App Platform): at ~10 services
  does per-service pricing kill these? Say so with numbers, don't hedge.
- **Hybrid**: static-built SPAs on free static hosting (e.g. Cloudflare
  Pages) + only the real backends (hub? wotd/fridge/sprout + account service)
  on Fly or a VPS; note what it does to the single-container-per-app model
  and the tRPC backends the "static" apps still carry.
- Anything genuinely purpose-fit (Cloudflare Workers + D1?) - with the
  Node/Fastify/tRPC/Postgres porting cost stated honestly.

Per option: estimated monthly cost at ~0 and ~100 users, migration effort,
ongoing ops burden, fit with repo constraints (human-gated infra, Docker
per-app images, Postgres, Cloudflare in front), and where sprout's needs
(always-on chat, secret isolation, kids' data in a known jurisdiction) land.

End with a shortlist worth Ed's time and what each would change, if anything,
about tickets 03/04's recommendations. Analysis only - no infra mutation, no
signups.

## Answer

Survey date 2026-09-08. All prices retrieved 2026-09-08 from the cited pages
unless noted. Baseline facts reused, not redone: Fly bill ~$13.30/mo, dominated
(~75%) by the always-on trio (hub, sprout web, sprout-pipeline); the hoe-pg
"cluster" is one shared-cpu 256MB machine + 1GB volume at $2.17/mo (ticket 02).
Estate shape from ticket 01: 10 dockerised apps (5 effectively static, 4
DB-backed, 1 private worker), per-app Dockerfiles built from the monorepo,
Cloudflare proxied in front, per-app affected-path deploy jobs in
`.github/workflows/deploy.yml` (turbo-affected check -> `flyctl deploy` ->
smoke; everything gated on secrets/vars a human sets, matching root CLAUDE.md's
"Infrastructure is human-gated").

"~100 users" is read as ~100 casual monthly users of kid apps plus a handful of
sprout families: low tens of thousands of requests/mo, single-digit GB egress.
No option's price moves much between 0 and 100 users at this traffic; the
numbers below say so per option rather than hedging.

### Option A - Stay on Fly (baseline)

- **Cost at ~0 users:** ~$13.30/mo (ticket 02). **At ~100 users:** ~$14-18/mo:
  the always-on trio is unchanged; scale-to-zero apps accrue a few running
  hours/day at $3.32/mo-equivalent rates plus pennies of egress ($0.02/GB,
  https://fly.io/docs/about/pricing/, retrieved 2026-09-06 in ticket 02).
- **Migration effort:** none.
- **Ops burden:** near-zero for hosts (Fly does host maintenance, kernel
  patching, and machine migration invisibly). The honest exception: `hoe-pg` is
  a single postgres-flex node, which Fly explicitly does not manage - backups
  are daily volume snapshots and a restore has never been rehearsed. That is an
  ops debt this option already carries, not one it avoids.
- **Fit with repo constraints:** perfect by construction - Docker per-app,
  fly.toml per app, human-gated deploys, Cloudflare CNAMEs to `*.fly.dev`.
- **Sprout:** current shape is the reference: always-on web (min=1), pipeline as
  a separate private Fly app with its own secrets (real isolation boundary),
  data in `lhr` (UK jurisdiction, ideal for the kids-data posture).
- **Effect on tickets 03/04:** none. Ticket 04's recommendation (status quo +
  consider hub scale-to-zero) and ticket 03's central-identity-as-a-package
  direction both assume this substrate and stand as written.

### Option B - VPS + Docker Compose, or self-hosted PaaS (Coolify/Dokploy)

**Machines that fit the estate** (10 small Node containers + Postgres + reverse
proxy comfortably need ~4-8GB RAM):

| Provider | Plan | Specs | Price | Source (retrieved 2026-09-08) |
|---|---|---|---|---|
| Hetzner | CX23 | 2 vCPU / 4GB / 40GB NVMe / 20TB traffic | EUR 5.49/mo + EUR ~0.50 IPv4, excl VAT | https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ (prices effective 15 Jun 2026); tiers/traffic https://www.hetzner.com/cloud/cost-optimized/ |
| Hetzner | CX33 | 4 vCPU / 8GB / 80GB / 20TB | EUR 8.49/mo + IPv4, excl VAT | same |
| Hetzner | CAX11 (ARM) | 2 vCPU / 4GB / 40GB | EUR 5.99/mo | same |
| DigitalOcean | Basic 2GB/2vCPU | 2GB / 60GB / 3TB | $18/mo | https://www.digitalocean.com/pricing/droplets |
| DigitalOcean | Basic 4GB/2vCPU | 4GB / 80GB / 4TB | $24/mo (+20-30% for provider backups) | same |

Coolify: self-hosted is free/open-source (cloud control plane $5/mo base,
https://coolify.io/pricing). Dokploy: OSS self-hosted; cloud $4.50/mo/server
(https://dokploy.com/pricing). Either runs on the same VPS at no extra cost.

- **Cost at ~0 users:** Hetzner CX33 route: ~EUR 9/mo excl VAT (~EUR 10.8 /
  ~£9.3 with UK consumer VAT), plus ~EUR 1/mo for offsite backup storage.
  Roughly $11-12/mo all-in - only ~$2-3/mo below Fly today. DO London: $24-29/mo,
  i.e. MORE than Fly. **At ~100 users:** identical (flat-rate box, 20TB
  included traffic).
- **Migration effort:** days, not hours. Push images to GHCR from the existing
  per-app jobs (the turbo-affected gating survives verbatim; swap `flyctl
  deploy` for `docker build/push` + `ssh docker compose up -d <svc>` + the same
  smoke curl). `compose.yml` already exists as the docker-stack, so the shape is
  proven. Add Caddy (or keep Cloudflare proxied with an origin cert) for TLS.
  Re-point 10 Cloudflare CNAMEs. Migrate 4 Postgres databases via dump/restore.
  Coolify replaces the ssh/compose glue with git-push deploys, but its
  auto-deploy webhooks bypass the affected-path + human-gate model unless CI
  drives Coolify's API instead - the human-gated posture is preservable either
  way, it just has to be rebuilt deliberately.
- **Ops burden (the real price, itemised):** this option adopts everything Fly
  currently does invisibly: OS patching (`unattended-upgrades` + periodic
  reboots for kernel updates), Docker engine updates, disk-full and log
  rotation, ssh hardening, host monitoring/uptime alerting (external probe like
  UptimeRobot at minimum), TLS renewal (Caddy or Cloudflare origin certs),
  and above all **Postgres**: cron `pg_dump` per database to offsite object
  storage (Hetzner Storage Box / Backblaze B2, ~EUR 1/mo) plus a *tested,
  rehearsed restore* - an untested backup of kids' chat data is not a backup.
  Fly host failures currently self-heal by machine migration; on a single VPS a
  dead host is Ed's Saturday. For one parent-dev this is the whole argument.
- **Fit with repo constraints:** good - per-app Docker images and Postgres carry
  over unchanged, Cloudflare stays in front, compose.yml already models it.
  Human-gating becomes "the ssh key is the gate".
- **Sprout:** always-on is free on a flat-rate box. Secret isolation weakens:
  the pipeline's OPENROUTER key becomes a per-container env on the same host -
  container boundaries only, one box compromise exposes everything, vs Fly's
  separate-app boundary. Jurisdiction: Hetzner has NO UK region - Falkenstein/
  Nuremberg (DE) or Helsinki (FI), i.e. EU GDPR territory; UK GDPR permits
  EU-hosted data (adequacy), but the stated posture is "kids' data in a known
  jurisdiction" and this changes it from UK to Germany/Finland. DO London keeps
  UK jurisdiction at roughly double Hetzner's price.
- **Effect on tickets 03/04:** ticket 04's consolidation question evaporates
  (app count is free on one box) but its recommendation was already "status
  quo", so nothing to revisit. Ticket 03 is unaffected: a central identity
  service is app-layer, indifferent to the box under it.

### Option C - Per-service PaaS (Render, Railway, DO App Platform)

**Render** (https://render.com/pricing; free-tier behavior
https://render.com/docs/free; regions https://render.com/docs/regions; all
retrieved 2026-09-08): Hobby workspace $0; each paid web service Starter =
$7/mo (0.5 CPU/512MB); free services spin down after 15 min idle, ~1 min cold
start, 750 shared free instance-hours/workspace/mo; free Postgres EXPIRES after
30 days; paid Postgres from $6/mo (basic-256mb); EU region = Frankfurt.
At the estate's shape: sprout web + sprout-pipeline (private service) + hub
always-on = 3 x $7, one paid Postgres $6, seven kid apps on free with cold
starts = **~$27/mo minimum; all-paid is 10 x $7 + $6 = $76/mo**. So yes: at ~10
services, per-service pricing kills it - you pay 2x Fly for a worse version of
the current setup (cold starts on kid apps or $76/mo), and 4 logical databases
must either squeeze into one $6 instance or multiply.

**Railway** (https://railway.com/pricing and
https://docs.railway.com/reference/pricing/plans, retrieved 2026-09-08): Hobby
$5/mo including $5 usage; usage rates $10/GB-RAM/mo, $20/vCPU/mo, volumes
$0.15/GB/mo, egress $0.05/GB; serverless app-sleeping exists (sleep after ~5-10
min idle, wake on request - https://docs.railway.com/reference/app-sleeping);
EU region = Amsterdam (https://docs.railway.com/reference/regions). Estimated:
always-on sprout web + pipeline + hub at ~0.3-0.5GB RAM each mostly idle
(~$10-15), Postgres service ~$5, seven sleeping apps ~$0 = **~$15-25/mo at 0
users, similar at 100** (usage-billed, but this traffic is noise). Railway is
the only per-service PaaS whose model (usage + sleep) doesn't punish app count -
but the bill is an estimate, not a flat rate, and it still lands above Fly.

**DO App Platform** (https://www.digitalocean.com/pricing/app-platform,
retrieved 2026-09-08): 3 free static-site apps, then $3/mo each; containers
from $5/mo (512MB, single instance); dev Postgres $7/mo; real managed Postgres
from $15.15/mo (https://www.digitalocean.com/pricing/managed-databases). Ten
containers = $50/mo before a database: **~$57-65/mo. Dead on arrival at this
app count.**

- **Migration effort (all three):** days-week - per-service creation, env vars,
  Docker or buildpack config, Postgres dump/restore, 10 CNAME changes. The
  affected-path CI model is replaced by each platform's path-filtered
  auto-deploys, or preserved by driving their CLIs from the existing jobs;
  auto-deploy-on-push defaults would need disabling to keep the human gate.
- **Ops burden:** low (managed hosts, managed Postgres on Render/DO).
- **Sprout:** Render private services / Railway private networking give the
  pipeline a real isolation boundary with per-service secrets - comparable to
  Fly. Jurisdiction: Frankfurt (Render) / Amsterdam (Railway) - EU, not UK.
- **Effect on tickets 03/04:** none structurally; both papers' recommendations
  would port, but the consolidation pressure ticket 04 dismissed on Fly would
  RETURN on Render/DO because every extra service is $5-7/mo there.

### Option D - Hybrid: static SPAs on Cloudflare Pages + consolidated backends

Cloudflare Pages free tier (https://developers.cloudflare.com/pages/platform/limits/,
retrieved 2026-09-08): 500 builds/mo, 100 projects, 20k files/site, 25MiB/file,
100 custom domains/project, no request/bandwidth caps for static assets; Pages
Functions bill as Workers (free: 100k req/day -
https://developers.cloudflare.com/workers/platform/pricing/).

The five "effectively static" apps (boids, boop, espy, karesansui, silt) carry
only vestigial tRPC backends (health + the starter greeting handler; all
per-user data is localStorage - ticket 01). They could build to static assets
on Pages for $0. What remains on Fly: hub, wotd, fridge, sprout web + pipeline,
hoe-pg.

- **Cost at ~0 users:** ~$12.55/mo (always-on trio $9.96 + hoe-pg $2.17 + ~6
  stopped machines' rootfs ~$0.45). **Saving vs baseline: ~$0.75/mo.** At ~100
  users: ~$13, since Pages absorbs the static traffic free.
- **Migration effort:** weeks of real work for under a dollar a month: strip
  five apps' servers, Dockerfiles, fly.tomls, and compose services; add a Pages
  deploy path to CI; rework their iwft/simulator harnesses (backendSimulator
  assumes a tRPC backend exists); five Cloudflare DNS changes.
- **Ops burden:** Fly's, plus a second deploy pipeline and a second hosting
  mental model.
- **Fit with repo constraints:** poor. It breaks the single-container-per-app
  model, forks the app template in two, and - decisive given ticket 03 - removes
  the server-side `ctx.auth` seam from exactly the apps whose localStorage saves
  an account layer would sync. The account layer would put the backends back.
- **Sprout:** unchanged (stays on Fly).
- **Effect on tickets 03/04:** actively hostile to ticket 03's direction
  (central identity consumed via each app's backend seam); ticket 04 already
  found consolidation reclaims pennies, and this is the same pennies for more
  work.

### Option E - Purpose-fit rebuild: Cloudflare Workers + D1

Pricing (https://developers.cloudflare.com/workers/platform/pricing/, retrieved
2026-09-08): free plan 100k requests/day, 10ms CPU/invocation, D1 free 5M rows
read/day + 5GB; paid plan $5/mo flat including 10M requests + 30M CPU-ms/mo,
D1 25B reads + 50M writes/mo, KV, Durable Objects. Static assets free.

- **Cost:** **$0-5/mo at both 0 and 100 users.** The cheapest steady state in
  this survey, by far, and it never grows at this scale.
- **Migration effort - stated honestly:** a rewrite, not a migration.
  Fastify/`createAppServer` does not run on Workers (tRPC does, via fetch
  adapters, but the whole backend-kit prod factory, DI wiring, and simulator
  harness are Node-shaped); Postgres->D1 means porting four Drizzle schemas to
  SQLite dialect and losing the PGlite<->Postgres driver-swap trick that the
  entire test/dev story rests on; sprout's Better Auth + node:crypto scrypt +
  HMAC child tokens need Web Crypto rework; per-app Dockerfiles, compose.yml,
  fly.tomls, and the deploy workflow all become dead weight. Weeks-to-months of
  one parent-dev's evenings, touching every layer the ADRs froze.
- **Ops burden:** near-zero afterwards.
- **Fit with repo constraints:** worst of any option - it invalidates Docker
  per-app, Postgres, the simulator, and most of ADR 0001's foundation.
- **Sprout:** per-Worker secrets give clean key isolation; wall-clock LLM calls
  are fine (billing is CPU-ms, not duration). The blocker is jurisdiction: D1
  offers location hints, not guarantees - strict EU/UK data residency needs
  Cloudflare's enterprise Data Localization Suite. For kids' chat transcripts,
  "probably nearby" is not "a known jurisdiction".
- **Effect on tickets 03/04:** invalidates the assumptions of both; they would
  need rewriting from scratch. That alone prices this option out.

### Comparison table

| Option | $/mo @ ~0 users | $/mo @ ~100 users | Migration effort | Ops burden | Biggest risk |
|---|---|---|---|---|---|
| A. Stay on Fly | ~$13.30 | ~$14-18 | none | near-zero (host ops invisible; hoe-pg backups/restore still Ed's) | single-node Postgres with unrehearsed restore; Fly price/platform drift |
| B1. Hetzner CX33 + Compose/Coolify | ~$11-12 all-in (EUR 9 + VAT + backup storage) | same (flat) | days (GHCR + ssh deploy, PG dump/restore, 10 DNS changes) | highest: OS+Docker patching, PG backup + rehearsed restore, TLS, monitoring, dead-host recovery | one box = one blast radius for everything incl kids' data; ops fall entirely on one parent-dev |
| B2. DO London droplet (4GB) | ~$24-29 | same | as B1 | as B1 | costs more than Fly for the same adopted burden |
| C1. Render | ~$27 (3 paid + PG; 7 apps cold-starting) or $76 all-paid | same | days-week | low | per-service $7 x app count; free tier = 1-min cold starts on kid apps + 30-day PG expiry |
| C2. Railway | ~$15-25 (usage estimate) | ~$15-25 | days-week | low | usage-billed estimate, not a flat rate; still above Fly |
| C3. DO App Platform | ~$57-65 | same | days-week | low | $5/container x 10 + $15 managed PG - eliminated on price |
| D. Hybrid Pages + Fly | ~$12.55 | ~$13 | weeks | Fly's + second pipeline | weeks of work to save $0.75/mo and it amputates the `ctx.auth` seam ticket 03 needs |
| E. Workers + D1 | $0-5 | $5 | weeks-months (full backend rewrite) | near-zero after | rewrite invalidates the foundation ADRs; no firm EU/UK data residency for kids' data on D1 |

### Shortlist (what is worth Ed's time)

1. **Stay on Fly (A)** - the bill is ~$13/mo and already near this estate's
   floor; no alternative saves more than ~$2-8/mo without adopting real ops or
   rewrite risk, and it is the only option where tickets 03/04's
   recommendations stand untouched. One follow-up it *should* borrow from this
   survey: treat hoe-pg backup/restore rehearsal as the actual gap.
2. **Hetzner CX33 + Coolify, held as a documented exit plan, not executed (B1)**
   - the only option that undercuts Fly while keeping the repo's whole shape
   (Docker per-app, Postgres, compose.yml already proves it, affected-path CI
   ports cleanly). Worth one page in a runbook now so that if Fly's pricing or
   reliability degrades the move is a known quantity; not worth doing today for
   ~$2/mo against a large adopted ops burden and a UK->EU jurisdiction shift.
3. **Cloudflare Pages, for future genuinely-static toys only (D-lite)** - never
   as a migration of existing apps, but when a future app is truly client-only
   (no seam needed, no backend ever), Pages at $0 is the purpose-fit answer;
   that is a per-app choice at creation time, not an estate move.

Everything else is eliminated with numbers: Render/DO App Platform because
per-service pricing at 10 services is 2-5x Fly ($27-76/mo), Railway because
~$15-25 estimated still exceeds Fly with less predictability, full hybrid
because weeks of work buys $0.75/mo and fights ticket 03, Workers+D1 because a
foundation rewrite plus fuzzy kids-data residency cannot be justified to save
$8/mo at near-zero revenue.
