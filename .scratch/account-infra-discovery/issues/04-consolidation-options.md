# 04 - Options paper: machine-per-app vs consolidation

**Status:** claimed
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
