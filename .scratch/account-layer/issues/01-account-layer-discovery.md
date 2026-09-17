# 01 - Discovery: a global Account layer

**Status:** resolved
**Type:** research
**Reported:** 2026-09-06, Ed (dev)

A huge epic-to-be. The one clear goal: **kids have their own save data**,
portable across devices, per app. Ed is not clear on technical direction
beyond that. Speculative future: monetisation via "tokens" (arcade-machine
model) - kids spend tokens to play apps / interact with sprout, parents
manage allowances. The token idea informs the shape (accounts need a
parent-manages-child relationship and a ledger-shaped extension point) but is
**not** in scope to design.

This ticket's deliverable is a **discovery brief** (spec.md in this
directory, or an appended Answer): current-state inventory, options with
trade-offs, and a short list of decisions for Ed. No code. The direction
decision itself is Ed's - expect a grilling session after the brief.

## What the brief must cover

**Current state (verify, don't trust this summary):**

- sprout already has parent/child accounts - Ed explicitly wants to know if
  we can leverage them. How are they modelled, authed, stored?
- ADR 0008: apps are deliberately auth-decentralised, and seams were left for
  a future central identity service (e.g. wotd's `ctx.auth` null seam - see
  `apps/wotd/CLAUDE.md`). Read ADR 0008 before proposing anything.
- Save data today is app-local and mostly client-side: boop `boop:save`
  (localStorage, ADR 0025), silt scenes + field notes (localStorage), espy
  doodles (localStorage), karesansui, orbi... Inventory which apps have
  saves, where, and roughly how big.
- Hard rules that constrain any design: leaf-node apps, no cross-app
  imports, shared code is packages, handlers behind Store/BlobStore
  interfaces, data through tRPC.

**Options to lay out (at minimum):**

1. Extract sprout's accounts into a central identity service/app that other
   apps talk to (what ADR 0008 anticipated).
2. A `packages/accounts` client + one identity backend, apps keep their own
   save storage keyed by account id.
3. Central identity *and* central save-data service (a `SaveStore` any app
   can use) - pairs naturally with the infra consolidation question
   (`.scratch/infra-cost/`), which should be read together with this.

**Cross-cutting questions for the brief:**

- Migration path from anonymous localStorage saves to account saves (a kid
  must not lose their boops the day accounts arrive).
- Kids' data + auth means COPPA/GDPR-K territory - sprout's legal gate
  (ADR-0019) is prior art; flag, don't solve.
- Where the account UI lives (hub? per-app? sprout?).
- What the smallest first slice is (likely: one app's saves behind an
  account, nothing else).

## Related

- `.scratch/infra-cost/issues/01` - consolidation review; decide these two in
  the same sitting, they pull on the same architecture.
- Consumers waiting on this: boop clip persistence
  (`.scratch/boop-clips/issues/02`), recorded sounds
  (`.scratch/boop-recorded-sounds/issues/01`), silt per-scene progression's
  "revisit under global accounts" note.

## Comments

**2026-09-06 (agent):** Charted into the joint wayfinder map
[account layer + infra consolidation](../../account-infra-discovery/map.md)
together with `.scratch/infra-cost/issues/01`, per the "decide these together"
note. The discovery brief this ticket asks for is produced by that map's
tickets [01 - Inventory](../../account-infra-discovery/issues/01-current-state-inventory.md)
and [03 - Options paper: the account layer](../../account-infra-discovery/issues/03-account-layer-options.md);
the direction decision is queued for Ed as
[05 - Decision sitting](../../account-infra-discovery/issues/05-decision-sitting.md).

**2026-09-06 (agent):** Discovery brief done; status moved to ready-for-human.
The [current-state inventory](../../account-infra-discovery/issues/01-current-state-inventory.md)
confirmed sprout's accounts are extractable in mechanism but sprout-shaped in
model, the `ctx.auth` seam is universal, and all per-user data outside sprout is
single-device localStorage. The
[options paper](../../account-infra-discovery/issues/03-account-layer-options.md)
lays out four options and recommends a fresh minimal identity service + central
opaque-blob SaveStore (sprout swaps in later via its ADR 0012 path), boop
`boop:save` as the first slice, and hub owning the account UI. Eight decisions
await Ed in that paper, to be taken together with the infra-cost decisions in
the decision sitting.

**2026-09-10 (agent):** Direction DECIDED by Ed at the
[decision sitting](../../account-infra-discovery/issues/05-decision-sitting.md);
resolved. The account layer is a **fresh minimal identity service + central
opaque-blob SaveStore, one scale-to-zero "family" Fly app** with a logical DB
in `hoe-pg` (Option C proper; hub-hosting rejected). Sprout is left alone and
swaps in later via its ADR 0012 AuthProvider path; its ADR-0019 gate stays
scoped to sprout. Hub owns the account UI; save wiring is browser-direct to
the family service's tRPC with contract types in `packages/accounts`; import
is copy-never-move with LWW-per-slot + per-app merge hooks; the layer gets
its own fresh ADR-0019-style legal gate (household pilot + invite-code; ADR
before any non-household account). **First slice: boop `boop:save`.** Next
steps: spec ticket
[08](../../account-infra-discovery/issues/08-first-slice-spec-boop.md), gate
ADR [09](../../account-infra-discovery/issues/09-legal-gate-adr.md), consumer
re-pointing [10](../../account-infra-discovery/issues/10-repoint-waiting-consumers.md).
