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

Not re-ticketed here: **Lever A (hub scale-to-zero, ~$3.24/mo)**, deferred -
not declined - at the decision sitting pending the account layer's first slice,
so the apex/login cold start can be felt before it is accepted. Checkpoint lives
in [ticket 08](../account-infra-discovery/issues/08-first-slice-spec-boop.md).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

(none yet)
