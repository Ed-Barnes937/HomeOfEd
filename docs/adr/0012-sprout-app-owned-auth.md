# 0012 — sprout brings its own auth provider (Better Auth) for V1, behind `ctx.auth`

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [0004-sprout-migration-plan.md](../plans/0004-sprout-migration-plan.md)
  §5.2 (D5, D2), [0001-foundation.md](0001-foundation.md) (layered backend + DI),
  [0008-apps-without-a-database.md](0008-apps-without-a-database.md)
  (decentralised auth ≠ a DB), root `CLAUDE.md` hard rule 3

## Context

sprout arrives from a standalone repo where authentication is already built on
**Better Auth** (email + password parent accounts, Drizzle adapter,
`subscriptionStatus` field) plus a bespoke **child session** — a child logs in
with a PIN/password against a parent-owned device and gets a session that is
distinct from the parent's.

HomeOfEd's longer-term intent (noted in ADR 0008) is a *decentralised* identity
service that apps consume rather than each app owning login. That service does
**not exist yet.** The choices were: (a) build the central service now to host
sprout, (b) have sprout authenticate against nothing / a stub, or (c) let sprout
keep the working Better Auth integration it already has, bounded so a later
central-auth swap is cheap.

Two further wrinkles are specific to sprout:

- **Two identities, not one.** A request is authenticated either as a *parent*
  (Better Auth cookie session) or as a *child* (a signed session token). They are
  different principals with different authority, resolved by different mechanisms.
- The source child session was an **unsigned localStorage value** — trivially
  forgeable. The prior review (#34) required it be made tamper-evident.

## Decision

**Keep Better Auth for sprout V1, app-owned, and put both identities behind the
one `ctx.auth` seam** that every HomeOfEd app already exposes. Building the
central identity service is explicitly out of scope for this migration.

**Two `AuthProvider`s, one seam.** `ctx.auth.getUser()` returns a
`SproutUser = ParentUser | ChildUser` (a `{ id }` narrowed by
`role: 'parent' | 'child'`, child carrying `parentId`). Which provider answers is
chosen per request at the composition root, not by the handlers:

- **Parent** — a Fastify `onRequest` hook resolves the Better Auth cookie session
  and stamps a **server-trusted** `x-sprout-parent` header (any inbound value is
  stripped first). The auth seam reads that header to select the parent provider.
- **Child** — a signed token (HMAC-SHA256 over `{ childId, parentId }`, dedicated
  `CHILD_SESSION_SECRET`, 30-day expiry) carried in the `sprout_child_session`
  cookie. The child provider verifies the HMAC server-side; a forged or edited
  token fails the check. This replaces the unsigned localStorage session (#34).

Handlers **never read identity from their input** — `requireParent`,
`requireChild`, and the ownership checks (`verifyChildOwnership`,
`verifyConversationOwnership`) all derive it from `ctx.auth` (#34/#35/#36).

**Merged schema, one migration journal (D2).** Better Auth's tables
(`user`/`session`/`account`/`verification`) live in the app's single
`schema.ts` alongside the app tables, generated and applied by the app's one
`drizzle.config.ts` + `migratePostgres` — **not** by Better Auth's own migration
mechanism, and **not** in a second config with a `tablesFilter` split. Because
there is now one schema, `children.parentId` and `devices.parentId` are **real
foreign keys** to `user.id` (`onDelete: cascade`), which the two-domain source
could not express.

**A crypto-free seam for the browser bundle.** The child token is minted through a
`ChildTokenMinter` port (`auth/childTokenPort.ts`) and passwords through a
`PasswordHasher` port, mirroring each other. The concrete Node implementations
(which import `node:crypto`) are injected at the composition root; the `.iwft`
browser harness injects fakes. This keeps `node:crypto` out of the Playwright-CT
bundle — the same reason the ports exist at all.

## Consequences

- sprout ships with a **working, tamper-evident** auth today instead of waiting on
  an unbuilt central service.
- The divergence is **bounded to one file surface.** When central auth arrives, it
  becomes a third `AuthProvider` (or replaces the two); handlers, which only ever
  see `ctx.auth`, do not change. The seam is the migration path.
- The cost: sprout owns account storage (the `user`/`session`/… tables) and the
  `CHILD_SESSION_SECRET`, which a central service would otherwise own. Accepted as
  a V1 posture, recorded here so it is a decision and not drift.
- Account erasure is clean: deleting a `user` row cascades to that parent's
  children and devices via the new FKs.
- This ADR records auth *mechanism*. The product's legal/safeguarding posture
  around child data lives with the app —
  [apps/sprout/docs/product-legal-adrs.md](../../apps/sprout/docs/product-legal-adrs.md)
  and the [safeguarding runbook](../../apps/sprout/docs/safeguarding/csam-grooming-escalation.md).
