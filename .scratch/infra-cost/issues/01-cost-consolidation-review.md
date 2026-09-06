# 01 - Infra cost review: machine-per-app vs consolidation

**Status:** ready-for-agent
**Type:** research
**Reported:** 2026-09-06, Ed (dev)

Ed's hypothesis: the current shape - every app its own Fly app/machine
(scale-to-zero, London), a backend per app, a logical DB per app that needs
one (all in the shared `hoe-pg` cluster) - costs more than a single scalable
machine would, and the isolation it buys (trivially move an app to its own
domain, sell it, kill it) was probably overengineering. Reality check:
near-zero users now, ceiling ~100.

Deliverable: a written cost analysis + recommendation appended here (or a
spec.md), for Ed to decide on. **Analysis only - no infra mutation; infra is
human-gated** (CLAUDE.md). Reading Fly billing/state via read-only `fly`
commands is fine.

## What to establish

**Actual current cost, not vibes:**

- Per-app: machine count/size, rootfs/volume storage, stopped-machine
  costs (Fly charges for rootfs of stopped machines), the `hoe-pg` cluster
  (likely the dominant fixed cost), IPs (dedicated IPv4s are per-app money if
  allocated), certs, bandwidth. Which apps even have a backend vs static.
- What scale-to-zero actually saves at ~0 traffic - if stopped machines cost
  pennies, the whole question may be moot; say so and stop.

**Options with real numbers:**

1. Status quo (baseline).
2. One host Fly app serving every subdomain (Caddy/nginx or a Node router in
   front of per-app processes), single machine, scale-to-zero as a unit.
   Repo stays exactly as it is - leaf apps, per-app Dockerfiles could still
   exist for the escape hatch. The isolation Ed valued becomes "a day's work
   to re-extract" instead of "already extracted".
3. Middle ground: consolidate only the backends-with-DBs onto one machine,
   keep static-only apps on Fly's free-ish static serving or the hub.

**Trade-offs to be honest about:**

- Blast radius (one bad deploy downs every app), deploy coupling (CI
  currently deploys per-app on affected paths), the release_command
  migration story across apps sharing a machine, and the known Fly
  release-machine flake.
- The account layer discovery (`.scratch/account-layer/issues/01`) may add a
  central identity/save service - decide these together; a consolidation
  that ignores it will be redone.

## Comments
