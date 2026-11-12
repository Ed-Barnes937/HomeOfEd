# 22 - A parent's sign-in lasts 7 days and never extends

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 11
Blocked by: 06, and Ed's answer below

Found by ticket 06 against `docker compose up family`.

- `apps/family/src/server/auth/betterAuth.ts` sets no `session` option, so
  Better Auth's default applies: the parent session cookie lasts 7 days
  (`Max-Age=604800`).
- The cookie never extends. `identity.me` over tRPC extends the database row
  but sends no `Set-Cookie`, because `resolveParentId` calls
  `auth.api.getSession` server-side and the refreshed cookie is dropped.
- Silent renewal (ticket 06) needs a live parent session, so it works for 7
  days after a parent last typed a password, however often hub is used.
- Safari caps the script-set family cookie at 7 days, so on an iPad a child
  meets the parent-password screen about weekly.

**Ed's call:** how long a parent stays signed in on a device. Suggested: 90
days, sliding (each use extends it), by setting `session.expiresIn` and
`updateAge` and passing the refreshed cookie back on tRPC replies. A shared
family tablet staying signed in is the point of the feature; the cost is that
a lost device stays signed in until the parent signs it out.

Not verified: whether Safari also caps the server-set httpOnly cookie.

## Comments

- 2026-11-12 (implementer): built the suggested answer, branched off `main`
  (the epic has merged). `PARENT_SESSION_LIFETIME` in `betterAuth.ts` sets
  `expiresIn` 90 days and `updateAge` 1 day, and the session bridge now asks
  `getSession` for its headers and copies every `Set-Cookie` onto the tRPC
  reply. Checked before and after against `docker compose up family` (row
  aged two days in Postgres) and through hub's UI in Playwright Chromium and
  WebKit; results in ADR 0070's 2026-11-12 amendment, which also records the
  lost-device cost. Differences from the ticket: the relay covers every
  `/api/trpc` reply that carried the cookie, saves included, so a child's save
  also keeps the parent signed in; and a cookie whose session is gone is now
  cleared on the tRPC reply, as `get-session` always did. Still not verified:
  real Safari. Playwright WebKit does not model Safari's cookie caps (it kept
  hub's script-written cookie for its full 30 days), so it cannot answer the
  question. A parent cannot sign out another device; added to ticket 20.
- 2026-11-12 (review fixes): every `/api/trpc` reply is now `Cache-Control:
  private, no-store`, set in the session bridge (ticks the `Cache-Control` half
  of ticket 20's item). New bound-port tests pin that, a save call sliding the
  session, all three cleared cookies arriving as separate headers, and an
  unreachable session store failing the request without touching a cookie.
  Each was shown to kill its mutant. ADR 0070's lost-device note now also
  covers renaming the parent, the current password needed to change it, use
  from CORS-refused origins, and the token not rotating.
