# Map: account layer + infra consolidation (decide together)

**Label:** wayfinder:map
**Charted:** 2026-09-06
**Source tickets:** [account-layer discovery](../account-layer/issues/01-account-layer-discovery.md), [infra cost review](../infra-cost/issues/01-cost-consolidation-review.md)

## Destination

Ed decides, in one sitting, (a) the account-layer direction - which architecture
option and the smallest first slice - and (b) the infra consolidation direction.
Both decisions recorded on this map and echoed to the source tickets. This map is
planning only: its outputs are an inventory, a cost baseline, two options papers,
and Ed's decisions. No builds, no infra mutation.

## Notes

- Planning only: decision tickets, research, and options papers. No builds.
- Infrastructure is human-gated (CLAUDE.md). Read-only `fly` commands are fine;
  never create or mutate deployed infra.
- Direction decisions are Ed's. Research tickets are AFK (agent-workable); the
  decision sitting is HITL - invoke /grilling and /domain-modeling.
- Tokens/monetisation (arcade model) informs the shape (parent-manages-child
  relationship, ledger-shaped extension point) but is not in scope to design.
- Read ADR 0008 before proposing anything auth-shaped. sprout's legal gate
  (ADR-0019) is prior art for kids' data; flag, don't solve.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [01 - Inventory: accounts and save data today](issues/01-current-state-inventory.md) -
  sprout is the only app with accounts (Better Auth parent + HMAC child token,
  deliberately app-owned V1 per ADR 0012, swap path pre-recorded); the
  `ctx.auth` `AuthProvider` seam is universal across all ten apps and ADR 0008
  already commits to "central identity service, not per-app user tables". All
  per-user data outside sprout is single-device localStorage (boop KBs, silt up
  to ~5MB of scene blobs); only 4 of 10 apps have a DB; sprout's legal gate
  (ADR-0019) is open and anything coupling to its user table inherits it.

- [02 - Fly cost baseline](issues/02-fly-cost-baseline.md) - HomeOfEd costs
  ~$13/mo; the ticket's premise was inverted: hoe-pg is only ~$2.17/mo and the
  three always-on machines (hub, sprout web, sprout-pipeline) are ~75% of the
  bill. Consolidating the seven scale-to-zero apps would reclaim only ~$1.20/mo
  in stopped rootfs - the real levers are the always-on trio.
- [04 - Options paper: machine-per-app vs consolidation](issues/04-consolidation-options.md) -
  recommends status quo (options 2/3 save ~$1.20/~$0.50 per month for days of
  work and permanent deploy coupling), plus Lever A (hub scales to zero, net
  ~$3.24/mo) and declining Lever B (folding sprout-pipeline into sprout undoes
  ADR 0013's key isolation). Any account service slots in additively as its own
  scale-to-zero app + logical DB in hoe-pg; no consolidation redo under any
  account option. Five decisions queued for Ed.
- [03 - Options paper: the account layer](issues/03-account-layer-options.md) -
  four options laid out (extract sprout / fresh identity + per-app DBs / fresh
  identity + central SaveStore / SaveStore hosted in hub). Recommends Option C
  (fresh minimal identity + central opaque-blob SaveStore, sprout left alone to
  swap in later via its ADR 0012 path), boop `boop:save` as the first slice,
  hub owning the account UI, copy-never-move localStorage import. Eight
  decisions queued for Ed; the legal gate is flagged, not solved.
- [06 - Cost model: growth to ~100 users](issues/06-cost-model-100-users.md) -
  scale-to-zero does NOT stop being cheap by 100 users: the leaf fleet's
  variable cost (~$4-5/mo) lands at parity with a 1GB always-on host
  (crossover ~34 machine-awake-h/day, estimated ~28-34 at 100 users). The
  one-host setup's headline saving is the always-on trio collapsing, not
  scale-to-zero losing. Whole decision space spans ~$14/mo; account layer adds
  ~$2/mo s2z; hoe-pg needs a +$1.60/mo step (512MB node + 3GB volume) for
  SaveStore blobs at 100 users. Cost is a tiebreaker, not a decider.
- [07 - Hosting landscape survey](issues/07-hosting-landscape-survey.md) - Fly
  at ~$13/mo is near this estate's floor: Hetzner VPS saves ~$2/mo for the
  highest ops burden (and UK->EU jurisdiction shift), Render/DO App Platform
  are 2-5x on per-service pricing, Railway ~$15-25 estimated, hybrid Pages
  saves $0.75/mo for weeks of work and amputates the ctx.auth seam, Workers+D1
  is $0-5/mo but a foundation rewrite with fuzzy kids-data residency.
  Shortlist: stay on Fly (and rehearse the hoe-pg restore - the real gap);
  hold Hetzner+Coolify as a documented exit runbook only; Cloudflare Pages for
  future genuinely-static toys at creation time.

## Not yet specified

- Smallest-first-slice spec (likely one app's saves behind an account): which
  app, what the slice contains. Tickets once Ed picks a direction.
- Migration plan for anonymous localStorage saves (a kid must not lose their
  boops the day accounts arrive). Sharpens after the direction decision.
- COPPA/GDPR-K legal gate follow-up: does sprout's ADR-0019 pilot gate extend to
  a global account layer? Flag only for now.
- Where the account UI lives (hub? per-app? sprout?) - probably settled inside
  the decision sitting, but may need its own ticket if it survives it.
- If Ed picks a consolidation option: execution plan (CI deploy restructure,
  release_command / migration story across co-hosted apps, cutover runbook).
- Re-point waiting consumers once direction is set: boop clip persistence
  (`.scratch/boop-clips/issues/02`), boop recorded sounds
  (`.scratch/boop-recorded-sounds/issues/01`), silt per-scene progression's
  "revisit under global accounts" note.

- hoe-pg backup/restore rehearsal: the hosting survey flagged the single
  postgres-flex node with a never-rehearsed restore as the estate's real ops
  gap (kids' chat data). Probably its own small effort outside this map -
  raise at the decision sitting.

## Out of scope

- Designing the token/ledger/monetisation system - it informs extension points
  only.
- Building anything: no account-layer code, no consolidation execution, no infra
  mutation of any kind.
- Selling an app / moving one to its own domain - that isolation property gets
  weighed in the consolidation paper, not exercised.
