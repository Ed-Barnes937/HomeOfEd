# 01 - Discovery: a global Account layer

**Status:** ready-for-agent
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
