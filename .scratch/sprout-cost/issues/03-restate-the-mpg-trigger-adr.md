# 03 - ADR: restate ADR 0005's MPG trigger in terms of scope, not event

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Map:** ../map.md

## Why

Moving sprout off MPG contradicts [ADR 0005](../../../docs/adr/0005-unmanaged-fly-postgres.md)
as written. Its migration plan is one-way - triggers fire, you move to MPG,
"scale the old cluster to zero, delete after a comfortable soak". There is no
path back. Ticket 04 cannot just quietly do the opposite of an Accepted ADR;
the decision record has to change first, or the next agent to read ADR 0005
will re-provision MPG on the next app that looks compliance-shaped.

The defect in ADR 0005 is narrow and worth naming precisely:

1. **The third trigger is an event, not a scope.** "The child-safe LLM app (or
   anything with compliance weight) **goes live**" fired on a supervised
   household pilot behind an invite code (ADR-0019) - two children in the
   author's own house, counsel deferred. The trigger was written in July
   meaning *public launch*; the word "live" could not carry that distinction.
2. **The trigger list carries no cost term.** ADR 0005's context states the 10x
   premium and chooses unmanaged *because of it*. Its trigger list then drops
   the number entirely, so firing a trigger reads as free. Plan 0004's D10 table
   likewise has no cost column.
3. **The durability triggers are real and must survive.** "Real user data that
   can't be regenerated from migrations" is genuinely true of sprout. The
   replacement must not read as "cost beats durability" - it must say what
   durability we commit to instead, and name the mechanism.

## Deliverable

A new ADR at `docs/adr/NNNN-<slug>.md` (MADR-lite, matching the house style;
next free number - check for collisions, a travel-map branch holds 0070) that
**amends ADR 0005's migration plan**. It should:

- Restate the triggers so each names a **scope**, not an event. Suggested
  shape, to be argued properly in the ADR: MPG is warranted when data is held
  for people **outside the operator's household**, or when a durability
  obligation exists that the operator cannot personally discharge. A supervised
  household pilot sits below that line.
- **Re-attach the cost term.** Every trigger states what firing it costs. A
  trigger that cannot be priced is not ready to fire.
- Make the path **two-way**: record that an app may move back to `hoe-pg` when
  its scope narrows or never widened, and state the preconditions (ticket 04's
  gate: a rehearsed restore plus scheduled offsite dumps).
- State the durability commitment that replaces MPG's, concretely enough to
  verify: rehearsed restore, offsite dump cadence, and the accepted RPO/RTO.
  "We'll own the ops" is what ADR 0005 already said, and it produced backups
  nobody tested for over a year.
- Cross-reference ADR-0019 and [ADR 0057](../../../docs/adr/0057-family-service-legal-gate.md),
  whose household-pilot-vs-wider-release boundary is the same line this ADR is
  drawing. If the family service's legal gate opens, this trigger fires too -
  say so explicitly, so the two gates move together.
- **Carry the deprecation risk as an explicit Consequence.** Moving *onto*
  unmanaged Fly Postgres means moving onto a product Fly has publicly committed
  to deprecating. ADR 0005 already notes it receives "minimal new investment"
  and calls the position "deliberately temporary"; this ADR must go further and
  state what happens when it ends, because it is now the destination rather than
  the thing being left. What is actually known (2026-10-05): Fly staff confirm
  the intent to deprecate, **no timeline has been announced**, `fly postgres`
  commands still work, existing clusters keep running, and `postgres-flex` is
  open source so it can be self-deployed if flyctl drops the commands. The
  honest framing is that the offsite dumps are not only a durability mechanism
  but **the exit hatch**: a `pg_dump` restores into MPG, Hetzner, Neon or
  anything else, which is what keeps a deprecated dependency survivable. Say so
  in the ADR, and note it cuts the other way too - a deprecated, unsupported
  product is a legitimate reason for a *future* app with real external users to
  skip `hoe-pg` entirely rather than land there and migrate later.

Then update the downstream copies so they stop asserting the old rule:
`docs/plans/0004-sprout-migration-plan.md` (D10 and §10) and
`apps/sprout/docs/go-live.md` (the "What differs from the standard runbook"
item 1 and the Postgres row). Leave ADR 0005 Accepted with an **Amended by**
pointer - house style keeps superseded ADRs as the historical record.

**Ed accepts the ADR.** The agent drafts it; the status change to Accepted is
Ed's call, and 04 is gated on it.

## Comments
