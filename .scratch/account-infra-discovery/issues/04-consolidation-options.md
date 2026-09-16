# 04 - Options paper: machine-per-app vs consolidation

**Status:** resolved
**Type:** research
**Map:** ../map.md
Blocked by: 01, 02

## Question

Given the cost baseline (ticket 02) and the current-state inventory (ticket
01), lay out the consolidation options **with real numbers** so Ed can decide.
Reality check: near-zero users now, ceiling ~100. If ticket 02 found the
question mostly moot, say so up front and keep the paper short.

1. Status quo (baseline): every app its own Fly app/machine, scale-to-zero,
   logical DB per app in shared `hoe-pg`.
2. One host Fly app serving every subdomain (Caddy/nginx or a Node router in
   front of per-app processes), single machine, scale-to-zero as a unit. Repo
   stays exactly as is - leaf apps, per-app Dockerfiles kept as the escape
   hatch. Isolation becomes "a day's work to re-extract" instead of "already
   extracted".
3. Middle ground: consolidate only the backends-with-DBs onto one machine;
   static-only apps stay on Fly's free-ish static serving or the hub.

Trade-offs to be honest about, per option:

- Blast radius (one bad deploy downs every app) and deploy coupling (CI
  currently deploys per-app on affected paths).
- The release_command migration story across apps sharing a machine, and the
  known Fly release-machine flake.
- How each option would host a potential central identity and/or save-data
  service (ticket 03's options) - a consolidation that ignores the account
  layer will be redone, so state the interaction explicitly.

Deliverable: the options paper with a recommendation appended as the Answer,
ending with the decisions Ed must make. Analysis only - no infra mutation.

## Answer

### Verdict up front: the question is mostly moot

Ticket 02 settled it: HomeOfEd costs ~$13.30/mo, and the shape Ed suspected of
overengineering is not where the money is. Scale-to-zero already works - the 16
stopped machines cost ~$1.20/mo total (vs ~$53/mo if they ran), and `hoe-pg` is
a single 256MB node at ~$2.17/mo, not a dominant fixed cost. What dominates
(~75%, $9.96/mo) is the three ALWAYS-ON machines: hoe-hub, hoe-sprout web, and
hoe-sprout-pipeline. **Consolidating apps - the question this ticket was
opened to answer - can only ever reclaim the ~$1.20/mo stopped-rootfs line.**
So the paper is short: the three consolidation options get their real numbers,
then the levers that actually move the bill are treated as first-class options.

### The consolidation options (the original question)

**Option 1 - Status quo.** Every app its own Fly app, scale-to-zero, logical DB
per app in shared `hoe-pg`. Cost: ~$13.30/mo. Work: zero. Risk: zero. Keeps
everything the current shape buys: per-app affected-path deploys (one CI job
per app in `deploy.yml`, gated on `turbo ls --affected`), per-app blast radius
(a bad deploy downs one app), per-app `release_command` (a release-machine
flake aborts one app's deploy, retried later, everything else unaffected), and
isolation that is "already extracted" - any app can move to its own domain, be
sold, or be killed by deleting one Fly app.

**Option 2 - One host Fly app for every subdomain.** A router (Caddy/nginx or
Node) in front of per-app processes on one machine, scaling to zero as a unit.
Saves ~$1.20/mo (the stopped rootfs), assuming the always-on trio stays as it
is; if hub rides along, it inherits whatever always-on decision the host
machine makes. Costs: a real engineering project (host image building ten
apps, router config, per-process supervision, port allocation, memory
budgeting on one 512MB-or-bigger VM - which may itself need to be larger,
eating the saving); the CI moves from ten independent affected-gated jobs to
one all-or-nothing deploy, so any change to any app redeploys and risks every
app; blast radius becomes total; the `release_command` becomes one script
running four apps' migration journals in sequence, and the known
release-machine flake ("machine not found", deploy aborts) now blocks the
whole estate instead of one app; a wake for any subdomain boots everything.
Isolation degrades from "already extracted" to "a day's work to re-extract".
That is days of work and a permanent operational downgrade to save roughly the
price of a quarter of a coffee per month.

**Option 3 - Middle ground: consolidate only the backends-with-DBs.** hub,
fridge, wotd (and in principle sprout, though its geo boundary, secrets, and
worker process make it a poor co-tenant) share one machine; the five stateless
apps stay put. Saves less than option 2 - roughly the stopped rootfs of the
consolidated apps, well under $1/mo - while taking on the same class of
problems (shared deploy unit, sequenced migrations across three journals, one
flake blocks three apps) for the apps where a bad deploy matters most, the
ones with data. Worst ratio of the three.

Blunt summary: options 2 and 3 are ~$1.20/mo and ~$0.50/mo of savings
respectively, priced in days of work plus permanent coupling. Neither is worth
doing at any plausible traffic level below the ~100-user ceiling.

### The real levers (where the money actually is)

**Lever A - Let hoe-hub scale to zero.** Set `min_machines_running = 0` +
auto-stop, like the seven quiet apps. Saves ~$3.32/mo minus ~$0.08 of extra
stopped rootfs, net ~$3.24/mo (~24% of the bill). Cost: the apex domain
`homeofed.com` takes a cold start on first visit after idle - a Fly machine
start plus Node boot, typically a second or two behind Cloudflare. The apex is
the front door, so this is the one place cold-start UX is a real (if small)
consideration. One-line fly.toml change, human-gated deploy. This is the
cheapest real money on the table.

**Lever B - Fold hoe-sprout-pipeline into the sprout app as a second process.**
Mechanically easy (ADR 0001 §3's "multi-process, same Fly app" shape, which
sprout already uses for its worker) and saves ~$3.32/mo. But ADR 0013 is
explicit about why it is a separate app: **secret and attack-surface
isolation** - `OPENROUTER_API_KEY` lives only on `hoe-sprout-pipeline`, never
on the public web tier, and the model-facing surface is not publicly routed at
all (no public IP, `.flycast` only, `x-pipeline-key` guard). Folding it into
the sprout Fly app puts the LLM key and the model-facing code on the same
machines and in the same image as the public, child-facing web app. Fly
processes in one app share the app's secrets. This lever trades a deliberate,
documented security boundary on the child-safety app for $3.32/mo. Not
recommended; if $3.32 ever matters, revisit ADR 0013 on its merits first, not
as a cost measure. (hoe-sprout web's own `min=1` is the third always-on
machine; it is presumably deliberate - chat for the pilot family should not
cold-start mid-conversation - and is a sprout product call, not an infra one.)

**Lever C - Accept ~$13/mo.** The bill is already small, scale-to-zero is
already doing the heavy lifting, and every dollar left is paying for something
specific: instant apex, instant sprout chat, and an isolated LLM key. Doing
nothing is a defensible answer.

### The account-layer interaction (ticket 03, options by shape)

Ticket 03's options all reduce to: possibly a central identity service,
possibly a central save-data service, each needing a DB. Priced against the
consolidation options:

- A new small service is one more scale-to-zero Fly app at ~$0.08/mo stopped,
  or ~$3.32/mo if it must be always-on (it should not need to be - token
  issuance and save sync are request-driven and wake-on-request is fine; and
  sprout's child token proves verify-without-a-round-trip, so other apps can
  validate tokens while the identity service sleeps).
- Its DB is one more logical database in `hoe-pg`: ~$0 marginal (same 256MB
  node, same 1GB volume until data says otherwise).

How each option hosts it:

- **Option 1**: as its own app, exactly like every other app - the how-to
  checklist plus a logical DB. ~$0.08/mo. Nothing about the estate changes.
- **Option 2**: as one more process behind the shared router - but then the
  identity secrets (token-signing keys) live in the shared host app's secret
  set alongside every co-tenant, and any app's deploy redeploys the identity
  service. The natural move under option 2 would be to keep identity OUT of
  the host app as a separate Fly app anyway - which concedes the model.
- **Option 3**: joins the DB-backed machine, same coupling story as option 2
  for the estate's most sensitive service.

Does any consolidation choice get redone under any account-layer option? No -
in all combinations the account layer is additive (a new app + a new logical
DB + `AuthProvider` wiring through the existing `ctx.auth` seam). The risk
runs the other way: options 2/3 would make the account layer's natural home
(an isolated small app) an exception to the consolidation, or force it into a
shared container it should not share. Option 1 is the only shape the account
layer slots into without argument.

### Recommendation

**Take Option 1 (status quo) and close the consolidation question.** The
architecture is not overengineered on cost - it costs ~$1.20/mo more than
maximal consolidation and buys per-app deploys, per-app blast radius, and
already-extracted isolation. Separately, **take Lever A** (hub scales to zero,
net ~$3.24/mo, one fly.toml line, if the apex cold start is acceptable),
**decline Lever B** (it undoes ADR 0013's security boundary for $3.32/mo), and
otherwise **accept the ~$13/mo bill** (Lever C). When the account layer
arrives, host it as its own scale-to-zero app with a logical DB in `hoe-pg`
(~$0.08/mo marginal) - no consolidation decision blocks or is blocked by it.

## Decisions for Ed

1. **Consolidation (options 1-3):** keep the status quo - options 2 and 3 save
   ~$1.20/mo and ~$0.50/mo for days of work and permanent deploy coupling.
   Recommended: Option 1, question closed.
2. **hoe-hub `min_machines_running` 1 -> 0 (Lever A):** saves ~$3.24/mo net;
   cost is a 1-2s cold start on the apex after idle. Recommended: yes, unless
   the apex-first-impression cold start bothers you; human-gated fly.toml
   change + deploy.
3. **Fold sprout-pipeline into sprout (Lever B):** saves ~$3.32/mo but puts
   the LLM key and model-facing surface on the public child-facing web app,
   reversing ADR 0013. Recommended: no.
4. **Accept ~$13/mo as the baseline (Lever C):** what remains after decision 2
   is paying for sprout chat latency and key isolation. Recommended: yes.
5. **Account-layer hosting shape (feeds ticket 03/05):** any central
   identity/save service is its own scale-to-zero Fly app (~$0.08/mo stopped)
   with a logical DB in `hoe-pg` (~$0 marginal). Recommended: agree this now
   so ticket 03 can assume it; no consolidation redo under any of its options.
