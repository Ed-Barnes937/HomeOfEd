# Map: account layer + infra consolidation (decide together)

**Label:** wayfinder:map
**Charted:** 2026-09-06
**Source tickets:** [account-layer discovery](../account-layer/issues/01-account-layer-discovery.md), [infra cost review](../infra-cost/issues/01-cost-consolidation-review.md)

## Destination

Ed decides, in one sitting, (a) the account-layer direction - which architecture
option and the smallest first slice - and (b) the infra consolidation direction.
Both decisions recorded on this map and echoed to the source tickets. This map is
planning only: its outputs are an inventory, a cost baseline, two options papers,
and Ed's decisions. No builds, no infra mutation.

## Notes

- Planning only: decision tickets, research, and options papers. No builds.
- Infrastructure is human-gated (CLAUDE.md). Read-only `fly` commands are fine;
  never create or mutate deployed infra.
- Direction decisions are Ed's. Research tickets are AFK (agent-workable); the
  decision sitting is HITL - invoke /grilling and /domain-modeling.
- Tokens/monetisation (arcade model) informs the shape (parent-manages-child
  relationship, ledger-shaped extension point) but is not in scope to design.
- Read ADR 0008 before proposing anything auth-shaped. sprout's legal gate
  (ADR-0019) is prior art for kids' data; flag, don't solve.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [02 - Fly cost baseline](issues/02-fly-cost-baseline.md) - HomeOfEd costs
  ~$13/mo; the ticket's premise was inverted: hoe-pg is only ~$2.17/mo and the
  three always-on machines (hub, sprout web, sprout-pipeline) are ~75% of the
  bill. Consolidating the seven scale-to-zero apps would reclaim only ~$1.20/mo
  in stopped rootfs - the real levers are the always-on trio.

## Not yet specified

- Smallest-first-slice spec (likely one app's saves behind an account): which
  app, what the slice contains. Tickets once Ed picks a direction.
- Migration plan for anonymous localStorage saves (a kid must not lose their
  boops the day accounts arrive). Sharpens after the direction decision.
- COPPA/GDPR-K legal gate follow-up: does sprout's ADR-0019 pilot gate extend to
  a global account layer? Flag only for now.
- Where the account UI lives (hub? per-app? sprout?) - probably settled inside
  the decision sitting, but may need its own ticket if it survives it.
- If Ed picks a consolidation option: execution plan (CI deploy restructure,
  release_command / migration story across co-hosted apps, cutover runbook).
- Re-point waiting consumers once direction is set: boop clip persistence
  (`.scratch/boop-clips/issues/02`), boop recorded sounds
  (`.scratch/boop-recorded-sounds/issues/01`), silt per-scene progression's
  "revisit under global accounts" note.

## Out of scope

- Designing the token/ledger/monetisation system - it informs extension points
  only.
- Building anything: no account-layer code, no consolidation execution, no infra
  mutation of any kind.
- Selling an app / moving one to its own domain - that isolation property gets
  weighed in the consolidation paper, not exercised.
