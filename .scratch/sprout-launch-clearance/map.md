# Sprout code-side launch clearance

Label: `wayfinder:map`
Status: closed (2026-08-19) — destination reached; all 11 tickets resolved, fog clear.
Remaining launch blockers are human-only (counsel sign-off, named DSL, P11 infra) plus
the `/tdd` build handoffs recorded in Decisions so far.

## Destination

Every **code-side** item standing between sprout and opening to real UK users is either
decided-and-handed-off or explicitly deferred with a recorded decision. Concretely: the two
open guardrail items that back a legal claim — **6.5.12** (UK-only enforcement) and **6.5.9**
(safe-by-default + honest disclosure) — have their open decisions settled, and the
behavioural limits have launch-day values chosen.

The map is done when nothing remains to *decide* before someone builds, and the only open
launch blockers are the human ones (counsel sign-off, a named DSL, the P11 infra steps).

## Notes

**Domain:** child-safety guardrails on a text-only, 1:1 LLM chat product for children.
Source of truth for what's open: [`apps/sprout/docs/guardrail-roadmap.md`](../../apps/sprout/docs/guardrail-roadmap.md).
Legal basis: [`apps/sprout/docs/product-legal-adrs.md`](../../apps/sprout/docs/product-legal-adrs.md)
(ADR-0007 scope determination, **ADR-0008 accepted** and naming the three UK-only measures,
ADR-0009 proposed).

**Standing preferences for this effort:**

- **Decisions only — this map does not carry execution.** A ticket resolves to a recorded
  decision; the build is handed to `/tdd` or `/implement` afterwards. The repo's TDD rule
  (root `CLAUDE.md`) means tests come first, which a decision session shouldn't be quietly
  doing.
- **An agent must never tick a counsel, legal, or Designated-Safeguarding-Lead item** in
  [`launch-readiness.md`](../../apps/sprout/docs/launch-readiness.md) or the
  [safeguarding runbook](../../apps/sprout/docs/safeguarding/csam-grooming-escalation.md).
  Where a decision has a legal consequence, record it and flag it for counsel — don't
  self-certify.
- **Legal prose is human.** Routes, placeholder pages, and consent plumbing are in scope;
  drafting binding ToS/Privacy copy for a children's product is not.
- Decisions land as ADRs — platform ones in `docs/adr/`, product-legal ones in
  `apps/sprout/docs/product-legal-adrs.md`.
- Skills: `/grilling` + `/domain-modeling` by default, `/research` for the AFK lookups,
  `/prototype` where the question is "what should this look like".

**Useful facts already established (don't re-derive):**

- sprout sits behind a **proxied Cloudflare CNAME** (per `apps/sprout/docs/go-live.md`), so
  `CF-IPCountry` is available in principle — but Fly health checks and direct `.fly.dev`
  requests arrive without it.
- `BEHAVIOURAL_LIMITS` (`apps/sprout/src/server/behavioural-limits.ts`) is already fully
  env-var driven (eight `RATE_LIMIT_*` knobs). Tuning is a values decision, not a code change.
- The **parent-facing** disclosure exists (`FlagsPage.tsx`, "What this can and can't do").
  The child-facing one is unverified.
- `SettingsPage.tsx` links "Privacy Policy" and "Terms of Service" as dead `href="#"`.
  Neither route nor page exists.
- `createChildHandler.ts` takes `presetName` as **required client input** — no server-side
  strictest fallback. `getChildConfigHandler.ts` separately claims a safe-by-default fallback;
  the two need reconciling.
- The eval harness **ratchets**: a case marked `bypass` that becomes caught fails the build
  until `expected` is flipped.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- [What Cloudflare's free plan and Fly.io actually offer for country blocking](issues/01-country-blocking-primitives.md) —
  free plan blocks by country (5 WAF rules, `ip.src.country`) but can't customise the block
  page; Fly has no geo primitive; health checks run on the private network so edge rules can't
  flap them, but app-level checks would (and would break the `.fly.dev` CI smoke); geolocation
  failure yields `XX`/`T1` sentinels, not a missing header; cheapest `.fly.dev`-bypass close is
  a Transform-Rule shared secret. Full detail in the ticket's answer + linked asset.
- [Which layer refuses a non-UK request](issues/02-enforcement-layer.md) — both layers,
  **app-level Fastify hook load-bearing** (testable/versioned = defensible), WAF rule ON from
  launch as belt-and-braces (matches ADR-0008's literal text; refused visitors get the 1020);
  `/health` is the only exempt path; CI smoke staying on `.fly.dev` recorded as a constraint;
  `.fly.dev` header-spoofing accepted as reasonable-measures residual (no shared secret at
  launch); pipeline app confirmed out of scope. Recorded as **ADR-0011** in
  `apps/sprout/docs/product-legal-adrs.md`, flagged for counsel alongside ADR-0008. Unblocks
  03 and 04, and graduates three fog items: ADR-or-amendment → resolved (new ADR-0011);
  test strategy → unit tests over `createAppServer` (in ADR-0011's consequences); go-live
  shape → two human Cloudflare steps + a `deploy.yml` smoke-constraint comment (ditto).
- [What the app trusts when the country header is missing](issues/03-absent-country-header.md) —
  fail-closed confirmed (ADR-0011 item 5 holds); matrix is **allow `GB` only** (non-GB / `XX` /
  `T1` / missing all refused; refusing `XX` a knowing choice); WAF mirrors by construction via
  `ip.src.country ne "GB"` (the go-live step's concrete spec); `/health` exempt by exact string
  match only; escape hatch is `GEO_ENFORCEMENT=off` (compose-only) + a `main.ts` boot guard
  that throws if set while `FLY_APP_NAME` exists — `NODE_ENV` can't gate it, the docker stack
  runs the prod image. Dev simulator never runs the hook; CI smoke only hits exempt `/health`.
  Recorded as **ADR-0012**, flagged for counsel; launch-readiness row now cites ADR-0011/0012.
  Reshapes ticket 04: refusal audience is headerless `.fly.dev` traffic → one generic
  self-contained response.
- [What a refused non-UK visitor sees](issues/04-refused-visitor-experience.md) — **`451`**
  + one generic self-contained "status notice" document (dark, monospace, status-code-first;
  under 1 KB, no assets): "only available in the United Kingdom" plus the honest why-line,
  no contact/waitlist; chosen from three prototyped alternatives (asset linked from the
  ticket). Recorded as **ADR-0013**, counsel-flagged (`451`'s legal characterisation is
  noted, not self-certified). No new go-live step — the response is app code under the
  ADR-0011/0012 test strategy; ticket 11 gains a diagnostic signature (UK visitors seeing
  the 451 page ⇒ zone IP Geolocation is off). Build handed to `/tdd`.
- [How country is captured and stored at parent registration](issues/05-country-at-registration.md) —
  a required **residence attestation checkbox** (not a country picker — the ADR-0012 gate
  already proves presence), stored as a Better Auth `additionalField`
  (`uk_residence_attested_at timestamptz NOT NULL`, server-stamped by a before-create hook
  that rejects unattested signups — the hook is the load-bearing control); **erased with the
  account** (no post-erasure evidence retention — the mechanism is the evidence; resolves the
  retention fog note); no geo-conflict handling (structurally precluded by ADR-0012; the
  flags pipeline is child-scoped anyway); no backfill (app never deployed). Recorded as
  **ADR-0014**, counsel-flagged incl. the label copy. Build handed to `/tdd`; ticket 06
  shares the registration form and should reference ADR-0014.
- [ToS and Privacy plumbing, and the registration consent gate](issues/06-tos-privacy-consent-gate.md) —
  `/terms` + `/privacy` geo-exempt (exempt list → three exact-match strings; privacy
  transparency for data subjects abroad is the load-bearing argument), served as
  self-contained static documents (ADR-0013 pattern), **not** SPA routes; skeleton drafts
  with a "Draft — not yet in force" banner, gated by a new counsel-owned launch-readiness
  row; counsel's clause brief written as `apps/sprout/docs/legal-content-requirements.md`;
  a **second** consent checkbox at registration (`tos_agreed_at`, same before-create hook
  as ADR-0014), not bundled with the attestation. Recorded as **ADR-0015**,
  counsel-flagged. Build handed to `/tdd`; ToS re-acceptance on revision ruled out of scope.

- [What the server does when a child is created without an explicit preset](issues/07-strictest-preset-default.md) —
  premise dissolved on verification: the strictest-preset fallback is real, shared, tested
  code at the read seam (`loadChildConfig`, behind all three read paths incl. chat SSE), and
  `early-learner` is verified strictest on all seven sliders. Posture recorded as
  **ADR-0016**: property holds at the read seam; `presetName` stays required at creation
  **by design** (no silent server default — departs from the ticket's recommendation);
  onboarding keeps the strictest pre-selection; the non-transactional create gap is an
  accepted residual. No build handed off — doc-level only (handler comment, roadmap
  citation). 6.5.9's ⚠️ half-clears; the rest waits on tickets 08/09.
- [The child-facing honest disclosure](issues/08-child-facing-disclosure.md) — verified
  absent everywhere today; human chose **variant C** from the prototype (asset linked):
  first-run statement card + persistent line above the chat input, **per-preset wording**
  (resolves the per-preset fog note — no new ticket), parent-visibility sentence kept
  (code-true at every setting; the slider's "Summaries & flags only" low end is unenforced —
  recorded, not fixed), plus a positive identity instruction in the pipeline system prompt.
  Recorded as **ADR-0017**, counsel-flagged. Build handed to `/tdd`; roadmap 6.5.9 cites it.
- [Confirm the parent-visible flag log meets the 6.5.9 claim](issues/09-confirm-parent-flag-visibility.md) —
  all five checks pass with file/test evidence: `/parent/flags` routed **and** linked
  (dashboard + per-child); parent-scoped with cross-family isolation and the #35
  IDOR-ignore proven in `listFlagsHandler.test.ts`; SSE write shape matches the read
  shape (`chat-sse.test.ts` asserts the stored row, the `.iwft` closes the loop over real
  PGlite); `topics` text-JSON parsed to badges, never raw. Two small test gaps for the
  handoff (topic-badge assertion, dashboard-link click), no new tickets. Roadmap 6.5.9's
  "parent-visible flag log" clause can drop at handoff; the ⚠️ stays until ticket 08's
  disclosure build lands.
- [Launch-day values for the eight behavioural limits](issues/10-launch-day-behavioural-limits.md) —
  ship the code defaults except `RATE_LIMIT_RETENTION_S` → 7 days (so week-one tuning has a
  week of rows); `MAX_MESSAGES` stays 20 (a 60-second gentle pause is an acceptable false
  positive); no telemetry built — every throttle already writes a `rate_violation` row, so
  firing rates are pull-queryable by a documented SQL query; all nine pinned in
  `fly.toml [env]` (done — no `/tdd` handoff, nothing testable); one new dev-owned
  launch-readiness row, the week-one review recorded in the ADR, not the gate. Recorded as
  **ADR-0018**, counsel-flagged (the retention extension). Resolves the last fog note:
  no other code-side item wants a gate row.

- [Check the Cloudflare zone's IP Geolocation setting](issues/11-check-zone-geolocation-setting.md) —
  **on**, plan **Free** (checked 2026-08-19): `CF-IPCountry` reaches the origin today and the
  5-WAF-rule quota assumption holds; the go-live "flip it on" step collapses to a verify-only
  check, with the ADR-0013 451-to-UK-visitors signature as the post-launch diagnostic.

## Not yet specified

Nothing — the fog is clear. (The last note, whether code-side items deserve
launch-readiness rows, was fully answered by tickets 06 and 10: the counsel ToS/Privacy
row and the ADR-0018 behavioural-limits row are the only two.)

## Out of scope

Ruled beyond this destination. These do not graduate — they return only as a fresh effort.

- **6.5.1 canonicalisation tail** — inter-letter spacing (`b o m b`), character-run collapsing
  (`boooomb`), and the unmapped age-restricted emoji. Three documented, ratcheted eval
  bypasses. Quality work on a safe-direction-only baseline, not a launch blocker.
- **The LLM crescendo judge** — closes the fourth bypass (`crescendo-self-harm-1`, anaphoric
  overdose build-up). Also needs a live model, so it can't gate CI. Deliberately deferred by
  the 6.5.5 precision retune.
- **ToS and Privacy legal prose** — drafted by a human with counsel. The routes, placeholder
  pages, and consent plumbing are in scope (see the registration/consent tickets); the binding
  words are not. The clause brief counsel drafts against is
  `apps/sprout/docs/legal-content-requirements.md` (ticket 06 / ADR-0015).
- **ToS re-acceptance flow on future revisions** — no version column at launch; every
  launch-era agreement is against v1 (the launch-readiness row guarantees no earlier
  registrations). Deferred in ADR-0015 item 7; returns as its own effort if the ToS is
  ever revised.
- **P11 infra go-live** — everything in [`docs/go-live.md`](../../apps/sprout/docs/go-live.md):
  Fly apps, Managed Postgres, secrets, the org-scoped deploy token, `SPROUT_GO_LIVE`,
  Cloudflare DNS/cert, worker scaling. Human-run, never an agent.
- **Counsel sign-off and the named Designated Safeguarding Lead** — the
  [`launch-readiness.md`](../../apps/sprout/docs/launch-readiness.md) items, including moving
  ADR-0009 from Proposed to Accepted. Requires a human lawyer and a human owner.
