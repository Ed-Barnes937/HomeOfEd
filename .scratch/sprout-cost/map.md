# Map: sprout running cost - the MPG line item and what sits around it

**Label:** wayfinder:map
**Charted:** 2026-10-05
**Reported by:** Ed - "my bill last month was over $50, which isn't great for 0
users and a little home hobby project in its infancy."
**Source tickets:** [infra cost review](../infra-cost/issues/01-cost-consolidation-review.md),
[Fly cost baseline](../account-infra-discovery/issues/02-fly-cost-baseline.md) (its
answer is now known to be incomplete - see Notes),
[hoe-pg restore rehearsal](../hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md)

## Destination

Get the monthly Fly bill down from ~$50 to the single digits, without putting
children's chat data somewhere less safe than it is today. The dominant line
item is sprout's **Managed Postgres (MPG) cluster at $38/mo**; the likely end
state is sprout on a logical database in the shared `hoe-pg` cluster - but
**only after** the restore rehearsal proves `hoe-pg` can actually be restored.

## Notes

### How the MPG cluster got there

ADR 0005 (2026-07-02) chose unmanaged `hoe-pg` *because* MPG costs ~10x, and
pre-committed three triggers for moving to MPG. The third reads: "The
child-safe LLM app (or anything with compliance weight) **goes live**."

[Plan 0004 D10](../../docs/plans/0004-sprout-migration-plan.md) fired that
trigger mechanically - its entire rationale is one cell citing ADR 0005 - and
[apps/sprout/docs/go-live.md](../../apps/sprout/docs/go-live.md) repeated D10
back. Three documents citing each other; none re-examined the decision.

Two things went wrong between July and the 2026-08-27 go-live:

1. **The trigger predates the scope it fired on.** ADR-0019 (2026-08-26)
   redefined launch as a *supervised household pilot behind an invite code* -
   Ed's own children, counsel sign-off deferred. ADR 0005's "goes live" plainly
   meant public launch with compliance weight. Nobody re-tested the trigger when
   "live" turned out to mean two kids in one house.
2. **Cost fell out of the decision.** ADR 0005 states the 10x premium in its
   *context* - it is the whole reason it chose unmanaged - but its trigger list
   carries no cost term, and D10's table has no cost column. A known $38/mo
   silently stopped being part of the decision.

Then it hid: the [Fly cost baseline](../account-infra-discovery/issues/02-fly-cost-baseline.md)
(2026-09-06) inventoried Fly **apps**, and an MPG cluster is not an app. So the
[decision sitting](../account-infra-discovery/issues/05-decision-sitting.md)
closed the infra-cost question at "~$13.30/mo, consolidation refuted" while the
real bill was ~$50. That baseline's Answer understates the bill by ~4x and
carries a correction comment as of 2026-10-05.

### Being fair to the original decision

The trigger was not purely a technicality. Of ADR 0005's three triggers, "an app
holds real user data that can't be regenerated from migrations" is **genuinely
true**: chat histories, accounts and safeguarding flags are not reproducible
from git. MPG is not the wrong *kind* of answer - it is the wrong *size* of
answer at this scope. The cheaper shape (unmanaged node + a rehearsed restore +
scheduled offsite dumps) must actually deliver that durability, not just assert
it.

### The hard ordering constraint

Today sprout's data sits on a cluster with real, vendor-run backups. `hoe-pg`
has backups **nobody has ever restored** - the rehearsal ticket's own words:
"Untested backups are hope, not backups." Moving children's data onto an
unrehearsed single node is strictly worse than paying the $38. The rehearsal
passing is a hard gate on ticket 04, not a nice-to-have.

### The destination is a deprecated product

Unmanaged Fly Postgres is on its way out - Fly staff have confirmed the intent
to deprecate it in favour of MPG, though with **no announced timeline**, the
`fly postgres` commands still working, existing clusters still running, and
`postgres-flex` open source as a self-hosted fallback. "Unsupported" is not a
change of terms; Fly's docs have said *This Is Not Managed Postgres* since the
Dec 2024 correction ADR 0005 already cites.

This does not block ticket 04, but it does mean the offsite dumps are an **exit
hatch** as well as a backup - a `pg_dump` restores into MPG, Hetzner or Neon.
Carried as an explicit Consequence in ticket 03's ADR and a precondition in
ticket 04. It also cuts the other way: a deprecated, unsupported product is a
fair reason for a *future* app with real external users to skip `hoe-pg`
entirely rather than land there and migrate out later.

### Scope

- Infrastructure is human-gated (CLAUDE.md). Read-only `fly` commands are fine;
  Ed executes everything that creates or mutates infra.
- Direction decisions (02, and accepting the ADR in 03) are Ed's.
- Out of scope: re-opening consolidation (closed 2026-09-10, refuted by
  measurement at both 0 and ~100 users) and the account layer's own hosting.

## The money, as currently understood

| Line item | Est. $/mo | Ticket |
|---|---|---|
| sprout MPG cluster (Basic, $38 + $0.28/GB storage) | ~38+ | 01, 04 |
| sprout web (min=1) + worker + pipeline (auto_stop off) | ~9.96 | 02 |
| hoe-pg cluster (256MB + 1GB volume) | ~2.17 | - |
| hoe-hub always-on (deferred Lever A) | ~3.32 | see below |
| Legacy non-HomeOfEd apps on the same bill | ~4.70 | 05 |
| Everything else (16 stopped machines, certs, egress) | ~1.20 | - |

**sprout's four pieces are roughly $48 of the ~$50 bill.** If every ticket here
lands, the estate should sit around **$6-8/mo**.

> **Superseded by measurement (2026-11-02, ticket 01).** The table above is the
> estimate; the invoice says **$62.59/mo**, not ~$50. sprout's four pieces were
> right at $48.24 - the miss was the **non-sprout** remainder, $13.67 actual
> against ~$2 assumed, because machines cost **$22.33** not ~$9.96. The
> estimate counted sprout's three warm machines and missed that `hoe-pg`,
> `child-safe-llm-db` and `malleable-pls-db` are three more always-on 256MB
> nodes. The $6-8 landing figure was also optimistic: the real floor is
> **~$16.11/mo**, because `malleable-pls-*` is live and stays (ticket 05) and
> `sprout-pg` costs $4.48 rather than nothing. Use ticket 01's table, not this
> one.

Not re-ticketed here: **Lever A (hub scale-to-zero, ~$3.24/mo)**, deferred -
not declined - at the decision sitting pending the account layer's first slice,
so the apex/login cold start can be felt before it is accepted. Checkpoint lives
in [ticket 08](../account-infra-discovery/issues/08-first-slice-spec-boop.md).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- **01** - True bill is **$62.59/mo**, MPG 64% of it; `Sprout-db` held **33
  rows in 8.5 MB** against a cluster metering 4.3 GB.
  [ticket](issues/01-true-bill-inventory.md)
- **02** - sprout is a **solo in-house demo**, not a two-child pilot. Nothing
  stays warm; ~-$8.66/mo. [ticket](issues/02-is-the-pilot-running.md)
- **03** - [ADR 0072](../../docs/adr/0072-sprout-owns-its-postgres-and-triggers-are-scopes.md)
  restates ADR 0005's third trigger as a **scope, not an event**, and makes
  every trigger carry its cost. [ticket](issues/03-restate-the-mpg-trigger-adr.md)
- **04** - **No migration happened.** No data worth moving, so destroy +
  rebuild from migrations. Destination changed to sprout's own cluster
  **`sprout-pg`** (512MB, Tigris backups, $4.48/mo), not a `hoe-pg` database.
  Both gates void *for this ticket only*; they return before a real pilot.
  -$39.58/mo. [ticket](issues/04-migrate-sprout-mpg-to-hoe-pg.md)
- **05** - `child-safe-llm-*` retired (-$2.72/mo). **`malleable-pls-*` is live
  and stays** - Vercel frontend -> `malleable-pls-server.fly.dev` ->
  `malleable-pls-db`; it reads as `suspended` only because it auto-stops.
  [ticket](issues/05-retire-legacy-fly-apps.md)

**Destination reached: $62.59/mo -> ~$16.11/mo** (-74%). Runbook:
[sprout-mpg-retirement](../../docs/runbooks/sprout-mpg-retirement.md).

Open follow-up: let `malleable-pls-db` auto-stop (~$2.57/mo), in its own repo.
Lever A (hub scale-to-zero, ~$4.33/mo) still deferred, unchanged.
