# Confirm the parent-visible flag log meets the 6.5.9 claim

Type: task
Status: resolved
Blocked by: —

## Question

Nothing to decide — this is the verification the roadmap's ⚠️ on 6.5.9 is waiting for. AFK; the
agent can drive it alone. It unblocks the ability to state the 6.5.9 position honestly rather
than "not verified during the port".

Confirm, with file or test evidence:

- `FlagsPage.tsx` is reachable from the parent dashboard (route `/parent/flags` exists — confirm
  it's actually linked, not just routable).
- It lists flags across **all** of a parent's children, scoped to that parent only, and a parent
  cannot see another parent's flags.
- Flags written server-side by the SSE route (`chat-sse.ts` persists `flag` events as they
  arrive) surface here — i.e. the write path and the read path agree on shape.
- `flags.topics` is `text` holding a JSON string, not `jsonb` (per `apps/sprout/CLAUDE.md`) —
  confirm the page renders it correctly rather than printing raw JSON.
- Whether existing `.iwft` coverage (`parent-flags.iwft.tsx`) already proves the above, or
  whether there's a gap.

**Record in the answer:** which of the 6.5.9 sub-claims are now confirmed, which aren't, and
whether `apps/sprout/docs/guardrail-roadmap.md` can have its 6.5.9 row updated. Do not update
the roadmap row as part of this ticket — the map's Decisions-so-far is the record, and the
roadmap edit belongs with the handoff.

## Answer

All five checks pass. Evidence per claim:

### 1. Reachable — CONFIRMED

- Route: `src/router.tsx:60-63` defines `parentFlagsRoute` at `/parent/flags` →
  `FlagsPage`, registered in the route tree at `router.tsx:106`.
- Linked, not just routable: `DashboardPage.tsx:71` renders a "View flags"
  `<Link to="/parent/flags">`, and `ChildSummaryPanel.tsx:113` renders a per-child
  "Review flags" link (`/parent/flags?childId=…`) which `FlagsPage` reads back out of
  the query string as the initial filter. Both links are code-confirmed; no test clicks
  them (the `.iwft` navigates with `goto('/parent/flags')` directly). Minor, not a
  6.5.9 gap.

### 2. All children, parent-scoped, no cross-parent leak — CONFIRMED

- `listFlagsHandler.ts`: `requireParent(ctx)` → owned-child set from
  `ctx.store.listChildrenByParent(parent.id)` → `listFlagsByChildren(ownedIds)`.
  The optional `childId` input is deliberately **ignored** (never used to filter),
  which is what closes the #35 IDOR — a crafted childId can neither narrow nor widen
  the result. Child display names resolve from the owned set, never from input.
- Test evidence: `listFlagsHandler.test.ts` — "returns only the authed parent's
  children's flags, newest-first" (seeds another family's flag, asserts absence),
  "IGNORES any childId in input" (asks for the other family's child by id, asserts no
  leak and no narrowing), empty-list for a childless parent, 401 for anonymous.

### 3. SSE write path and read path agree on shape — CONFIRMED

- Write: `chat-sse.ts:49-68` `persistFlag` calls `store.createFlag` with
  `{childId, conversationId, messageId: null, type, reason, childMessage, aiResponse,
  topics: JSON.stringify(flag.topics) | null}` — the same `flags` table the read path
  selects from; `toFlagRecord` (`handlers/flags/schemas.ts`) maps every column to the
  wire shape.
- Test evidence: `chat-sse.test.ts:150` "persists a flag event to the DB and forwards
  it + the fallback token" asserts the stored row includes
  `topics: JSON.stringify(['weapons'])` (real route over `createAppServer`, fake Store —
  per the app CLAUDE.md split). The `.iwft` seeds raw SQL rows in the same shape
  (`'["space"]'` etc.) and the page lists them over the **real** router +
  `DrizzleSproutStore` on PGlite, closing the write-shape→read-shape loop end to end.

### 4. `topics` is text-JSON and renders correctly — CONFIRMED (code), one test gap

- Schema: `server/schema.ts:177` — `topics: text('topics')` with the JSON-array-as-text
  comment; matches `apps/sprout/CLAUDE.md` ("no true `jsonb` columns").
- Rendering: `FlagListItem.tsx:32-39` `parseTopics` JSON.parses with a `[]` fallback and
  renders each topic as its own `data-testid="flag-topic"` badge span. Raw JSON is never
  printed — an unparseable value renders nothing rather than leaking the string.
- **Gap:** no test asserts the badge rendering. `data-testid="flag-topic"` appears only
  in the component; the `.iwft` seeds topics but its POM only counts `flag-item`s.

### 5. `.iwft` coverage — mostly proves it, two named gaps

`parent-flags.iwft.tsx` (real router + PGlite, parent-authenticated via the encoded-id
seam) proves: the page loads at `/parent/flags`, lists all 3 seeded flags across two
children, mark-as-reviewed sticks, the client-side child filter narrows to 2, and the
empty state shows. Cross-parent isolation is proven at the handler level (above), which
is the right seam for it. Gaps, for the handoff rather than new tickets (nothing to
*decide* — they're small test additions):

- No assertion that topic badges render (claim 4's gap) — one `expect` on
  `getByTestId('flag-topic')` in the existing first test would close it.
- No test drives the dashboard "View flags" link (claim 1's gap).

### 6.5.9 position

Of the roadmap row's two "still to confirm" items, **"the parent-visible flag log is
present" is now confirmed** and that clause can be dropped when the handoff edits the
row (cite this ticket). The other item — "the disclosure build lands" — is ticket 08's
`/tdd` handoff, not this ticket, and stays until that build merges. The row's ⚠️
therefore remains until the ADR-0017 build lands, but its verification debt is now
solely the disclosure build.

The parent-facing "What this can and can't do" disclosure block was also sighted on the
page itself (`FlagsPage.tsx:75-82`), consistent with the map's established facts.
