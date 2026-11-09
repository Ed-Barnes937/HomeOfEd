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
have changed. Nothing in the play path calls into sync, so no edit, save or
render can await it, be slowed by it, or throw through it, and `persistence/`
does not know it exists. It also makes sync write-source agnostic: the working
grid's autosave, a save into "My boops", a rename and a delete all reach the
account by the same route, with no writer needing to announce itself. The cost
is a few seconds of latency and one `getItem` every five seconds, against a
dependency-free play path. That is the trade this ticket exists to make.

**2. A device may only overwrite the account with a document it has already
merged the account's own into.** A put is an unconditional LWW overwrite of the
whole slot ([ADR 0070](0070-family-service.md)), so a device that has never seen
the other device's boops must not be allowed to replace them. The push watcher
is therefore armed only by a **successful** pull: boop starting up offline
pushes nothing for that session, which costs a delayed copy and protects every
boop the family already has.

**3. The merge is a union with one honest hole, and no tombstones.**
`mergeSaveDocuments(local, remote)` takes the account's creations, then the
creations only this device holds, deduped by deep equality of `StoredBoop`;
`working` is local when there is one, else the account's. It is idempotent, and
duplicates *within* the local list survive on purpose - two identical rows in
"My boops" are two rows a child saved. The accepted limits are that `working` is
genuinely last-writer-wins, and that a boop deleted on one device reappears
from the other, because a union cannot tell a delete from a never-seen. Fine for
a household; a tombstone list is the thing not to build until it bites.

**4. The pull re-reads localStorage after the request answers, not before.** A
lull can end while `save.get` is in flight, and that autosave is fresher than
anything read before it. Reading local only once the reply is in hand shrinks
the window in which a pull could write a stale working grid to nothing a child
can hit.

**5. boop pushes the save document, not the bytes under the key.** Both sides of
every comparison, and the blob that goes up, are re-serialized through
`serializeSaveDocument`, so a corrupt or foreign value under `boop:save` cannot
travel to the family's other devices. The spec said "the exact localStorage
value", which this is in every real case, since `storage.ts` writes exactly that
serialization; the difference only shows for bytes boop itself would read as
empty.

**6. Failures are outcomes, and a refusal is not retried until the bytes
change.** Every call is wrapped; neither `reconcile` nor `pushIfChanged` can
reject. The watcher tracks the last *attempted* push, not the last successful
one, so a permanent refusal - a slot over the save router's 256 KiB cap, which
arrives as a typed 400 ([ADR 0079](0079-family-save-authorisation.md) decision 5)
- is absorbed once and then left alone until the child changes something. A
transient failure retries on the next change, which is the spec's contract.
Nothing about any of this reaches the screen: a child must never be told the
network is sad, and a parent being told is a product decision nobody has taken
(see the open question below).

**7. The marker is a list of accounts, and the offer is not a confirm.**
`boop:syncedAccount` holds the account ids this device has already been offered
the import for - a list, because a family tablet is shared and a second child
signing in on it is a first link of their own. It is a new additive key; the
frozen `boop:save` v1 ([ADR 0025](0025-boop-save-format.md)) is untouched, and a
corrupt marker reads as "not offered yet", which only ever costs a second offer.
The offer itself is `ImportOfferCard`, which borrows `ConfirmCard`'s geometry
but not its buttons: the shared confirm shape colours its second choice as the
destructive one, and nothing here is destructive - the boops stay on the device
whichever answer a parent gives. Declining stamps the marker and runs no pull,
so nothing leaves the device that session.

**8. The chip is chrome, and the phone's chip is a menu entry.** "synced as
{name}", linking to the hub's `/account`, sits after the saved-state words on
the laptop bar at the same quiet end of the ink scale. The phone's 52px strip is
full (back, wordmark, save, "⋯"), so the phone gets a menu entry instead - the
menu being where every action the phone chrome drops already lives. Nothing
else in boop's UI changes.

## Consequences

**Declining is weaker than it sounds, and this is the open question.** The
marker records that the offer was answered, not how. A declining device is still
linked, so its *next* start pulls, merges and - because the merge is a union -
pushes the very boops the parent declined to upload. Implemented as the spec
states it; whether decline should instead mean "sync is off for this account on
this device" is Ed's call, and the honest answer today is that decline delays
the upload by one session rather than preventing it.

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

**No round trip has crossed a socket yet.** Every test here injects
`FakeFamilyClient`; nothing in this ticket proves boop against a live family
service, which needs the docker stack and a cookie session only
`docker compose up family` can produce
([ADR 0079](0079-family-save-authorisation.md) already records that gap). Go-live
(ticket 08) is where a real boop meets a real slot.
