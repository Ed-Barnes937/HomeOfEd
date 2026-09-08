# 06 - Cost model: growth to ~100 users across setups

**Status:** claimed
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
