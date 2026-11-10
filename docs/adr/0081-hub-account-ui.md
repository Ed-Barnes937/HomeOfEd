# 0081 - hub's /account: one seam, two protocols, and the refusal a fake could not show

- **Status:** Accepted
- **Date:** 2026-11-09
- **Related:** [ADR 0078](0078-family-identity-auth-boundary.md) (the identity
  boundary these screens must not violate - read it first),
  [ADR 0079](0079-family-save-authorisation.md) (the save half),
  [ADR 0080](0080-boop-is-the-first-savestore-client.md) (the first app to read
  the cookie these screens write), [ADR 0070](0070-family-service.md) (the
  service), [ADR 0057](0057-family-service-legal-gate.md) (the gate on merging
  anything user-facing), [ADR 0012](0012-sprout-app-owned-auth.md) (sprout's
  client-set child cookie, the precedent for setting this one client-side).
  Implements first-slice ticket 06; the design is
  [the first-slice spec](../../.scratch/family-first-slice/spec.md) §6.

## Context

Hub owns the account UI for the whole estate, because hub's origin is the only
one on the family service's identity CORS tier and because no app may ship
another app's UI. These screens are the first and only user-facing surface in
the first slice, and the last buildable ticket of it.

Two things made the work more than a form. The service answers to two
credentials that must not substitute for each other, and the client that talks
to it is hand-rolled over tRPC's HTTP conventions, because `AppRouter` lives in
`apps/family` and no app may import it. The save half had already shown what
that costs: nothing checked `saveClient.ts` against the real router until ticket
07 ran a round trip, and only then did anyone know the envelope was right. A
fake honours the *interface* while diverging on the *protocol*.

## Decision

**1. The identity client lives in `@hoe/accounts` and speaks two protocols, with
zod only over the half whose shapes are ours.** `createFamilyIdentityClient`
covers `identity.me`, `children.list/add/rename`, `mintSessionToken` and
`deleteAccount` over tRPC, and Better Auth's `/sign-up/email`, `/sign-in/email`
and `/sign-out` beside them. The tRPC half has zod schemas here, mirroring the
router's own, and every reply is parsed through them; the Better Auth half is
typed as plain interfaces, because inventing a schema for somebody else's wire
shape asserts a contract we do not own.

One client rather than two, because from a screen's point of view "who is signed
in" and "sign in" are one subject, and because `FakeFamilyClient` then has one
surface to fake. What the split does buy is the reminder in the file itself:
nothing in the client reads or sends a family token, every mutation carries
`content-type: application/json`, and `deleteAccount` sends `{ confirm: true }`
([ADR 0078](0078-family-identity-auth-boundary.md) decisions 1 and 5).

**2. The client is a prop on `<App />`, because there is no live dev sign-in.**
Better Auth runs only in the family service's `main.ts`, so hub's simulator and
the `.iwft` harness have nothing to sign into. `App({ familyClient })` defaults
to the real browser-direct client and the harness passes `FakeFamilyClient`,
which is boop's `saveClient` prop idiom reused rather than reinvented. **No
dev-only "stamp a parent" shortcut was added**; ticket 04 declined to build one
and this ticket had no better reason. A real sign-in needs
`docker compose up family`, and the screens were exercised against exactly that
(below).

**3. The cookie's attributes belong to the caller, and its lifetime belongs to
the token.** `writeFamilySession` / `clearFamilySession` join `readFamilySession`
in `@hoe/accounts`, and hub derives `Domain` and `Secure` from
`window.location.hostname`: a browser refuses `Domain=.homeofed.com` from
localhost outright, so dev and the harness get a host-scoped plain cookie and
production gets the estate-wide secure one the spec fixes. `Max-Age` is computed
from the token's own `exp` rather than a second thirty-day constant, so the
cookie and the claims inside it cannot disagree. A token that cannot be decoded,
or that has already expired, writes **nothing**: a cookie the reader discards is
worse than no cookie, because the UI would then report a session that is not
there.

**4. A Better Auth refusal carrying no `code` takes one from the HTTP status.**
This is the bug the round trip found, and it is the reason the round trip was
required. Better Auth's own refusals answer `{ message, code }` - `401
INVALID_EMAIL_OR_PASSWORD`, `PASSWORD_TOO_SHORT`,
`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. But an `APIError` thrown from its
`hooks.before` middleware - which is exactly how [ADR 0057](0057-family-service-legal-gate.md)'s
invite gate refuses - answers `403 {"message":"A valid invite code is required to
register."}` with **no code at all**. The client mapped that to
`INTERNAL_SERVER_ERROR`, which the screens read as "nothing a person can act
on", so the one sentence a registering parent needs would have been replaced by
"The family service is not answering."

Every automated test passed throughout: the fake invented a code the real
service does not send, so the fake and the client agreed with each other and
both were wrong. The status is now the fallback, and the fake was corrected to
the real shapes.

**5. A typed refusal's message goes on the form; a transport failure's does
not.** `accountErrorMessage` shows a `FamilyClientError`'s own words - "that
username is already taken" is the whole reason that `CONFLICT` is typed - and
falls back to one house sentence for `INTERNAL_SERVER_ERROR`, whose message is a
status code. Nothing on these screens branches on an error code to choose copy,
so a new typed refusal from the service arrives readable without a code change
here.

**6. Signing out and erasing write both query caches rather than invalidating
them.** Invalidating refetches `children` for the tick before the signed-in
panel unmounts, and the service correctly answers 401 - visible in the browser
console, and caught only by watching real network traffic. Removing the query
has the same effect while it is still observed. Writing `{ parent: null }` and
`[]` unmounts the panel with no request, and also stops one household's names
being on screen for the next parent who signs in on a shared device.

**7. The register form asks for a name.** The spec and the ticket say email,
password and invite code, but `/sign-up/email` requires `name` and
`user.name` is `NOT NULL`, and `identity.me` surfaces it - so the parent's name
is already the string the picker and the minted parent token display. Deriving
it from the email's local part would have put "ada" on the screen rather than a
name somebody chose.

**8. The warm-paper palette is a mixin.** `pages/_paperTokens.scss` holds the
light and dark custom properties, and `HomePage.module.scss` now includes it.
The palette stopped being one page's business when `/account` became the second
screen that has to match it. The paper **texture** stayed on the home page: the
account screen is a utility surface and does not need the photographic
treatment, which would otherwise have been twenty-five duplicated lines.

## What the round trip showed

Against `docker compose up family` - the real image, real Postgres, a real
socket - hub's own `createFamilyIdentityClient` ran the whole flow and every
reply shape and typed error matched what the client expects: `me` anonymous
(`{ parent: null }`, a null rather than a refusal), `children.list` anonymous
(`UNAUTHORIZED`, "parent authentication required"), sign-up refused on a wrong
invite code, sign-up accepted and auto-signed-in, sign-out, sign-in refused on a
wrong password (`INVALID_EMAIL_OR_PASSWORD`), sign-in, `children.add`, the
duplicate username (`CONFLICT`, "that username is already taken", with the first
profile surviving), `children.list`, `children.rename`, a minted child token and
a minted parent token - **both decoded by `readFamilySession` with the claims and
the 30-day expiry the spec specifies** - a rename of an id this parent does not
own (`NOT_FOUND`), `deleteAccount` with no `confirm` (400, the parser), the same
as `text/plain` (415, the content-type hook), erasure, and a sign-in after
erasure that fails. Decision 4 is the one thing it contradicted.

The cross-origin half was then run in a real browser on `http://localhost:3000`
against the same image started as development, because the production image
correctly refuses dev origins at the preflight: register, add, the duplicate
conflict, pick a profile, reload, rename, sign out and erase all worked
credentialed and cross-origin, Better Auth's `better-auth.session_token` arrived
httpOnly and host-scoped while `hoe_family_session` arrived readable by script
with `SameSite=Lax`, `Path=/` and a 30-day expiry, and the pick survived a
reload. The only non-2xx response left in the trace is the 409 the duplicate
test asks for.

**9. The identity router binds to the contract, and the contract had to split to
let it.** This was first recorded as a consequence to fix later; it is a decision
because the bug in decision 4 is its argument. The save router `satisfies
FamilySaveContract` and takes its input schemas from `@hoe/accounts`, which is
what stops that contract, its client and its fake drifting; the identity half had
no such binding, so its schemas were held honest only by a round trip somebody
had to remember to run - the same class of failure decision 4 cost an afternoon
to find by hand.

Binding it surfaced a real mismatch rather than a cosmetic one: **three of the
nine methods are not tRPC procedures at all**, so no router could implement
`FamilyIdentityContract` however it was written. The contract therefore splits
into `FamilyIdentityRouterContract` (the six procedures, which `router.ts` now
satisfies through `identityContractFor`, mirroring `saveContractFor`) and
`FamilyAuthContract` (Better Auth's three), with `FamilyIdentityContract`
extending both for the clients that speak both. The identity handlers also take
their input and output types from `@hoe/accounts` and the router its zod schemas,
as the save handlers already did - the four schemas moved byte-for-byte, so the
wire did not change.

The binding was then checked by breaking it on purpose rather than by reasoning
about variance, which is the same discipline the round trip exists for. Dropping
`email` from `MeHandler`'s result, and renaming `username` to `handle` in the
contract, each fail `apps/family`'s typecheck: `TS2741` on the handler and
`TS2345` plus three red identity tests respectively. Both were reverted.

**10. A server message is not assumed to be prose, and the fake now runs the
validators that proved it.** Decision 5 said a typed refusal carries words
written for a person. That is true of the domain refusals and false of tRPC's
**validation** refusals, whose message is a stringified zod issue array - so a
parent typing a 33-character nickname, a plausible first action on this screen,
got a dump of zod internals where the sentence belongs. The CSRF guard's 415
carries a developer's sentence about content types and would have been shown
verbatim too.

Fixed on three sides, of which the third is the one that matters:

- The name fields carry the contract's own `maxLength` and refuse a blank or
  whitespace-only submit, which stops the common case in the browser. Measured
  rather than assumed: a `fill` of 33 characters is **cut to 32** and succeeds,
  so the server validator is no longer reachable from this form at all.
- `accountErrorMessage` treats `BAD_REQUEST`, `UNSUPPORTED_MEDIA_TYPE` and
  `INTERNAL_SERVER_ERROR` as unactionable, **and** falls back for any message
  that opens as `[` or `{` whatever code carried it. The code list can only name
  refusals somebody thought of, so it fails open; the shape check does not.
- **`FakeFamilyClient` now parses every input through the contract's own zod
  schemas and enforces the save quotas from one shared definition.** Without
  that no test could see any of this, which is exactly why every test passed.
  The sharpest instance: the real schema trims and the fake did not, so `' Ada '`
  stored as `'Ada'` in production and `' Ada '` in the harness.

This is the fifth time in this epic that a stand-in honoured the interface and
diverged on the real thing, and the habit behind all five is now written down in
[`packages/backend-kit`'s README](../../packages/backend-kit/README.md#a-stand-in-models-the-happy-path-somebody-has-to-make-it-model-the-rest)
rather than left for the next person to rediscover: a fake owes you the input
parser and the limits, not only the outputs and the errors.

## Consequences

**`identity.children.delete` is outside the contract**, because no client speaks
it and a procedure no client calls cannot drift against one. It is wired directly
in `router.ts` with that reason written beside it, and the contract says to add
it the moment anything calls it. That is the one procedure the binding in
decision 9 does not cover. (**Amended 2026-11-10, below:** hub now calls it, so
it is in the contract and bound like the rest.)

**`identity.children.delete` has no UI.** The router has it; the ticket listed
list, add and rename only. So a parent who mistypes a username cannot remove
that profile - only rename its display name, since `username` is not editable
either. Recorded rather than built, because deleting a profile also deletes its
saves and the confirm copy for that is a product decision. (**Amended
2026-11-10, below:** both are now built.)

**Nothing links to `/account` yet.** (**Amended 2026-11-10, below:** the estate
gate and every gated app's switch-player link now send visitors here with a
`returnTo`.) Entry is boop's "synced as X" chip and the
URL. A card or a link on hub's home page is a one-line change, but hub's home
surface is sequenced outside epic branches, so it is not here. (**Amended
2026-11-10:** hub's home page now carries a chip beside the theme toggle,
"Playing as {name}" from `readFamilySession()` or "Sign in", linking to
`/account`; estate-gate ticket 07.)

**[ADR 0057](0057-family-service-legal-gate.md) is still Proposed.** Spec §10
gates merging anything user-facing on it being accepted, and this is the whole
of the user-facing surface. The work is committed to the epic branch; the merge
is the human's.

**Two latent edges were closed rather than left for a future reader.**
`unwrapTrpcResponse` tested for `error` and `result` keys, but a batched tRPC
reply is an *array* carrying neither, so every reply would have become an
opaque 500 the moment somebody added `?batch=1` to save a round trip. It now
refuses a batched reply by name. And `listChildProfiles` ordered by `createdAt`
alone, which leaves two profiles created in one millisecond in an order Postgres
does not promise; `id` is now the tiebreak, and the fake sorts by the same two
keys so both sides agree.

**The register form can meet a rate limit.** Better Auth rate-limits its own
endpoints in production, and a 429 was seen during probing. It arrives as a
typed `TOO_MANY_REQUESTS` and its message reaches the form, so it degrades to a
sentence rather than a crash; no retry or countdown was built.

## Amendment (2026-11-10): a parent can delete a profile and correct its username

The consequence above left a parent who mistypes a child's username with one way
out: erasing the whole household. Both halves of the fix are now built.

**What `username` is for decided the second half.** Nothing but the parent reads
it. It is the `@handle` on hub's profile list and the per-household
`child_profiles_parent_username_unique` constraint, and that is all: children
never sign in, the family token carries `sub` (the profile id) and `name` (the
display name) and no username, boop reads only those claims, and every save row
is keyed by `accountId`, which for a child is the profile **id**. So a username
can change without anything downstream noticing.

**Deleting and re-adding does not cover a typo.** `deleteChildProfile` takes
every save the profile owns with it, in one transaction, on purpose. A typo is
as likely to be noticed after the child has played as before, and then
delete-and-re-add trades a cosmetic fix for the child's saves. A cosmetic
mistake should have a cosmetic fix, so the username is editable.

1. **`renameChild` takes an optional `username`**, rather than a new procedure.
   One form edits both names, so one atomic update serves it, and a clash is the
   same typed `CONFLICT` ("that username is already taken") from the same
   constraint, now mapped on the store's update path as it already was on the
   insert path. Optional, so an absent username is left alone. That also means
   no deploy order breaks a rename: an older hub sends no username, and an older
   service strips the unknown key, so until family catches up a username edit
   saves the display name and quietly leaves the username as it was.
2. **`identity.children.delete` joins the contract.** Its input schema moved
   unchanged from the handler into `@hoe/accounts`, the router binds it through
   `identityContractFor` like every other procedure, and the fake enforces the
   same parent scoping (`NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`), the uuid
   parser and the saves erasure.
3. **Deleting a profile takes a confirm step**, in the row, matching the
   household erase: "This removes Robin's profile and everything the apps have
   saved for it. It cannot be undone." with "Yes, delete Robin" and "Keep
   Robin". The edit form replaces the old rename form and carries both names.
4. **Deleting the profile playing on this device clears the family cookie
   here.** Otherwise the device keeps a valid token for a profile that is gone,
   and keeps saving to it.

**Left open:** decision 4 covers this device only. A child token is verified
offline and lives 30 days, and the save router does not check that the profile
behind it still exists, so another device still playing as a deleted profile can
write new save rows under its id. Nothing can reach or erase those rows
afterwards; `deleteAccount` erases only the ids of profiles that still exist.
The same was already true of a household erase. The fix belongs to the save half
([ADR 0079](0079-family-save-authorisation.md)) and is ticket
[`10-deleted-profile-tokens`](../../.scratch/family-first-slice/issues/10-deleted-profile-tokens.md).

## Amendment (2026-11-10): `/account` sends a visitor back where they were going

The estate gate (ADR 0093) makes `/account` the front door of every gated app: a
signed-out visitor arrives as `/account?returnTo=<url>`, often with the app's
share fragment on hub's URL. The screens above are unchanged in what they do; two
things are added, both in
[ADR 0095](0095-hub-return-and-renewal.md):

1. **A pick returns.** When `returnTo` passes `safeReturnTo`, picking who is
   playing writes the cookie as before, checks the browser kept it, and then
   replaces the page with `returnTo` plus the fragment it arrived with, byte for
   byte. Sign-in and registration never leave the page, so the arrival URL hub
   captured at load is still the one in use. Without a valid `returnTo` the pick
   stays here, exactly as before.
2. **"Open what was shared"** shows whenever nobody is signed in and a fragment
   came along, including while the family service is loading or down, linking to
   the app's ungated `/shared` view.

The return lives in one function, `returnToApp(written)` in
`features/account/returnTo.ts`; the cards call it and nothing else in them knows
about returning.

## Amendment (2026-11-10): when each profile last saved

Estate-gate spec decision 12 makes `/account` the only place a parent learns
whether syncing works, so the screens now show, per account and app, one line
such as "boop: saved 2 days ago", from `identity.saveSummary` (ADR 0079,
amended). Estate-gate ticket 08.

1. **Each line sits under whoever saved.** A child's lines go in its row in the
   child profiles card; the parent's own go under "Signed in as", because the
   parent has no row in that card. One query (`familyQueryKeys.saveSummary`,
   the shared stale time) serves every row.
2. **Quiet by construction.** No line for an account with no saves, nothing
   while loading, and nothing on a failed read, after the default retries: a
   parent cannot act on an error here, and the screens around it must not look
   broken because a status line could not load. No warning styling either;
   staleness is the signal. The lines use `--muted`, not `--faint`, since this
   is the one place the information appears.
3. **The wording is coarse on purpose:** just now, then whole minutes, hours,
   days up to 59, months, years (`features/account/lastSaved.ts`). A save
   stamped ahead of the device's clock reads "just now".
4. **Signing out writes `[]` into the summary's cache**, alongside `children`
   and `me` (decision 6), so the next parent on a shared device never sees the
   previous household's times.
