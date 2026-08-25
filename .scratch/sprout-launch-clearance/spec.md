# Spec: Sprout launch-clearance builds

Status: ready-for-agent
Date: 2026-08-25
Sources: [`map.md`](map.md) (closed 2026-08-19), ADR-0011–ADR-0018 in
[`apps/sprout/docs/product-legal-adrs.md`](../../apps/sprout/docs/product-legal-adrs.md).

## Problem Statement

Sprout's launch posture — UK-only access, safe-by-default guardrails, and honest
disclosure to the child — is fully **decided** (ADR-0011 through ADR-0018), but the
launch-clearance effort deliberately carried no execution. Today the app enforces none
of it: any visitor anywhere can reach every surface, registration captures no residence
claim and no ToS agreement, the Settings legal links are dead anchors to pages that do
not exist, and no child-facing surface ever says that Sprout is a computer. The legal
claims the ADRs rest on are not yet true in code, so launch stays blocked.

## Solution

Land the recorded `/tdd` handoffs so the decided posture becomes running, tested code:

- Every request without `CF-IPCountry: GB` is refused with a `451` status notice,
  except three exactly-matched paths (`/health`, `/terms`, `/privacy`).
- Parent registration requires two separate server-enforced checkboxes — a UK residence
  attestation and ToS/Privacy agreement — both server-timestamped and erased with the
  account.
- `/terms` and `/privacy` exist as self-contained draft skeleton documents, and the
  Settings links navigate to them.
- Every child chat surface discloses, in preset-appropriate wording, that Sprout is a
  computer, can be wrong, and that the parent can see the conversations; the pipeline
  system prompt gains a positive identity instruction.
- The two known flag-visibility test gaps close (topic badges asserted; the dashboard
  "View flags" link exercised).

## User Stories

1. As the product owner, I want every non-UK request refused before it reaches any app
   surface, so that the ADR-0007/0008 UK-only legal basis is enforced rather than merely
   claimed.
2. As a UK visitor arriving through Cloudflare with `CF-IPCountry: GB`, I want the app
   to behave exactly as it does today, so that enforcement is invisible to legitimate
   users.
3. As a non-UK visitor who reaches the Fly hostname directly, I want a single
   self-contained `451` status notice saying Sprout is only available in the United
   Kingdom and why, so that the refusal is honest and legible even as raw bytes in curl.
4. As a visitor Cloudflare cannot geolocate (`XX`) or who arrives via Tor (`T1`), I want
   to be refused like any other non-UK visitor, so that the posture stays "actively
   prevented", never "admitted unless proven foreign".
5. As an operator, I want Fly health checks and the `.fly.dev` CI smoke — both
   headerless requests to `/health` — to keep passing after enforcement lands, so that
   deployment monitoring survives the boundary.
6. As a security reviewer, I want the exempt paths matched by exact string only (no
   prefixes, no query-stringed variants), so that no future route silently inherits the
   exemption.
7. As an operator running the docker stack, I want `GEO_ENFORCEMENT=off` to disable the
   hook there, so that the production image stays locally testable with headerless
   browser traffic.
8. As an operator, I want the server to fail fast at boot if `GEO_ENFORCEMENT` is set
   while `FLY_APP_NAME` is present, so that the boundary can never be silently disabled
   on real infrastructure.
9. As a refused visitor, I want the refusal served with `cache-control: no-store`, so
   that a later posture change is never masked by a stale cached refusal.
10. As a developer reading the CI workflow, I want a comment recording that smoke URLs
    must stay on `.fly.dev` and touch only geo-exempt paths, so that nobody "fixes" the
    smoke onto Cloudflare and gets 403s from US runners.
11. As a parent registering, I want a required "I confirm I live in the United Kingdom"
    checkbox, so that my residence claim is captured as part of the reasonable-measures
    posture.
12. As the product owner, I want the server to reject any signup whose payload lacks a
    true attestation and to stamp the timestamp with server time, so that the control is
    the versioned hook, not the form.
13. As a parent registering, I want a second, separate checkbox agreeing to the Terms of
    Service and acknowledging the Privacy Policy, with both phrases linking to the
    pages, so that contract formation is captured distinctly from the residence claim.
14. As the product owner, I want ToS agreement enforced by the same server-side
    before-create hook (reject + server-stamp), so that both controls are load-bearing
    and symmetric.
15. As a parent who later exercises erasure, I want both timestamps erased with my
    account, so that erasure means erasure with no post-erasure evidence retention.
16. As counsel, I want both checkbox labels recorded as proposed copy flagged for my
    review, so that no agent self-certifies legally weighted wording.
17. As a UK parent travelling abroad, I want `/privacy` (and `/terms`) reachable without
    geo refusal, so that UK GDPR transparency about my child's data does not stop at the
    border.
18. As a parent in Settings, I want the Privacy Policy and Terms of Service links to
    navigate to real pages instead of `href="#"`, so that the legal documents are
    reachable where the app promises them.
19. As a pre-launch visitor to `/terms` or `/privacy`, I want a prominent "Draft — not
    yet in force" banner and section headings with one-line notes — not invented legal
    prose — so that nothing on the page could be mistaken for binding terms.
20. As counsel, I want the skeleton pages' headings to mirror the clause brief in
    `legal-content-requirements.md`, so that one source of truth drives the brief, the
    pages, and the launch-readiness row.
21. As a child starting a new chat, I want a statement card telling me Sprout is a
    computer, that it can help me learn, that it can be wrong, and that my grown-up can
    see what we talk about, so that the relationship starts honestly.
22. As a child mid-conversation on any chat screen, I want a persistent one-line
    disclosure above the input, so that the disclosure survives past the first message
    without becoming header wallpaper.
23. As an early-learner child, I want the disclosure worded for my reading age, so that
    the disclosure is one I can actually read.
24. As an independent-explorer child, I want the disclosure in full natural vocabulary
    ("I'm an AI — a computer program"), so that it speaks in my register rather than
    down to me.
25. As a child who asks Sprout directly whether it is a real person, I want a plain
    answer that it is a computer program, so that the disclosure holds at the moment it
    matters most.
26. As a parent, I want the child-facing disclosure to state my visibility truthfully at
    every `parentVisibility` setting, so that neither the child nor I am misled about
    monitoring.
27. As a developer, I want the flag log's topic badges asserted in a test, so that the
    topics-to-badges rendering (never raw JSON) is pinned.
28. As a parent on the dashboard, I want the "View flags" link proven by a test to reach
    the flag log, so that the advertised entry point cannot silently break.
29. As the launch-readiness owner, I want the guardrail roadmap's 6.5.9 entry updated as
    the builds land (disclosure decided-and-built; the parent-visible-flag-log clause
    dropped), so that the roadmap reflects reality.
30. As a developer, I want the whole boundary proven by unit tests over the composed app
    server — every matrix row per path, near-miss paths, status, body, and headers — so
    that the load-bearing control is defensible as versioned, tested code (ADR-0011's
    reasonable-measures argument).

## Implementation Decisions

**UK geo boundary (ADR-0011, ADR-0012, ADR-0013).**

- One new sprout server module owns the boundary: a Fastify `onRequest` hook plus the
  refusal document, registered through the existing `registerRoutes` hook in the prod
  entrypoint — the same place the `x-sprout-parent` stamping hook already lives. No
  backend-kit change.
- Refusal predicate: `CF-IPCountry === 'GB'` passes; every other value — any other
  country code, `XX`, `T1`, or a missing header — is refused (fail-closed).
- Exempt paths are three exact-match strings: `/health`, `/terms`, `/privacy`. No prefix
  matching; query-stringed variants are not exempt.
- The refusal is `451 Unavailable For Legal Reasons` with one generic self-contained
  static HTML body (inline styles only, no assets or scripts, under 1 KB): dark,
  monospace, status-code-first, then the two lines *"Sprout is only available in the
  United Kingdom."* and *"Sprout is UK-only while we complete our safety and legal
  work."* It names no country (a missing header has none). Headers:
  `content-type: text/html; charset=utf-8` and `cache-control: no-store`.
- Escape hatch: `GEO_ENFORCEMENT=off` disables the hook; only the docker-stack compose
  file sets it. The prod entrypoint gains a boot guard that throws if the variable is
  set while `FLY_APP_NAME` exists, following the existing `CHILD_SESSION_SECRET`
  fail-fast idiom. The dev simulator never runs the hook (simulator mode does not go
  through the app-server factory) and needs no hatch.
- The CI deploy workflow gains a comment recording the smoke-URL constraint: smoke stays
  on `.fly.dev` and touches only geo-exempt paths (ADR-0011 item 4).

**Registration: residence attestation + ToS consent (ADR-0014, ADR-0015 items 5–6).**

- Two new Better Auth `additionalField`s on the `user` table, following the
  `subscriptionStatus` precedent: `uk_residence_attested_at timestamptz NOT NULL` and
  `tos_agreed_at timestamptz NOT NULL`, landed as one committed drizzle-kit migration.
  `NOT NULL` with no backfill is safe — the app has never been deployed.
- One `databaseHooks.user.create.before` hook is the load-bearing control for both: it
  rejects any signup whose payload lacks a true residence attestation or ToS agreement,
  and stamps both columns with **server** time. The checkboxes are UX only.
- The registration page gains two separate required checkboxes (no checkbox primitive
  exists yet; add one or use a plain input — implementer's choice). Proposed copy,
  counsel-flagged, not final: *"I confirm I live in the United Kingdom"* and *"I agree
  to the Terms of Service and have read the Privacy Policy"*, the latter with both
  phrases linking to the pages. The Better Auth client signup call widens to carry both
  fields.
- Erasure semantics: both fields live on `user` and vanish with the account row. No
  post-erasure evidence retention; no attestation-vs-geo conflict handling;
  `CF-IPCountry` is not stored.

**ToS / Privacy pages (ADR-0015 items 1–4).**

- `/terms` and `/privacy` are served as self-contained static HTML documents from app
  code (the ADR-0013 pattern: versioned template strings, inline styles, no external
  assets) via routes registered in the same `registerRoutes` wiring — **not** SPA
  routes, and not files in the build-output static dir.
- Both are geo-exempt (see boundary decisions above). The load-bearing argument is
  privacy transparency for data subjects abroad; `/terms` rides along for consistency.
- Content is a skeleton, not fake prose: a prominent "**Draft — not yet in force**"
  banner, then the section headings from `legal-content-requirements.md` with one-line
  notes of coverage. No invented legal sentences.
- The Settings page's two dead anchors become plain full-page navigations to `/terms`
  and `/privacy`.
- The counsel-owned "placeholders replaced" launch-readiness row **already exists** — no
  doc change needed there.

**Child-facing disclosure (ADR-0017).**

- The new-conversation empty state is replaced by a statement card (🤖, "I'm Sprout!",
  the per-preset lines); a small muted disclosure line sits above the chat input on
  every chat screen (new and continue).
- Wording is selected by the child's preset from the child-scoped `children.myConfig`
  read. The shared child-config loader currently returns only sliders and calibration
  answers; it widens to also return the preset name (the column exists on the preset
  row), falling back to `early-learner` when no preset row exists — keeping the
  safe-by-default property (ADR-0016) intact for the disclosure register too.
- The copy, per preset (from ADR-0017, counsel-reviewable):

  | Preset | Persistent line (chrome voice) | Card lines (AI voice) |
  |---|---|---|
  | `early-learner` | Sprout is a computer, not a person. Your grown-up can see your chats. | I'm a computer, not a person. · I can help you learn things. · Sometimes I get things wrong. A grown-up can help you check. · Your grown-up can see what we talk about. |
  | `confident-reader` | Sprout is a computer program, not a person. Your parent can see your chats. | I'm a computer program, not a real person. · I can help you learn and explore. · Sometimes I get things wrong — it's worth checking with a grown-up. · Your parent can see what we talk about. |
  | `independent-explorer` | Sprout is an AI — a computer program, not a human. Your parent can see your conversations. | I'm an AI — a computer program, not a human. · I can help you learn, explore, and think things through. · I can be wrong, so check important things with a person you trust. · Your parent can see our conversations. |

- The pipeline system prompt gains one always-present positive identity instruction
  alongside the existing negative blocker: if the child asks whether Sprout is a real
  person or a human, answer plainly that it is a computer program, not a person.
- The parent-visibility sentence is kept and is code-true unconditionally today; the
  unenforced "Summaries & flags only" low end is recorded in ADR-0017, not fixed here.

**Flag-visibility test gaps (map ticket 09).**

- The parent-flags whole-frontend test gains a topic-badge assertion (the seed already
  inserts topics; nothing asserts them) and the page-object gains a matching helper.
- A test clicks the dashboard's "View flags" link and lands on the flag log, closing the
  entry-point gap.

**Docs ride-alongs.**

- The guardrail roadmap's 6.5.9 entry: cite ADR-0017 as built when the disclosure lands,
  and drop the "parent-visible flag log" clause (ticket 09's confirmation).

## Testing Decisions

Good tests here assert **external behaviour only**: response status, headers, and body
per request; rows stored (or signups rejected) at the auth API; text visible to the
child per preset; badges and navigation visible to the parent. No test reaches into hook
internals or module state.

- **The composed app server is the boundary seam** (ADR-0011 names it). New unit tests
  build the real sprout server — router, store fake, and `registerRoutes` wiring
  including the new boundary module — and drive it with real requests. Prior art: the
  chat SSE server test (real listen + fetch over the app-server factory with a fake
  store) and backend-kit's app-server tests (`inject` style). Coverage: every ADR-0012
  matrix row (`GB`, other country, `XX`, `T1`, missing) against a non-exempt path; each
  exempt path headerless; near-misses (`/healthx`, `/terms?x=1`) refused; `451` status,
  body copy, `content-type`, and `cache-control: no-store` on every refused row;
  `GEO_ENFORCEMENT=off` disabling the hook; `/terms` and `/privacy` content (draft
  banner + expected headings).
- **The boot guard** is tested at whatever unit seam the entrypoint allows (the guard
  logic extracted or exercised with env fixtures): set `GEO_ENFORCEMENT` +
  `FLY_APP_NAME` → throw.
- **The Better Auth seam**: unit tests over the sprout auth factory (real Better Auth
  over the test DB) calling the server signup API — signup without attestation rejected;
  without agreement rejected; successful signup has both columns server-stamped (not
  client-supplied values). Prior art: existing handler unit tests over PGlite/fakes.
- **The prompt seam**: the existing system-prompt unit test file gains an assertion for
  the positive identity instruction (loose-regex style matching the file's existing
  assertions). The negative blocker is currently untested — pin it in the same change.
- **The whole-frontend seam** (existing harness, kept thin per the repo's pragmatic test
  split): registration submit blocked until both checkboxes are ticked; disclosure card
  and persistent line show preset-appropriate wording (state-through-UI via the seeded
  preset); Settings links navigate to the documents; the two flag-visibility gap tests.
  Prior art: the existing parent-flows, parent-flags, parent-settings, and
  chat-experience whole-frontend tests.

## Out of Scope

- **Human go-live steps**: creating the Cloudflare WAF rule, verifying the zone
  IP Geolocation setting (already confirmed on, 2026-08-19), and all of P11 infra.
  Agents never touch deployed infrastructure.
- **Binding ToS/Privacy prose** — drafted by a human with counsel against
  `legal-content-requirements.md`. Only the skeleton containers are in scope.
- **ToS re-acceptance on revision** — no version column at launch (ADR-0015 item 7).
- **The `.fly.dev` shared-secret hardening** (Transform Rule + origin allowlist) —
  recorded as the known tightening, deliberately not shipped (ADR-0011 item 5).
- **Enforcing the `parentVisibility` "Summaries & flags only" low end** — recorded gap
  (ADR-0017 item 2); any future enforcement must keep the disclosure sentence true.
- **Behavioural-limit work** — ADR-0018 was values-only and is done (`fly.toml` pinned,
  launch-readiness row present).
- **6.5.1 canonicalisation tail and the LLM crescendo judge** — deferred quality work,
  not launch blockers.
- **Counsel sign-off, the named DSL, and every counsel/legal launch-readiness item** —
  human-only; agents must never tick them.
- **Firing-rate telemetry, erasure-log features, registration-time geo conflict
  handling** — all explicitly ruled out in the ADRs.

## Further Notes

- **Counsel-flagged copy in this spec is proposed, not final**: both checkbox labels,
  the 451 body lines, and the child-facing disclosure copy. Build them as written; they
  are recorded for counsel review in their ADRs, and an agent must not reword them.
- ADR-0016 needed no build; its doc touches (handler comment, roadmap citation) are
  already on the tree. The ADR-0015 and ADR-0018 launch-readiness rows already exist.
- Sequencing note: the geo boundary's exempt list names `/terms` and `/privacy`, and the
  consent checkbox links to them — the documents and the boundary land most naturally
  together or documents-first.
- The dev simulator never runs the boundary hook, so simulator-mode development is
  unaffected throughout.
