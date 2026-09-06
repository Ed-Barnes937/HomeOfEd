# 03 - Options paper: the account layer

**Status:** claimed
**Type:** research
**Map:** ../map.md
Blocked by: 01

## Question

Given the inventory (ticket 01), lay out the account-layer options with honest
trade-offs so Ed can decide direction. The one clear goal: **kids have their
own save data, portable across devices, per app**. At minimum cover:

1. Extract sprout's accounts into a central identity service/app that other
   apps talk to (what ADR 0008 anticipated).
2. A `packages/accounts` client + one identity backend; apps keep their own
   save storage keyed by account id.
3. Central identity *and* central save-data service (a `SaveStore` any app can
   use) - note how each consolidation option (ticket 04) would host it.

Cross-cutting, per option:

- Migration path from anonymous localStorage saves to account saves.
- COPPA/GDPR-K exposure - flag against sprout's ADR-0019 prior art, don't solve.
- Where the account UI lives (hub? per-app? sprout?).
- The smallest first slice (likely: one app's saves behind an account, nothing
  else) - name a concrete candidate app and why.
- How the parent-manages-child relationship and a ledger-shaped extension point
  stay possible without designing them.

Deliverable: the options paper appended as the Answer, ending with the short
list of decisions Ed must make.
