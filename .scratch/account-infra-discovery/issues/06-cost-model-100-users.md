# 06 - Cost model: growth to ~100 users across setups

**Status:** resolved
**Type:** research
**Map:** ../map.md
Blocked by: 02

## Question

Ticket 02 priced today's ~0-traffic reality, where scale-to-zero wins. Ed's
point: at ~100 users scale-to-zero presumably saves much less. Model how the
monthly Fly bill evolves from 0 to ~100 users across setups, parameterized by
realistic usage (kids' apps: minutes per day per user, mostly evenings and
weekends, London TZ concentration - overlapping sessions, not spread).

Setups to model:

1. Status quo: scale-to-zero per app, always-on trio (hub, sprout web,
   sprout-pipeline), hoe-pg.
2. Status quo + Lever A (hub scales to zero too).
3. VPS-esque on Fly: ONE always-on machine hosting every app behind a router,
   plus the single Postgres. This is consolidation option 2's shape - include
   it as a COST COLUMN ONLY: ticket 04's operational findings (blast radius,
   deploy coupling, release flake) stand and are not re-researched here. Size
   the machine honestly for ~10 Node processes + an account service at 100
   users (is 512MB plausible? 1GB? 2GB? price each plausible size).
4. Each of the above plus the account-layer service (both scale-to-zero and
   always-on variants) and its save data.

Key outputs:

- Crossover analysis: at what usage level (machine-awake hours/day) does
  status quo scale-to-zero stop beating one always-on machine? Fly bills
  per-second while started and machines auto-stop after idle, so express
  scenarios in awake-hours and show the sensitivity.
- Wake amplification: 100 users spread across 8 apps wake 8 machines; one
  host machine wakes once. Show how that changes the picture.
- hoe-pg sizing at 100 users: does 256MB/1GB hold with the account layer's
  SaveStore (silt's ~5MB/user ceiling implies ~500MB of blobs at 100 users)?
  Price the plausible next size up.
- Bandwidth sanity check at 100 users ($0.02/GB NA/EU).

Inputs: tickets 01/02/04 Answers (fleet shape, rates: $3.32/mo 512MB started,
$2.02/mo 256MB, $0.15/GB/mo rootfs+volumes). Web for pricing only - no fly
commands needed, no infra mutation.

## Answer

All rates below from https://fly.io/docs/about/pricing/ (retrieved 2026-09-08),
cross-checked against ticket 02's inventory: shared-cpu-1x started machines at
256MB = $2.02/mo, 512MB = $3.32/mo, 1GB = $5.92/mo, 2GB = $11.11/mo; stopped
rootfs and volumes $0.15/GB/mo; NA/EU egress $0.02/GB. Fly bills machines
per-second while started; auto-stop machines cost only their rootfs while
stopped. The auto-stop idle window is app-configurable (fly.toml
`auto_stop_machines` stop/suspend; the proxy sweeps for idle machines every few
minutes) - this model assumes an effective ~5 min idle tail after the last
request.

The one number everything hangs off: **a 512MB machine costs $3.32/30.4/24 =
$0.00455 per awake-hour, i.e. $0.138/mo per awake-hour-per-day.** (256MB:
$0.084; 1GB: $0.247; 2GB: $0.463.)

### 1. Usage model

- ~100 kid users, sessions of ~10-20 min/day (call it 15), so 100 x 15 min =
  **25 user-hours/day of actual play** at full scale (6.25 at 25 users).
- Concentrated UK evenings (~16:00-20:00 weekdays) plus weekend daytime: an
  effective activity window of **~5 h/day averaged over the week**. Sessions
  overlap; they do not spread around the clock.
- Kids split across the 8 leaf apps (boids, boop, espy, fridge, karesansui,
  silt, wotd, + hub as front door).

**Translation to machine-awake-hours/day:**

(a) **Per-app machines (status quo shape).** An app's machine is awake while
it has at least one live session plus the ~5 min idle tail. Wake
amplification works against this shape: 100 users across 8 apps wake 8
machines, and scattered arrivals inside the window mean each popular app's
machine rides the whole evening with short gaps. Estimate: at **25 users**,
arrivals are sparse - each leaf app awake **~1.5 h/day** (bursts + tails), so
7 leaf apps = **~10.5 machine-h/day** (hub is always-on in the status quo). At
**100 users**, each leaf app is awake for most of the window, **~4 h/day**, so
7 x 4 = **~28 machine-h/day** (with hub scale-to-zero it is 8 apps: add hub at
~4-5.5 h/day, since the apex sees nearly every session start).

(b) **One host machine.** Activity on ANY app keeps the single machine awake,
but one machine awake serves all: awake-hours = the union of all activity,
~**4 h/day at 25 users, ~5.5 h/day at 100** - roughly one app's worth, not
eight. (Setup 3 below is always-on anyway, so this matters mainly for the
wake-amplification comparison in section 3.)

### 2. Scenario table (monthly totals, USD)

Fixed pieces from ticket 02: always-on trio (hub + sprout web +
sprout-pipeline) = 3 x $3.32 = $9.96; duo without hub = $6.64; hoe-pg =
$2.02 + $0.15 = $2.17; stopped-machine rootfs ~= $1.20 (~$1.28 once hub also
stops). Variable pieces = machine-h/day x $0.138.

Worked examples: Setup 1 at 100 users = 9.96 + 2.17 + 1.20 + (28 x 0.138 =
3.87) = **$17.2**. Setup 2 at 100 = 6.64 + 2.17 + 1.28 + (33.5 x 0.138 =
4.62) = **$14.7**. Setup 3 (1GB) = 5.92 + 2.17 + ~0.15 rootfs = **$8.2** flat.

Account-layer add-ons (setup 4): a scale-to-zero account service is +$0.08
rootfs plus ~1-2 awake-h/day (+$0.14-0.28); always-on is +$3.32; SaveStore
storage lands in hoe-pg per section 4 (+$0.30 volume at 25 users, +$1.60 at
100 for 512MB node + 3GB volume).

| Setup | 0 users | 25 users | 100 users |
|---|---|---|---|
| 1. Status quo (s2z per app, always-on trio, hoe-pg) | $13.3 | $14.8 | $17.2 |
| 2. Status quo + Lever A (hub s2z too) | $10.1 | $12.1 | $14.7 |
| 3a. One always-on host machine, 1GB + hoe-pg | $8.2 | $8.2 | $8.2 |
| 3b. Same host at 2GB | $13.4 | $13.4 | $13.4 |
| 4a. Setup 1 + account svc (s2z) + SaveStore | $13.4 | $15.3 | $19.2 |
| 4b. Setup 2 + account svc (s2z) + SaveStore | $10.2 | $12.6 | $16.7 |
| 4c. Setup 1 + account svc ALWAYS-ON + SaveStore | $16.7 | $18.4 | $22.1 |
| 4d. Setup 3a + account process on host + SaveStore | $8.2 | $8.5 | $9.8 |

Setup 3 sizing honesty: ~10 idle Node/Fastify processes at ~50-80MB RSS each
is ~500-800MB before the router and page cache, so **512MB is not plausible**
for the one-host shape at any user count; **1GB is tight-but-plausible, 2GB is
comfortable**. Both are shown. 4d on a 1GB host adds an eleventh process; if
that tips it to 2GB, 4d becomes ~$15.0 at 100 users. Setup 3/4d are COST
COLUMNS ONLY: ticket 04's operational findings (total blast radius,
all-or-nothing deploys, one release flake blocking the estate, identity
secrets co-tenanted) stand unchanged.

### 3. Crossover: scale-to-zero fleet vs one always-on machine

Like-for-like (leaf apps only, hoe-pg excluded from both sides): the per-app
fleet costs 0.138 x H + ~$1.20 rootfs per month, where H = total
machine-awake-hours/day across all leaf machines. One always-on host costs its
flat rate. Crossover H = (host $/mo - 1.20) / 0.138:

| Host size | Always-on $/mo | Fleet awake-h/day at crossover | ...ignoring the $1.20 rootfs |
|---|---|---|---|
| 512MB (implausible for 10 procs) | $3.32 | 15.4 | 24.1 |
| 1GB | $5.92 | 34.2 | 42.9 |
| 2GB | $11.11 | 71.8 | 80.5 |

Estimated fleet awake-hours at 100 users is ~28-34 machine-h/day, i.e. **the
scale-to-zero fleet's variable cost at 100 users (~$3.9-4.6/mo) lands right at
the 1GB crossover and well under the 2GB one**. So per-app scale-to-zero and a
1GB always-on host cost about the same for the leaf apps at 100 users; below
~34 machine-h/day scale-to-zero is cheaper, above it the 1GB host wins.

Wake amplification, quantified: at 100 users the per-app fleet is awake ~28-34
machine-h/day while a single host would be awake only ~5.5 h/day. A
scale-to-zero 1GB host would cost 5.5 x 0.247 = **~$1.36/mo** - cheaper than
both the fleet's ~$4 and the always-on host's $5.92. Amplification is real
(roughly 5-6x the awake-hours), but at 512MB rates it amounts to about $3/mo.

The whole-estate table looks different from the like-for-like crossover for
one reason only: setup 3 also collapses the $9.96 always-on trio. That saving
is available without consolidation (Lever A takes $3.32 of it; the rest is
sprout's deliberate latency and ADR 0013 isolation, per ticket 04).

### 4. hoe-pg sizing at 100 users

Today: one 256MB node ($2.02) + 1GB volume ($0.15) = **$2.17/mo**, hosting 4
logical DBs whose data is tiny (health rows, 4 word rows/day, a few shared
boards, one household of sprout chat).

Account-layer SaveStore at 100 users (ticket 01 sizes): silt is the ceiling at
~5MB/user of scene blobs = **~500MB**; espy baked rasters can reach low MBs
(say ~200MB worst case across 100 users); boop/karesansui/fridge/boids/themes
are KBs each (~10MB total). Call it **~0.7GB of blob data**, before Postgres
overhead (TOAST, WAL, free space) and the existing 4 DBs on the same 1GB
volume. **The 1GB volume does not hold this.** Plausible steps:

| Step | Arithmetic | New hoe-pg $/mo | Delta |
|---|---|---|---|
| Grow volume 1GB -> 3GB | 3 x $0.15 = $0.45 | $2.47 | +$0.30 |
| Grow volume 1GB -> 5GB | 5 x $0.15 = $0.75 | $2.77 | +$0.60 |
| Node 256MB -> 512MB | $2.02 -> $3.32 | $3.47 (w/ 1GB vol) | +$1.30 |
| Both (512MB node + 3GB vol) | $3.32 + $0.45 | **$3.77** | **+$1.60** |

The 256MB node itself may well survive 100 casual users (blob reads/writes
are IO-light, working set small); the 512MB step is priced as the pessimistic
case and is what the scenario table assumes at 100 users. Daily volume
snapshots stay in the free 10GB tier at these sizes.

### 5. Bandwidth sanity check at 100 users

Cloudflare proxies every subdomain, so static bundles are mostly served from
its cache; Fly egress is API JSON plus save-blob downloads. Generous estimate:
5MB of Fly egress per active user per day: 100 x 5MB x 30 = 15GB/mo x $0.02 =
**$0.30/mo**. Even tripled (cold caches, silt scene restores) it stays under
$1/mo. Uploads (save sync inbound) are free. Bandwidth is noise.

### 6. Verdict: does scale-to-zero stop being the cheap option by 100 users?

**Mostly no - and where it technically does, the gap is a few dollars.** The
scale-to-zero leaf fleet's variable cost grows from ~$0 today to ~$4-5/mo at
100 users, which is right at parity with a 1GB always-on host for the same
apps (crossover ~34 machine-awake-h/day; we estimate ~28-34 at 100 users). So
at exactly 100 users the machine-cost argument between the two shapes is a
wash; scale-to-zero remains strictly cheaper below that, and only a growth
well past 100 users makes the always-on host clearly cheaper on machines.

The scenario table's headline (setup 3a at $8.2 beating setup 1 at $17.2) is
NOT scale-to-zero losing - it is the always-on trio being collapsed, worth
$9.96/mo, most of which Lever A and sprout decisions can claim without any
consolidation. Comparing the shapes with the trio question held separate
(setup 2 vs 3a), the one-host machine saves ~$6.5/mo at 100 users, priced
against ticket 04's standing operational verdict (days of work, total blast
radius, coupled deploys, co-tenanted identity secrets).

Absolute honesty about scale: the entire decision space from cheapest
(one 1GB host, $8.2) to most expensive (status quo + always-on account
service + upsized pg, $22.1) spans **~$14/mo at 100 users**. The account
layer itself adds ~$2/mo scale-to-zero or ~$5/mo always-on, and hoe-pg's
growth step is +$1.60/mo. Nothing here is a cost problem; the shapes should
be chosen on operational grounds (ticket 04) and the account layer on design
grounds (ticket 03), with cost as a tiebreaker at most.
