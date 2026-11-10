# 22 - A parent's sign-in lasts 7 days and never extends

**Status:** needs-info
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
