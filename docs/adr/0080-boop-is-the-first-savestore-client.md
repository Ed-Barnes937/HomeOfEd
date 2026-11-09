# 0080 - boop syncs by watching its own localStorage, and only ever copies

- **Status:** Accepted
- **Date:** 2026-11-09
- **Related:** [ADR 0070](0070-family-service.md) (the family service and the
  SaveStore it offers), [ADR 0079](0079-family-save-authorisation.md) (what the
  save router authorises and the caps it enforces),
  [ADR 0025](0025-boop-save-format.md) (the frozen `boop:save` document, which
  this does not touch), [ADR 0031](0031-boop-saved-state-visibility.md) (boop
  never warns a child about losing work, because nothing is lost). Implements
  first-slice ticket 07; the design is
  [the first-slice spec](../../.scratch/family-first-slice/spec.md) §7.

## Context

boop is a toy a six-year-old plays with, and it has never needed a network for
anything but its own assets. The family SaveStore offers it something real - a
boop made on the tablet turning up on the phone - at the price of a dependency
that can be down, slow, or answering with nonsense.

The governing requirement is therefore narrow and absolute: with the family
service unavailable in any way, boop must behave **exactly** as it does today. No
error, no blocking spinner, no lost pattern. That rules out any design where a
local write waits on, or routes through, a remote one.

The spec also asks for a first-link offer - "keep these boops on your account?"
- and describes declining as "stamps the marker without pushing". Taken
literally that is a marker recording only *that* an answer was given, which
cannot tell an acceptance from a refusal: the next start reads it as "this
device is linked", pulls, merges and - because the merge is a union - pushes the
very boops the parent declined. A parent who says no and finds the boops on the
account next session has been misled, and that it takes a session to happen
makes it worse, because they have no reason to look again. The shorthand was
shorthand for an intent it does not deliver, and the intent is not ambiguous.

One bound on that offer, as context rather than a decision: it can only appear
once a parent has signed in on hub and picked who is playing, so a child meeting
it unprompted means a parent set them up minutes earlier. That bounds the
tension with [ADR 0031](0031-boop-saved-state-visibility.md)'s "boop never puts
a card in front of a child unasked" without resolving it; the weighing is Ed's.

The spec (§7.1) says to piggyback the autosave flush. The autosave has no seam
to piggyback on: `useWorkingSong` builds its `createAutosave(window.localStorage)`
itself, and `persistence/` is deliberately out of scope for this ticket - it is
the one module that must keep working if everything else here is deleted. And
the autosave is not the only writer anyway: "My boops" saves, renames and
deletes write the same document from `BoopsPanel`.

## Decision

**1. Sync observes; it is never called.** `apps/boop/src/sync/` reads the one
`boop:save` key on a 5s timer (longer than the autosave's 2s lull) plus the
`pagehide`/`visibilitychange` hide, and copies the document up when its bytes
have changed. The hide-time push only delivers because the client's fetch sets
`keepalive`: a request started from `pagehide` is otherwise cancelled with the
document, which would have made that listener, and the registration order it
depends on, worth nothing. `keepalive` carries a 64 KiB body budget per page
against a 256 KiB slot cap, so `keepaliveFetch` measures the body in bytes and
falls back to a plain fetch above it rather than failing at the browser. Nothing in the play path calls into sync, so no edit, save or
render can await it, be slowed by it, or throw through it, and `persistence/`
does not know it exists. It also makes sync write-source agnostic: the working
grid's autosave, a save into "My boops", a rename and a delete all reach the
account by the same route, with no writer needing to announce itself. The cost
is a few seconds of latency and one `getItem` every five seconds, against a
dependency-free play path. That is the trade this ticket exists to make.

**2. A device may only overwrite the account with a document it has already
merged the account's own into, and "I cannot read this" does not count as
having read it.** A put is an unconditional LWW overwrite of the whole slot
([ADR 0070](0070-family-service.md)), so a device that has never seen the other
device's boops must not be allowed to replace them. The push watcher is armed by
a pull whose **merge** completed - not by the put that follows it, which may
fail transiently and must not cost the device a whole session of pushing.

The hole this rule had, and the reason it needs stating at all, is that
`parseSaveDocument` is total but all-or-nothing: an unknown `version`, or one
creation this build cannot decode, yields the same empty document as an empty
one. "localStorage holds something I cannot read" and "localStorage holds
nothing" were therefore indistinguishable, on **both** sides of the wire - a
remote document that read as empty made the union equal to local, which differs
from an empty remote, so it pushed and armed. The trigger is ordinary: a toy
left open on a tablet across a deploy, a tab predating
[ADR 0032](0032-boop-save-format-songs.md)'s comma form, or any future
`SAVE_FORMAT_VERSION` bump, after which a v1 device would clobber a v2 account
every five seconds.

So **a document that is present but reads as empty is never acted on**: not
pushed, not written over, and it does not arm anything. A slot that is absent
still means "the account has nothing", which is the ordinary first-device case;
a slot that is there and reads as empty means "this build cannot read the
account", and the session ends without syncing.

**3. The merge is a union with one honest hole, and no tombstones.**
`mergeSaveDocuments(local, remote)` takes the account's creations, then the
creations only this device holds, deduped by deep equality of `StoredBoop`;
`working` is local when there is one, else the account's. It is idempotent, and
duplicates *within* the local list survive on purpose - two identical rows in
"My boops" are two rows a child saved. The accepted limits are that `working` is
genuinely last-writer-wins, and that a boop deleted on one device reappears
from the other, because a union cannot tell a delete from a never-seen. Fine for
a household; a tombstone list is the thing not to build until it bites. A rename
is the commoner face of the same limit - see the consequences.

**4. The pull re-reads localStorage after the request answers, not before.** A
lull can end while `save.get` is in flight, and that autosave is fresher than
anything read before it. Reading local only once the reply is in hand shrinks
the window in which a pull could write a stale working grid to nothing a child
can hit.

A consequence of that ordering, worth stating plainly because §7.2 reads like a
feature with a limit: **the account's `working` grid essentially never reaches a
device.** `useWorkingSong` restores or seeds a working song, and its autosave
writes one, before the pull's post-await read happens, so local is non-null by
then and wins. `working: local ?? remote` is therefore the shape of a rule whose
right-hand side is unreachable in practice. What syncs is the "My boops" list;
the working grid is per device, and the LWW limit on it is theoretical.

**5. boop pushes the save document, not the bytes under the key.** Both sides of
every comparison, and the blob that goes up, are re-serialized through
`serializeSaveDocument`, so a corrupt or foreign value under `boop:save` cannot
travel to the family's other devices. The spec said "the exact localStorage
value", which this is in every real case, since `storage.ts` writes exactly that
serialization; the difference only shows for bytes boop itself would read as
empty - and that set is not only corruption. It includes another device's
*newer* document, which is exactly why decision 2 refuses to act on one rather
than merely declining to forward it.

**6. Failures are outcomes, and a refusal is not retried until the bytes
change.** Every call is wrapped; neither `reconcile` nor `pushIfChanged` can
reject. The watcher tracks the last *attempted* push, not the last successful
one, so a permanent refusal - a slot over the save router's 256 KiB cap, which
arrives as a typed 400 ([ADR 0079](0079-family-save-authorisation.md) decision 5)
- is absorbed once and then left alone until the child changes something. A
transient failure retries on the next change, which is the spec's contract.

**One request is in flight at a time**, for the same reason: a backgrounding
pushes, then the close pushes the bytes the autosave flushed on its way out, and
two puts racing can land the older document last with nothing left to correct it
- `lastAttempted` already names the newer one. The calls are queued in call
order, which also sequences the double `reconcile` a dev double-mount makes.

Nothing about any of this reaches the screen: a child must never be told the
network is sad, and a parent being told is a product decision nobody has taken
(see the open question below).

**7. The marker records the answer, and `declined` means no sync at all.**
`boop:syncedAccount` maps an account id to `'accepted' | 'declined'` - per
account, because a family tablet is shared and a second child signing in on it
is a first link of their own. A declined account gets nothing on this start or
any later one: no pull, no push, no watcher, no chip, and no second offer. The
gate is in `useBoopSync`, which is the one place that reads an answer, and the
guarantee is pinned at the app level rather than at the seam: the test that
matters decides the question on the *second* start, after a reload, and asserts
both that the account is still empty and that boop made no call at all.

An answer is recorded rather than a boolean so that changing one's mind is a
write, not a migration: `recordSyncAnswer(storage, id, 'accepted')` already
expresses the transition. **How** a parent reaches it is a product decision that
has gone to Ed and is deliberately not built. If it wants a home, the phone's
"⋯" menu and the laptop bar's chip slot are where a declined account's "keep
these on your account" would sit, since that is exactly the space the chip
occupies once an account is accepted - a suggestion, not a decision.

It is a new additive key; the frozen `boop:save` v1
([ADR 0025](0025-boop-save-format.md)) is untouched. Decode stays total and
forgiving: a corrupt marker, or an answer this build does not know, reads as
"not asked yet", which costs a second offer and can never cost a boop, and the
marker's first shape - a plain list of account ids - reads as `accepted`,
because only accepting could have written it.

**8. The offer is not a confirm.** `ImportOfferCard` borrows `ConfirmCard`'s
geometry but not its buttons: the shared confirm shape colours its second choice
as the destructive one, and nothing here is destructive - the boops stay on the
device whichever answer a parent gives.

**9. The chip is chrome, and the phone's chip is a menu entry.** "synced as
{name}", linking to the hub's `/account`, sits after the saved-state words on
the laptop bar at the same quiet end of the ink scale. The phone's 52px strip is
full (back, wordmark, save, "⋯"), so the phone gets a menu entry instead - the
menu being where every action the phone chrome drops already lives. Nothing
else in boop's UI changes.

## Consequences

**A declined device is a device with no way back, by design for now.** Nothing
in boop can turn an account from `declined` to `accepted`; a parent who changes
their mind has to be given a control that does not exist yet (decision 7). The
state model holds the transition, so building it later is UI over a write.

**A rename makes a permanent duplicate on every device.** Dedupe is full deep
equality of `StoredBoop`, so renaming a boop on one device produces a creation
the other device's list does not hold, and the union keeps both: "Boop 3" and
"dinosaur stomp", same pattern, forever. It is the same hole as the resurrecting
delete and a commoner action, and like that one it is accepted rather than
fixed, because identity for a creation would have to be a new field in a frozen
format.

**One `boop:save` per device, one marker per account, so a shared tablet pools
its children's work.** The save document is the device's, not the profile's, so
a second child accepting the offer on the family tablet copies the first child's
whole "My boops" list onto their own account, and from there onto their own
devices. Every account on a shared device converges on the union of every
sibling's boops. Nothing here distinguishes whose boop is whose, and nothing
could without a per-profile document, which is a bigger change than this slice.
Recorded and sent to Ed, because it is privacy-shaped rather than merely
surprising.

**A session that starts offline stays unsynced until the next start.** The pull
runs once, at app start (spec §7.1). Retrying it on the watcher's tick would
turn an unreachable service into a request every five seconds for the life of
the page, so it does not. boop is reloaded often enough that this costs little.

**A pull's new boops appear in "My boops" when the panel is next opened.**
`BoopsPanel` mounts on open and reads the document then, so nothing had to be
re-plumbed; a panel already open when a pull lands shows the older list until it
is closed and reopened. No live subscription to localStorage was added for it.

**boop now carries zod into its bundle**, through `@hoe/accounts`'s save
contract. The contract is the type authority for a hand-rolled client
([ADR 0079](0079-family-save-authorisation.md)), so the dependency comes with
the package rather than with this ticket; it is noted here because boop is the
first app to pay it.

**`@hoe/accounts/testing/fake` is a new subpath.** The testing index also
exports `mintTestToken`, which pulls `node:crypto`, so boop's browser-side
`.iwft` harness cannot import the index. The subpath is the browser-safe half;
the index stays as it is for Node-side callers, which is where the minter
belongs.

**The family app was not touched.** boop's origin is already in the save tier's
CORS allowlist (`ONBOARDED_APPS`), the client sends
`content-type: application/json` on every mutation as
[ADR 0078](0078-family-identity-auth-boundary.md) decision 5 requires, and
`appId: 'boop'` is already the allowlisted one.

**The wire was checked against the real service, not only against the fake.**
Every automated test here injects `FakeFamilyClient`, and because every failure
is swallowed by design, a wholly broken wire would look exactly like today's
boop - so nothing in the suite could tell us. Against `docker compose up family`
(the real image, real Postgres, real socket), by hand: boop's own
`createFamilySaveClient` put and got a save document byte-identically, the
version incremented, `list` reported it, `delete` cleared it, and both refusals
boop can meet - the 256 KiB slot cap and an unonboarded `appId` - arrived as
`FamilyClientError` with `code: 'BAD_REQUEST'` and a message naming the limit,
with the stored slot surviving the refusal. The hand-rolled envelope in
`saveClient.ts` (`?input=` with no `batch=1`, `result.data` unwrapped by hand,
`error.data.code` read off the error) matches what the service actually sends.

The cross-origin half was checked in a real browser on `http://localhost:3008`:
the credentialed put and get both succeeded and the blob read back identically,
a `text/plain` put was refused 415 by the CSRF hook
([ADR 0078](0078-family-identity-auth-boundary.md) decision 5), and - the part a
fake cannot show - a **quota refusal is readable cross-origin**, so boop gets
the typed error rather than an opaque "Failed to fetch". Two notes for ticket 08:
the production image correctly refuses `http://localhost:3008` at the preflight
(dev origins exist only outside `NODE_ENV=production`, so the browser leg was
run against the same image started in dev mode), and tRPC includes a stack trace
in that error body outside production, which is another reason the Fly machine
must run as production.
