# 02 - Fly cost baseline: what the current shape actually costs

**Status:** claimed
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
