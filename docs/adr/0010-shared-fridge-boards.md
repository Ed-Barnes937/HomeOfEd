# 0010 — Shared fridge boards: immutable anonymous snapshots

- **Status:** Accepted
- **Date:** 2026-07-04
- **Related:** [0003-fridge-implementation-plan.md](../plans/0003-fridge-implementation-plan.md)
  §8, [0008](0008-apps-without-a-database.md) (apps without a database — the
  stateless baseline this adds to), [adding-an-app how-to §2](../how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only)

## Context

Personal fridges live entirely in the browser's `localStorage` (the reference
behaviour — [plan §5](../plans/0003-fridge-implementation-plan.md)). Phase 3
adds one server-side capability: a **share link**. A user publishes the board
they're looking at and gets back a short URL (`fridge.homeofed.com/b/<id>`)
they can send to someone else, who opens it and gets that arrangement on their
own fridge.

That is the *only* thing the database is for. It has to answer a few questions
before we design the table and handlers:

- Who owns a shared board? Can it be edited or deleted after sharing?
- What stops a share link being an abuse vector (huge payloads, enumeration)?
- What is the relationship between the shared snapshot and the visitor's board?

fridge has had **no database at all** until now ([ADR 0008](0008-apps-without-a-database.md));
this is the first persistence in the app, so the semantics set the shape of
everything downstream (schema, store, handlers, the import route).

## Decision

Shared boards are **immutable, anonymous, unlisted snapshots**, imported as new
local fridges on open. One table, `shared_boards`, in the shared `hoe-pg`
cluster.

- **Anonymous, no ownership.** No accounts, no auth on share or fetch. A share
  is a public-by-URL snapshot; there is no server-side notion of "my boards".
  This matches [ADR 0008](0008-apps-without-a-database.md): auth stays
  decentralised and the app owns no user records.
- **Immutable + permanent (v1).** Publishing writes a row once and never
  updates it. There is no edit and no delete endpoint. Sharing again after
  local edits **mints a new id** — the old snapshot is untouched. (Expiry,
  deletion, and abuse throttling beyond the payload caps are explicit
  follow-ups — [plan §2](../plans/0003-fridge-implementation-plan.md); revisit
  only if abused.)
- **Unlisted.** The only way to reach a snapshot is to know its id. Ids are
  10-char base62 (62^10 ≈ 8×10^17) generated from an injected `idGen`
  (crypto-random in prod), so guessing is the sole discovery path and is
  infeasible. Nothing lists or enumerates boards.
- **Import-on-open, not view.** Opening `/b/<id>` doesn't render the shared
  board read-only; it **imports** the payload as a new local fridge named
  `"<name> (shared)"`, makes it current, and navigates home. From then on the
  visitor edits their own copy — the server snapshot is never mutated.
- **Sizes/ids/z are recomputed on import, never trusted from the payload.**
  The stored payload is a `StoredBoard` (per-magnet `type/label/deg/color/x/y/rot`
  only). `w`/`h` come from `sizeFor(type)` and `id`/`z` from array order at
  import time — a malformed or hostile payload cannot inject absurd box
  dimensions or collide ids.
- **The payload caps are the abuse guard.** The single `storedBoardSchema`
  ([boardSchema.ts](../../apps/fridge/src/server/boardSchema.ts), shared by
  client and server) bounds everything: name ≤ 60 chars, ≤ 200 magnets,
  `label` matching `/^[A-Z0-9]?$/`, enum'd type/color/finish/wall, integer
  x/y in [−50, 5000], rot in [0, 360). The share handler validates input
  through it, and the get handler re-validates on the way out, so a row that
  somehow went bad can't reach a client.

**Table** (`src/server/schema.ts`):

```ts
sharedBoards = pgTable('shared_boards', {
  id: text('id').primaryKey(),                 // 10-char base62
  name: text('name').notNull(),
  payload: jsonb('payload').$type<StoredBoard>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

`FridgeStore`'s surface is `ping()`, `insertSharedBoard(id, name, payload)`
(the primary key makes a duplicate id throw, which the handler turns into a
retry), and `getSharedBoard(id) → { name, payload } | null`.

## Consequences

- **Smallest possible server.** No auth, no ownership joins, no mutable rows,
  one table, three store methods. The DB layer is added purely additively over
  the stateless app (how-to §2), exactly as [ADR 0008](0008-apps-without-a-database.md)
  anticipated.
- **The snapshot and the visitor's fridge are fully decoupled.** Because import
  copies rather than links, there is no live "shared document" to keep in sync,
  no permissions model, and no way for a visitor to affect the sharer — the
  properties that make immutability safe are the same ones that keep the
  feature tiny.
- **Permanence is a known debt.** Rows accumulate forever in v1; there is no
  GC. Accepted because payloads are capped and the cluster is shared/cheap;
  the follow-up (expiry/deletion) is recorded and gated on real abuse, not
  built speculatively.
- **name is stored twice** (as its own column *and* inside the payload). The
  column exists so a future listing/OG-preview needn't parse jsonb; v1 reads
  the payload. Minor redundancy, deliberately kept for that forward door.
