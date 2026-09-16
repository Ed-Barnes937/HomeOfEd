# 03 - Options paper: the account layer

**Status:** resolved
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

## Answer

Written 2026-09-06 against the resolved inventory (ticket 01), the cost
baseline (ticket 02), the source ticket (`.scratch/account-layer/issues/01`),
and ADRs 0001/0008/0012/0013/0025/0029 plus sprout ADR-0019. Planning only.

### Framing: what the inputs actually constrain

Three facts from tickets 01/02 shape every option more than cost does:

1. **The integration seam already exists and is universal.** Every app carries
   `ctx.auth: AuthProvider { getUser(): User | null }` (backend-kit
   `context.ts:7`), null everywhere except sprout. ADR 0008 already commits to
   "a central identity service issuing tokens that apps verify through
   `ctx.auth`", and ADR 0012 records sprout's swap path: central auth arrives
   as a new `AuthProvider`; handlers do not change. Sprout's child token
   proves in-repo that verification can be secret-only, no DB round-trip - so
   stateless apps can consume identity without growing a database.
2. **Money is not the decider.** The whole estate is ~$13/mo. A new
   scale-to-zero 512MB app adds ~$0.08/mo stopped, $3.32/mo always-on; a new
   logical DB in the existing `hoe-pg` node is ~$0 marginal (volume growth at
   $0.15/GB). Every option below fits inside a fiver a month. The real costs
   are wiring, blast radius, and the legal gate.
3. **"Account layer" today means: identity + syncing small-to-mid localStorage
   documents.** Outside sprout there is no server-side per-user data at all.
   The payloads are boop `boop:save` (a few KB, one frozen key, versioned
   inside the value, total decode - ADR 0025/0032), silt scenes (~240KB/scene,
   ~5MB ceiling, multi-key layout - ADR 0029), espy `espy:doodle:v2` (KBs, up
   to low MBs with a baked raster), karesansui `karesansui:presets:v2` (KBs),
   fridge `fridge:v1` (KBs), plus theme/settings keys not worth syncing.
   Waiting consumers: boop clip persistence (`.scratch/boop-clips/issues/02`)
   and recorded sounds (`.scratch/boop-recorded-sounds/issues/01`, which
   explicitly needs a BlobStore-shaped home).

One structural note that applies to A, B, and C alike: because no app may
import another app (hard rule 1), the client half is a **`packages/accounts`
package in every option** - the `AuthProvider` that verifies tokens, the typed
contract, and any save-client. The options differ in what the *backend* is and
where saves live, not in whether the package exists.

### Option A - Extract sprout's accounts into a central identity app

**What it is.** Pull Better Auth's four tables (`user`/`session`/`account`/
`verification`) plus the parent/child model (`children`, `devices`, the child
token) out of sprout into a new `apps/accounts` service. Sprout becomes the
first consumer via a new `AuthProvider`; other apps follow.

**Goal fit.** Delivers parent+child identity everywhere in one move, and it is
the only option that starts from a battle-tested child model (PIN devices,
lockouts, ownership guards). It delivers *no save storage* - each app would
still need somewhere to put saves (so A must be paired with B's or C's answer
to storage; A is an identity-source decision, not a complete design).

**Hard-rules fit.** Clean at the seam: consumers get a `packages/accounts`
`AuthProvider` verifying a signed token (the `childToken.ts` pattern
generalised), no DB needed in consuming apps (ADR 0008 preserved). The
extraction itself is the problem: sprout's schema is one merged migration
journal where `children.parentId` is a real FK to `user.id` with cascade
erasure (ADR 0012 D2). Splitting `user` out of sprout's DB breaks the FK and
the clean-erasure story, and forces a cross-service erasure protocol on day
one.

**Cost on Fly.** One new app. It sits on the login path for sprout (whose web
machine is always-on), so realistically always-on: +$3.32/mo, plus a logical
DB in `hoe-pg` (~$0).

**What it does to sprout.** Major surgery on the estate's most sensitive app:
schema split, data migration of real family accounts, re-pointing Better Auth,
and re-testing the entire authz surface - all inside ADR-0019's blast radius
("any account layer that touches sprout registration or shares sprout
identities is inside this gate's blast radius").

**Honest downsides.**
- The *model* is sprout-shaped by design (inventory verdict): NOT NULL legal
  attestation columns, `mustChangePassword`, behavioural lockouts,
  PIN-on-device. Generalising it means either dragging safeguarding product
  decisions into the shared layer or forking the model during extraction -
  the worst of both.
- Every app's login now inherits sprout's open legal gate: shared `user`
  table means "a boop account" is "a sprout account", and opening
  registration for boop *is* the release ADR-0019's gate protects.
- Largest possible first step; the app with the most to lose moves first.
- ADR 0012 deliberately did not ask for this: its recorded migration path is
  "central auth becomes a third AuthProvider" - i.e. sprout *consumes* a
  central service later; it never promised sprout's tables would *become* it.

### Option B - `packages/accounts` + a new minimal identity backend; apps keep their own save storage keyed by account id

**What it is.** A fresh, small identity service (new `apps/id` or similar):
parent email+password accounts (Better Auth, stock tables, no sprout columns)
plus child profiles (username, display name, `parentId` - no email). It mints
signed tokens; `packages/accounts` ships the verifying `AuthProvider`. Each
app that wants portable saves opts into a DB and stores rows keyed by the
account id from `ctx.auth`.

**Goal fit.** Fully satisfies the goal, app by app. But the per-app price is
real: boop, silt, espy, and karesansui are all currently stateless, so each
one that syncs saves pays the full DB conversion (schema, migrations, Store,
`release_command`, compose DB service, `fly postgres attach` - the exact tax
ADR 0008 exists to avoid), and each becomes exposed to the known Fly
release-machine flake on every deploy.

**Hard-rules fit.** Textbook: leaf apps, package-only sharing, each app owns
its schema/Store (ADR 0001 §7), saves ride each app's own tRPC. The only rule
it strains is ADR 0008's *spirit* - "stateless is the baseline" quietly stops
being true for any app with saves, and "auth does not imply a DB" becomes
"but sync does, times N".

**Cost on Fly.** Identity app scale-to-zero (~$0.08/mo stopped; a cold start
of a couple of seconds on first login is acceptable for a login) or $3.32
always-on. Per-app logical DBs in `hoe-pg` ~$0. Cheapest infra, most wiring.

**What it does to sprout.** Nothing, until sprout chooses to swap its parent
auth onto the central service via its recorded AuthProvider path. Sprout's
gate stays scoped to sprout.

**Honest downsides.**
- N copies of persistence plumbing and N save-sync implementations, each with
  its own quota/conflict decisions; silt would hand-roll blob storage that C
  gives everyone.
- Migration/conflict logic (localStorage import, two-device writes) gets
  re-decided per app instead of once.
- The recorded-sounds consumer needs a BlobStore; under B that lands as
  boop-specific blob storage, which the next audio-wanting app re-builds.

### Option C - Central identity AND a central save-data service (SaveStore)

**What it is.** Option B's identity service plus a generic save service:
opaque, versioned blobs keyed `(appId, accountId, slotKey)` with sizes/quotas,
nothing app-shaped server-side. Apps stay stateless (ADR 0008 fully
preserved); the save formats stay exactly the localStorage documents apps
already write (versioned inside the value, total decode - ADR 0025/0029
transfer as-is). Identity and saves can be one app or two; at this scale one
app ("family" service) with two routers is simpler, and splitting later is
the normal ADR 0001 §3 escape hatch.

**Goal fit.** Best fit per unit of wiring. A kid's boops, scenes, doodles,
and presets sync everywhere; a new app gets portable saves by adding one
`slotKey`, no DB. The recorded-sounds BlobStore need lands here naturally
(the `BlobStore` interface already exists in backend-kit).

**Hard-rules fit.** Two workable wirings, worth naming because they differ on
a rule:
- *(i) Proxy through each app's backend*: app handlers depend on a `SaveStore`
  interface; prod impl calls the save service over the Fly private network
  (flycast + shared secret - the ADR 0013 sprout-pipeline pattern); fakes in
  dev/simulator. Purest DI, but every save wakes the app's stopped machine
  and adds a hop.
- *(ii) Browser talks to the save service directly*: the SPA calls
  `save.homeofed.com`'s own tRPC with a `.homeofed.com`-domain session; the
  contract types live in `packages/accounts` (no cross-app import - the
  `@hoe/sprout-shared` precedent). "All data through tRPC" is still honoured
  (it is the save service's tRPC + DI seam); what changes is that saves no
  longer pass through the owning app's handlers at all. App machines stay
  stopped.
Either way handlers/authz derive identity from `ctx.auth` only, sprout-style.

**Cost on Fly.** One new scale-to-zero app (~$0.08/mo stopped, $3.32 if kept
always-on) + one logical DB. Storage is the only line that grows: silt at the
5MB/user ceiling times ~100 users is ~500MB - noticeable against `hoe-pg`'s
current 1GB volume, but volume growth is $0.15/GB/mo, i.e. pennies.

**Hosting under ticket 04's consolidation options** (stated because a
consolidation that ignores this gets redone): *status quo* - it is simply one
more Fly app; *one host app* - one more process behind the router, and the
always-on host incidentally solves login cold-starts for free; *middle
ground* - it belongs on the consolidated DB-backed machine. No option is
blocked by any ticket 04 outcome; C is hosting-agnostic.

**What it does to sprout.** Leaves it alone. Sprout later swaps its *parent*
Better Auth for the central service via ADR 0012's recorded path if and when
that is worth it; sprout's conversations/safety data never move into the
SaveStore (it is real relational data with retention workers, not a blob).

**Honest downsides.**
- A central service is a single point of failure for every app's saves (reads
  should degrade to the localStorage copy - see migration below - but sync is
  down when it is down).
- "Opaque blob" discipline must be defended; the day the service grows
  app-aware queries it becomes a shared-schema coupling point.
- Quota/abuse policy, per-account limits, and a conflict rule become central
  decisions someone must actually make.
- Slightly more up-front design than B's first app (but less than B times
  four apps).

### Option D - Identity (and saves) hosted in the hub

Included because the inventory and cost baseline genuinely point at it, not
as padding: hub is *already always-on* (min_machines_running=1, $3.32/mo
already being paid), *already DB-backed* with nothing but the health worked
example in its schema, and *already the apex domain* - the natural cookie
domain for a `.homeofed.com` session and the natural home for account UI.

**What it is.** Option C's identity+SaveStore capability, but implemented as
routers inside `apps/hub` instead of a new app. `packages/accounts` is
identical; consumers cannot tell the difference.

**Goal fit / rules fit.** Same as C. No cross-app imports appear (apps verify
tokens via the package; the browser talks to `homeofed.com`'s tRPC).

**Cost on Fly.** $0 marginal - the only option with no new machine and no
login cold-start (hub never sleeps).

**Honest downsides.**
- Hub stops being "the launcher" and becomes the estate's most critical app;
  a bad hub deploy takes down login and saves for everything (today it takes
  down a link page).
- Couples hub's deploy cadence to auth stability, and grows hub's scope
  against the repo's one-app-one-job grain; ADR 0001 §3's isolation argument
  says a credential-holding identity tier is exactly what you *split*, not
  merge.
- If ticket 04 lands on consolidation, this decision gets partially redone.
D is best understood as "C, hosted for free" - a hosting call that should be
made together with ticket 04, not an architecture of its own.

### Cross-cutting: migration from anonymous localStorage saves

The kid must not lose their boops the day accounts arrive. The mechanics are
the same under every option:

- **Import is copy, never move.** On first login inside an app, offer "keep
  these on your account": upload the existing local document(s) as-is, keyed
  by the account. localStorage is not cleared - it remains the offline/
  degraded-mode copy. Nothing is deleted on any failure path (the silt ADR
  0029 rule, generalised).
- **Upload the documents opaquely.** Every format is already versioned inside
  the value with total decode (`boop:save` ADR 0025, silt envelope ADR 0029,
  espy `v2`, karesansui `v2`). The server never parses them; old and new app
  builds keep working against their own decoders. Under B the same principle
  holds per-app (store the document, not exploded rows, at least for v1).
- **Per-key inventory to migrate** (from ticket 01): boop `boop:save` (few
  KB); silt `silt:scenes` + `silt:scene:<id>` + `silt:thumb:<id>` (~240KB per
  scene, up to ~5MB) + `silt:fieldNotes`; espy `espy:doodle:v2` (KBs to low
  MBs); karesansui `karesansui:presets:v2` (KBs); fridge `fridge:v1` (KBs).
  Not worth syncing: `theme`, `wotd-theme`, `boids:settings:v1`, `silt:seen`,
  and sprout's device token (device-bound by design).
- **The conflict rule is the one real decision**: the same kid imports from
  the tablet and the laptop. Options: last-write-wins per slot (simplest,
  can silently drop a device's boops) vs a per-app merge at import time (boop
  can union `creations`; silt scenes are separate keys so union is natural;
  espy's single doodle is genuinely LWW). Flag: pick LWW-per-slot as the
  service default with an app-side merge hook at import; do not build sync
  beyond save/load-whole-slot in v1.

### Cross-cutting: COPPA / GDPR-K exposure (flagged, not solved)

Kids' accounts and kids' content off-device is regulated territory whichever
option wins; sprout ADR-0019 is the prior art (supervised household pilot,
invite-code-closed registration, counsel sign-off deferred).

- **Option A inherits sprout's open gate directly**: one shared `user` table
  means opening any app's registration is the release the gate protects.
  A cannot ship to anyone outside the household until sprout's full gate
  (counsel, safeguarding names, real ToS/Privacy) closes.
- **Options B/C/D keep clear of sprout's gate but create their own.** A fresh
  identity service holding child profiles and child-made content is its own
  COPPA/GDPR-K surface. Mitigations to consider at decision time, not now:
  parent-owned accounts with child *profiles* (username + display name only,
  no child email - the sprout `children` shape without the safeguarding
  extras); replicate the ADR-0019 posture (invite-code, household pilot)
  from day one; content sensitivity tiers - boops/scenes/doodles are
  low-sensitivity creations, but recorded child *voice* audio
  (`.scratch/boop-recorded-sounds`) is a step up that ticket already flags
  as "sprout ADR-0019 territory, a deliberate call not a default".
- Whatever wins needs its own short legal ADR before any non-household
  account exists. Flagged for the grilling; nothing below assumes it solved.

### Cross-cutting: where the account UI lives

Hard rule 2 (no shared UI) means the login/registration/manage-family screens
are owned by exactly one app; packages may ship headless clients only.

- **Hub**: the natural owner. Apex domain (a `.homeofed.com` session cookie
  set at `homeofed.com` is visible to every subdomain), always-on (no
  cold-start on the login screen), and "the launcher" is already the place a
  family starts. Apps deep-link to `homeofed.com/account` and come back.
  Works under A, B, C, and is intrinsic to D. Note: hub owning the *UI* does
  not require hub owning the *backend* (that is only D) - the UI can call the
  identity service cross-subdomain via the package client.
- **Per-app**: N login forms, N places to get a kid's auth UX right, N
  surfaces inside the legal gate. Only defensible as a tiny "you are signed
  in as X / sync on-off" widget per app, which is needed anyway.
- **Sprout**: makes every app's login walk through the gated app and cements
  the sprout-shaped coupling A already suffers. Only coherent under A, and
  weak even there.

Recommendation embedded in the decisions below: hub owns account UI; each app
keeps only its own small "synced as X" affordance.

### Cross-cutting: the smallest first slice

**boop's `boop:save` behind an account, nothing else.**

- Smallest, cleanest payload: one frozen key, a few KB, versioned inside the
  value, total decode - the ideal first SaveStore client and the cheapest
  possible per-app DB if B wins instead.
- Real demand exists: two consumers are explicitly parked waiting on this
  epic (`.scratch/boop-clips/issues/02` - durability/reach of clips;
  `.scratch/boop-recorded-sounds/issues/01` - needs a blob home), so the
  slice retires actual tickets, not a demo.
- boop is stateless with no auth machinery, so the slice exercises the whole
  chain (package AuthProvider through `ctx.auth`, login UI, save round-trip,
  localStorage import) with no unpicking.
- silt is the wrong first slice for the same reasons it is the right *second*
  one: ~240KB blobs, a multi-key layout, and quota semantics (ADR 0029) make
  it the proper stress test of the SaveStore once the shape is proven - doing
  it first front-loads blob/quota design into the slice.

Slice contents: parent account + one child profile, login UI in its chosen
home, `packages/accounts`, the identity backend (per whichever option),
boop's save slot with the copy-import flow, and a conflict default. Nothing
for silt/espy/karesansui, no sprout changes, no ledger.

### Cross-cutting: parent-manages-child and the ledger extension point

Kept possible without designing either:

- **Model parent+child from day one, never bare kid accounts.** The identity
  schema is parent accounts plus child profiles carrying `parentId` - the
  shape sprout already proves. That edge *is* the parent-manages-child
  relationship; management features are additive rows/routes later.
- **Tokens carry `{ id, role, parentId }`.** backend-kit's `User = { id }`
  is extensible by intersection (context.ts:5), and sprout's
  `ParentUser`/`ChildUser` show exactly this narrowing. Any future authz
  ("parent may act for child", "child spends, parent tops up") derives from
  claims already in the token - no re-plumbing of `ctx.auth`.
- **The ledger is just another table keyed by the same ids.** An
  arcade-token ledger needs stable account ids, a parent-child edge, and a
  place to record entries - the first two exist in every option's identity
  schema; the third is an additive table (plus per-app "spend" calls through
  the same package client) whenever it is wanted. Nothing to build now; the
  only thing to *avoid* is per-app user ids (option B done carelessly), which
  would fracture the id space a ledger keys on. Keyed-by-central-account-id
  saves (all options as specified) keep it safe.

### Recommendation (Ed decides)

**Option C, hosted per ticket 04's outcome (D is C's free-hosting variant),
with boop as the first slice.** Rationale in one paragraph: the seam for
identity already exists everywhere and ADR 0008 already committed to the
central-service direction, so B's identity half is uncontroversial; the only
open question is saves, and the inventory shows saves are uniform
small-to-mid opaque documents across four stateless apps - centralising them
preserves ADR 0008 (apps stay stateless), makes migration/quota/conflict
one decision instead of four, and gives the waiting blob consumer a home,
at a marginal cost between $0.08 and $3.32 a month. A is rejected as the
first move: it maximises risk (sprout surgery, data migration) to extract a
deliberately sprout-shaped model, and welds every app to sprout's open legal
gate; sprout instead *consumes* the central service later via its own
recorded ADR 0012 path.

## Decisions for Ed

1. **Identity source: fresh minimal service, or extract sprout's?** Options:
   A (extract) vs B/C/D (fresh; sprout swaps in later via its ADR 0012
   AuthProvider path). *Recommendation: fresh* - keeps sprout's ADR-0019 gate
   scoped to sprout and avoids generalising a deliberately sprout-shaped
   safeguarding model.
2. **Save storage: per-app DBs or a central SaveStore?** Options: B (each app
   grows a DB keyed by account id) vs C/D (central opaque-blob SaveStore,
   apps stay stateless). *Recommendation: central SaveStore* - preserves ADR
   0008's stateless baseline, one migration/quota/conflict story, natural
   home for the recorded-sounds BlobStore need.
3. **Where the backend runs: new Fly app, or inside hub - and decide it with
   ticket 04.** Options: own scale-to-zero app (~$0.08-$3.32/mo), hub-hosted
   ($0, no cold start, bigger hub blast radius), or a process on ticket 04's
   consolidated host. *Recommendation: default to one new "family" app,
   scale-to-zero, unless ticket 04 lands on a consolidated always-on host -
   then ride that instead; do not hub-host purely to save $3.*
4. **Save-path wiring: through each app's backend, or browser direct to the
   save service?** Options: proxy via app handlers (purest per-app DI, wakes
   stopped machines) vs direct-to-service tRPC with the contract in
   `packages/accounts`. *Recommendation: direct-to-service* - the DI seam
   lives in the save service, and app machines stay asleep.
5. **Account UI home.** Options: hub / per-app / sprout. *Recommendation:
   hub owns login and family management (apex cookie domain, always-on);
   apps keep only a small "synced as X" affordance.*
6. **First slice.** Options: boop `boop:save` vs silt scenes vs an
   identity-only slice with no saves. *Recommendation: boop* - smallest
   frozen-format payload, two waiting consumer tickets, proves the whole
   chain; silt is the deliberate second slice that stress-tests blobs/quota.
7. **The legal gate for the account layer itself.** Options: inherit
   sprout's gate (forced under A) vs a fresh ADR-0019-style posture
   (household pilot, invite-code, parent-owned accounts with child profiles,
   counsel before public registration). *Recommendation: fresh gate,
   modelled on ADR-0019, written as a short ADR before any non-household
   account exists - flag only; this paper does not solve it.*
8. **Import conflict default.** Options: last-write-wins per slot vs per-app
   merge hooks at import. *Recommendation: LWW-per-slot as the service
   default, with the importing app allowed to merge (boop unions
   `creations`); decide per app at slice time, build no sync engine.*
