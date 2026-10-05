# 02 - Fly cost baseline: what the current shape actually costs

**Status:** resolved
**Type:** research
**Map:** ../map.md

## Question

What does the current infrastructure actually cost per month - numbers, not
vibes? **Read-only `fly` commands only; never create or mutate infra.**

- Per Fly app: machine count and size, rootfs and volume storage, whether it
  scales to zero, dedicated IPv4s (per-app money if allocated), certs.
- Stopped-machine costs: Fly charges for rootfs of stopped machines - price
  this for the fleet.
- The `hoe-pg` Postgres cluster (likely the dominant fixed cost): machine size,
  volume size, monthly price.
- Which apps even have a backend vs are effectively static.
- Cross-check current Fly.io pricing (web) against the resource inventory to
  compute an estimated monthly bill, and note anything the CLI can't see.

**The moot check:** state clearly what scale-to-zero saves at ~0 traffic. If
stopped machines cost pennies and the cluster dominates regardless of app
count, say so plainly - the consolidation question may be mostly moot, and the
options paper (ticket 04) should know that before it starts.

Deliverable: the cost baseline, appended as the Answer.

## Answer

Inventory taken 2026-09-06 with read-only `fly` commands (org-scoped token,
org `personal`). No infra was created or mutated.

### Fleet inventory (HomeOfEd apps)

All machines are `shared-cpu-1x` in `lhr`. No app has a dedicated IPv4
(every public app rides a shared IPv4 + a free dedicated IPv6). No app
machine has a volume.

| App | Machines | VM size | State right now | Always-on? (fly.toml) | DB-backed (release_command) | Cert |
|---|---|---|---|---|---|---|
| hoe-hub | 2 | 1x shared / 512MB | 1 started, 1 stopped | yes, min_machines_running=1 | yes | homeofed.com (issued) |
| hoe-boids | 2 | 1x shared / 512MB | both stopped | no, min=0, auto_stop | no | boids.homeofed.com (not verified) |
| hoe-boop | 2 | 1x shared / 512MB | both stopped | no | no | boop.homeofed.com (issued) |
| hoe-espy | 2 | 1x shared / 512MB | both stopped | no | no | espy.homeofed.com (issued) |
| hoe-fridge | 2 | 1x shared / 512MB | both stopped | no | yes | fridge.homeofed.com (not verified) |
| hoe-karesansui | 2 | 1x shared / 512MB | both stopped | no | no | karesansui.homeofed.com (issued) |
| hoe-silt | 2 | 1x shared / 512MB | both stopped | no | no | silt.homeofed.com (issued) |
| hoe-wotd | 2 | 1x shared / 512MB | both stopped | no | yes | wotd.homeofed.com (not verified) |
| hoe-sprout | 2 (web+worker) | 1x shared / 512MB | web started, worker stopped | web: min=1 | yes | sprout.homeofed.com (issued) |
| hoe-sprout-pipeline | 1 | 1x shared / 512MB | started | yes, auto_stop=off, min=1 | no (private, no public IP) | none |
| hoe-pg (Postgres) | 1 | 1x shared / 256MB | started | yes (it is the DB) | n/a | none (private ingress only) |

- `hoe-pg`: single node, `flyio/postgres-flex:17.2`, one 1GB volume
  (`vol_r1j5279jdz0pemwr`, created 2026-09-04 - the cluster machine/volume
  are only 2 days old). There is no replica: cluster = 1 machine + 1GB.
- "Effectively static" apps that still ship a Node server container:
  boids, boop, espy, karesansui, silt (stateless, no DB). DB-backed:
  hub, fridge, sprout, wotd.
- Same org, not HomeOfEd, but on the same bill: `child-safe-llm-db`
  (1x 256MB started + 1GB volume), `child-safe-llm-pipeline` / `-web`
  (0 machines), `malleable-pls-db` (1x 256MB started + 1GB volume),
  `malleable-pls-server` (1x 512MB stopped + 1GB volume).
- Certs: 9 single-hostname certs org-wide, all on hoe apps.

### Pricing rates used (fly.io/docs/about/pricing/, retrieved 2026-09-06)

Source: https://fly.io/docs/about/pricing/ (billing model cross-checked at
https://fly.io/docs/about/billing/ - pure usage billing, no plan fee or
monthly minimum mentioned).

| Resource | Rate |
|---|---|
| shared-cpu-1x, 512MB, started | $0.00000128/s = $3.32/mo |
| shared-cpu-1x, 256MB, started | $0.00000078/s = $2.02/mo |
| Stopped machine rootfs | $0.15/GB/mo |
| Volume (provisioned) | $0.15/GB/mo |
| Dedicated IPv4 | $2.00/mo (none allocated - $0) |
| Shared IPv4 / dedicated IPv6 | free |
| TLS cert, single hostname | first 10 per org free, then $0.10/mo (we have 9 - $0) |
| Outbound bandwidth (NA/EU) | $0.02/GB |

### Estimated monthly bill (HomeOfEd)

Assumptions: ~0 traffic, so auto-stop apps are stopped ~100% of the time
(matches observed state) and egress rounds to $0; stopped-machine rootfs
is NOT visible via the CLI, so it is estimated at 0.5GB per machine
(range 0.4-1.0GB - small Node images), i.e. ~$0.075/machine/mo.

| Line item | Qty | Est. $/mo |
|---|---|---|
| hoe-hub always-on machine (512MB) | 1 | 3.32 |
| hoe-sprout web always-on machine (512MB) | 1 | 3.32 |
| hoe-sprout-pipeline always-on machine (512MB) | 1 | 3.32 |
| hoe-pg machine (256MB, 24/7) | 1 | 2.02 |
| hoe-pg volume (1GB) | 1 | 0.15 |
| Stopped machines rootfs (hub 1, sprout worker 1, 7 apps x 2 = 14; 16 total @ ~0.5GB) | 16 | ~1.20 (0.96-2.40) |
| Dedicated IPv4s | 0 | 0.00 |
| Certs (9, under the free 10) | 9 | 0.00 |
| Egress (~0 traffic) | - | ~0.00 |
| **HomeOfEd total** | | **~$13.30/mo (roughly $13-15)** |

Non-HomeOfEd apps on the same org bill add ~$4.70/mo (two more 256MB
Postgres machines at $2.02 each + 3 more 1GB volumes + one stopped 512MB
machine), putting the whole-org estimate around **$18/mo**.

What the CLI cannot see (flagged, not estimated): actual invoiced
amounts and any credits/discounts (`fly` has no billing read command -
the dashboard invoice is the ground truth), real rootfs GB per stopped
machine, real egress GB, and volume snapshot storage (postgres-flex
takes daily snapshots; first 10GB/mo are free, so likely $0 here).

### Moot check

**The consolidation question is mostly moot, but not for the reason the
ticket guessed.** Scale-to-zero is already doing its job: a stopped
512MB machine costs ~$0.08/mo in rootfs vs $3.32/mo running, so the 16
stopped machines cost ~$1.20/mo where always-on would cost ~$53/mo -
scale-to-zero at ~0 traffic is saving roughly $50/mo already. The
`hoe-pg` cluster does NOT dominate: it is a single 256MB node with a 1GB
volume, $2.17/mo (~16% of the bill). There are no dedicated IPv4s at
all, so IP costs are $0. What actually dominates (~75% of the HomeOfEd
bill, $9.96/mo) is the three ALWAYS-ON app machines: hoe-hub
(min_machines_running=1), hoe-sprout web (min=1), and hoe-sprout-pipeline
(auto_stop=off). Consolidating the seven scale-to-zero apps into fewer
apps could only ever reclaim the ~$1.20 stopped-rootfs line - pennies.
If the bill is to move meaningfully, the levers are the always-on trio
(let hub scale to zero, fold sprout-pipeline into sprout, or accept
cold starts), not app count. At ~$13/mo total, every option in ticket 04
should be weighed against a bill that is already small.

## Comments

**2026-10-05 (agent): CORRECTION - this Answer understates the bill by roughly
4x. Do not cite its total.**

Ed's actual invoice for the month was **>$50**, against this ticket's
~$13.30/mo estimate. The cause is a blind spot in the method, not an arithmetic
error: the inventory was taken with app-level `fly` commands, and **sprout's
Managed Postgres (MPG) cluster is not a Fly app**, so it never appeared in the
fleet table. MPG's floor is $38/mo (Basic) plus $0.28/GB provisioned storage -
on its own, about three times everything this ticket did count. The word "MPG"
appears nowhere in this ticket, ticket 04, ticket 06 or ticket 07.

sprout was provisioned onto MPG at go-live on 2026-08-27, nine days before this
inventory was taken, per `apps/sprout/docs/go-live.md` and plan 0004 D10.

What this does and does not invalidate:

- **Still sound:** the relative findings within the Fly-apps fleet. Scale-to-zero
  is saving ~$50/mo; stopped machines cost pennies; `hoe-pg` really is ~$2.17/mo;
  there are no dedicated IPv4s. The consolidation question remains refuted -
  consolidating ten scale-to-zero apps was never going to move a bill dominated
  by a database the analysis could not see.
- **Invalidated:** the total (~$13.30/mo), the claim that the three always-on
  machines are ~75% of the bill (with MPG counted they are closer to 20%), and
  by extension the "the remaining ~$13.30/mo is accepted as the baseline"
  conclusion recorded at the
  [decision sitting](05-decision-sitting.md) and echoed to
  [infra-cost/01](../../infra-cost/issues/01-cost-consolidation-review.md).
- **Method lesson worth keeping:** a Fly cost inventory must cover more than
  `fly apps list`. Managed Postgres (`fly mpg list`), Tigris/object storage, and
  anything else bought through Fly as a *service* rather than an *app* are
  invisible to the app-level commands. The invoice is the only ground truth, and
  this ticket flagged that it could not read one - that caveat turned out to be
  the whole story.

Picked up as its own effort: [.scratch/sprout-cost/](../../sprout-cost/map.md).
The corrected inventory is
[its ticket 01](../../sprout-cost/issues/01-true-bill-inventory.md); this
ticket's Answer is left as written above, with this correction, as the record of
what was believed on 2026-09-06.
