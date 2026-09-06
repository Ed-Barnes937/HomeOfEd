# 01 - Inventory: accounts and save data today

**Status:** claimed
**Type:** research
**Map:** ../map.md

## Question

What exactly exists today that a global account layer must build on or around?
Verify in the code - don't trust ticket summaries.

- **sprout accounts:** how are parent/child accounts modelled, authed, and
  stored (schema, session/auth mechanism, Store interfaces, where passwords or
  secrets live)? Could they plausibly be leveraged or extracted, or are they
  sprout-shaped?
- **ADR 0008 seams:** what did it decide, and what seams were deliberately left
  for a future central identity service (e.g. wotd's `ctx.auth` null seam - see
  `apps/wotd/CLAUDE.md`)? Which other apps have such seams?
- **Save-data inventory:** which apps persist what, where (localStorage keys vs
  server-side DB), and roughly how big per user. Known: boop `boop:save`
  (localStorage, ADR 0025), silt scenes + field notes (localStorage), espy
  doodles (localStorage), karesansui, orbi. Check every app in `apps/`.
- **Constraints:** restate the hard rules that bound any design (leaf-node
  apps, no cross-app imports, shared code as packages, Store/BlobStore
  interfaces, all data through tRPC).

Deliverable: the inventory, appended as the Answer.
