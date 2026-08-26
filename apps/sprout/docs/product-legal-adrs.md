# Architecture Decision Record (ADR) Log

The dated, append-only record of architectural decisions for the child-safe LLM.

**How this differs from the rest of `decisions/`:** the numbered files (`00-seed`
through `15-outstanding-process-steps`) are *ideation and discussion* — a snapshot of how
thinking evolved during the pre-build phase. This log is the *formal decision record* from
build onward: each entry states what was decided, when, why, and what it commits us to.

**Format.** Each ADR has an ID, title, status, date, context, decision, and consequences.
Status is one of `Proposed` · `Accepted` · `Superseded by ADR-XXXX` · `Deprecated`. Add new
ADRs at the bottom with the next sequential ID; never renumber or delete — supersede.
Entries dated `2026-04-12` are **backfilled** from the ideation docs (ideation completed
that day) so the record is complete; everything later was decided in real time.

---

## ADR-0001 — Layered, defence-in-depth guardrails ("don't trust the LLM, verify it")

- **Status:** Accepted
- **Date:** 2026-04-12 *(backfilled from `03-guardrails-tech.md`)*

**Context.** A single safety filter — system prompt, blocklist, or one model — is not
sufficient for a children's product. Provider-level safety exists but isn't configurable
per family or strict enough.

**Decision.** Stack independent safety layers rather than rely on any one. Provider safety
+ per-child system prompt + hard output blocklist + a validation step, with sensitive-topic
escalation, conversation-depth limits, context anchoring, and flag-and-forward around them.

**Consequences.** More moving parts and latency, but no single point of failure. This is
the architecture the later research validated. See `architecture/02-guardrail-pipeline-layers.md`.

---

## ADR-0002 — Validate before show (non-streaming generation)

- **Status:** Accepted
- **Date:** 2026-04-12 *(backfilled from `03-guardrails-tech.md`)*

**Context.** Streaming tokens straight to the child means unsafe content can appear before
any check completes.

**Decision.** Generate the full response non-streaming, run every output check, and only
then emit it to the child (re-chunked as SSE for UX).

**Consequences.** Adds perceptible latency; accepted as the cost of never showing a
half-checked answer. The pipeline owns no DB — it emits `flag` events; the web app persists
them.

---

## ADR-0003 — Three-opinion output validation

- **Status:** Accepted
- **Date:** 2026-06-20

**Context.** Two research passes showed the LLM-as-judge (gpt-4.1-nano) is the weak link:
story framing, apologies, and emoji can flip its verdict, and a bigger judge does not
reliably fix this. Safety improves with *decorrelated* failure modes, not more models.

**Decision.** Validate output with three non-correlated opinions: (R5) the existing general
LLM judge, (R3) a purpose-built safety classifier (Llama Guard / ShieldGemma / Detoxify),
and (R4) a non-LLM statistical classifier (fastText). Disagreement is treated as unsafe →
fallback. The deterministic blocklist (R2) sits under all three.

**Consequences.** One extra hosted call (Llama Guard ≈ $0.18/M) plus a self-hosted sidecar
for the non-LLM layer (the pipeline is Node/Hono, no Python today). Detoxify is a BERT, so
it belongs in the R3 slot, not the decorrelated R4 slot. See `architecture/02-guardrail-pipeline-layers.md`.

---

## ADR-0004 — Canonicalise on a scan-copy only; never mutate stored messages

- **Status:** Accepted
- **Date:** 2026-06-20

**Context.** Homoglyphs, zero-width characters, and leetspeak defeat the blocklist and the
judge cheaply. NFKC normalisation defeats them — but NFKC is lossy and would corrupt
legitimate child input (accented names, maths notation) if applied to stored text.

**Decision.** Run canonicalisation (NFKC, homoglyph folding, zero-width stripping, de-leet)
on a throwaway scan copy ahead of the blocklist, on both input and output. The stored child
and AI messages remain byte-for-byte unchanged.

**Consequences.** A false-positive rate on real children's messages that needs tuning
against real traffic (tracked as an open question). Sub-millisecond cost.

---

## ADR-0005 — Phase 6.5 (Guardrail Hardening) before billing

- **Status:** Accepted
- **Date:** 2026-06-20

**Context.** Mapping the research gaps against the plan showed several safety-critical items
scheduled *after* billing — a purpose-built classifier and red-teaming in Phase 10, rate
limiting in Phase 9. Shipping a paywall on top of a known-weak guardrail is the wrong order.

**Decision.** Insert **Phase 6.5 — Guardrail Hardening** between the parent dashboard
(Phase 6) and billing (Phase 7). Pull the classifier + eval harness forward from 10.1 and
core rate-limiting forward from 9.5. Phase 7 is gated on Phase 6.5 Tier P0 + P1.

**Consequences.** Billing slips later; the core product is solid before we charge for it.
See `phase-6.5-guardrail-hardening.md`.

---

## ADR-0006 — scrypt (node:crypto) for child PIN/password hashing

- **Status:** Accepted
- **Date:** 2026-06-20 *(shipped in PR #19, #17)*

**Context.** Child PINs and the child password were stored/compared as plaintext
(`pinHash = data.pin`). Pre-existing debt flagged during Phase 6 review.

**Decision.** Hash with `node:crypto` scrypt — random salt + `timingSafeEqual`, zero new
dependencies. Type-guard inputs (non-string → clean auth failure, not a 500) and enforce PIN
format server-side (4 digits → 400).

**Consequences.** No plaintext credentials at rest. Bcrypt/Argon2 were avoided to keep the
dependency surface minimal. Follow-up: the default child password is the username — force a
change on first login (Phase 6.5.11).

---

## ADR-0007 — UK launch is out of OSA user-to-user scope while text-only and one-to-one

- **Status:** Accepted
- **Date:** 2026-06-20

**Context.** Initial launch is **UK-exclusive**. The product is a one-to-one chat between a
child and the AI (gpt-4o-mini via OpenRouter), text only, with no feature letting users
share content with each other. We needed to know which UK CSAM/CSEA obligations bind us —
in particular the CSEA content reporting duty that took effect **7 April 2026**.

Ofcom's chatbot explainer states plainly: *"chatbots are not subject to regulation at all if
they only allow people to interact with the chatbot itself and no other users."* A chatbot
is in Online Safety Act scope only when it is part of a **user-to-user** service (users
share content with each other), provides **search**, or generates **pornographic material**.
The 7 Apr 2026 CSEA reporting duty (report to the NCA via CSEA-IRP) applies to **user-to-user
services only** — but where it applies there is **no size or risk threshold** and penalties
reach 10% of global revenue or £18m.

**Decision.** Treat the text-only, one-to-one launch as **outside the OSA user-to-user
regime**, and therefore **not bound by the 7 Apr 2026 CSEA reporting duty**. We do **not**
build NCA CSEA-IRP reporting or IWF hash-matching for the initial launch. Instead, 6.5.8
ships a **documented manual escalation + safe-handling path** owned by a named person, with
grooming/CSAM never resting on the general LLM judge. Criminal law on CSAM (indecent images)
applies regardless of OSA scope and is respected.

**Two triggers re-open this decision** and pull the full regime forward — they must be
satisfied *before* the feature reaches users:

1. **Any user-to-user feature** (children sharing conversations, group/community) → become a
   user-to-user service → CSEA reporting duty (NCA CSEA-IRP, no threshold) applies.
2. **Media upload or AI image generation** → indecent-images criminal regime + IWF
   hash-matching + NCA reporting.

**Consequences.** Lighter compliance lift for the initial launch; 6.5.8 is a documented
process, not a reporting integration. Risks: (a) the **parents-view-children's-conversations**
feature is the one edge that must be confirmed against the user-to-user test — *flag for
counsel, do not self-certify*; (b) this finding is **UK-only** — adding US users pulls in
COPPA + NCMEC CyberTipline reporting, and EU users pull in the EU AI Act, both of which
require re-assessment. Not legal advice; the scope determination must be lawyer-reviewed
(tracked in 6.5.8's "now" Verify). Sources: Ofcom chatbot explainer; Ofcom CSEA reporting
duty guidance; Crime and Policing Act 2026 (Royal Assent 29 Apr 2026); NCA CSEA-IRP; IWF.

**Dependency (added 2026-06-21).** This determination is valid **only while non-UK traffic
is actively prevented**. The "UK-only" premise is otherwise unenforced — anyone could
register from anywhere and drag the US/EU regimes above into scope. Enforcement is tracked
as **6.5.12** and decided in **ADR-0008**; treat the two as a single legal-posture gate.

---

## ADR-0008 — Enforce UK-only access at launch (back the ADR-0007 legal basis)

- **Status:** Accepted
- **Date:** 2026-06-21

**Context.** ADR-0007's CSAM/CSEA scope analysis assumes a UK-exclusive launch and parks the
US (COPPA + NCMEC) and EU (AI Act) regimes as "re-assess if those users arrive." Nothing in
the product currently prevents them from arriving. Basing the legal posture on an unenforced
boundary is not defensible. Note this is distinct from the OSA user-to-user finding, which
rests on service architecture (1:1, no sharing) and is geography-independent — geo-restriction
does not affect it; it limits the *compliance surface* to the UK.

**Decision.** Enforce UK-only access as a **launch-blocker**, using **reasonable measures**
(the legal standard is reasonable, not perfect — VPN leakage is accepted):

1. **Edge geo-IP block** (Fly.io / Cloudflare) — refuse non-UK requests before the app.
2. **Country at parent registration** — UK-only, with ToS restricting use to the UK.
3. *Later, with Phase 7* — **UK billing address** as a third confirmation once payments exist.

**Consequences.** A modest amount of edge + signup work becomes a hard gate before any real
user reaches the product. VPN users can still bypass geo-IP — accepted as reasonable-measures,
not a guarantee. The moment we intentionally open another market, ADR-0007 must be re-run for
that jurisdiction *before* access is granted. Lawyer-reviewed alongside 6.5.8 / 6.5.12.

---

## ADR-0009 — Documented manual grooming / CSAM escalation path (NOW tier)

- **Status:** Proposed *(pending counsel sign-off — see consequences)*
- **Date:** 2026-06-21

**Context.** Phase 6.5 item 6.5.8 is mandatory and must **never** rest on the general LLM
judge. [ADR-0007](#adr-0007--uk-launch-is-out-of-osa-user-to-user-scope-while-text-only-and-one-to-one)
determined the text-only, one-to-one UK launch is outside the OSA user-to-user regime, so
the NOW-tier deliverable is a *documented manual escalation + safe-handling path*, not an
NCA CSEA-IRP / IWF reporting integration (those are the GATED tier).

**Decision.** Adopt a documented manual escalation & safe-handling runbook
([`safeguarding/csam-grooming-escalation.md`](safeguarding/csam-grooming-escalation.md)),
owned by a named **Designated Safeguarding Lead** (never an LLM, never the validation judge).
Grooming/CSAM signals surface through the existing flag pipeline + human reports and are
triaged manually by the DSL, who owns the reporting decision via UK public routes
(999/101, CEOP/NCA, MASH/NSPCC). No new detector, flag type, or reporting integration is
built at NOW tier. The two ADR-0007 triggers (user-to-user feature; media upload / image
generation) pull the full regime forward before they reach users.

**Consequences.** Lightest compliant lift for a text-only 1:1 launch; the human-in-the-loop
is explicit and decorrelated from the automated stack. **Gating:** the runbook is *not live*
until (a) counsel reviews it and ADR-0007, (b) the parents-view-conversations edge is
confirmed against the user-to-user test, and (c) the DSL/deputy/counsel placeholders are
filled with named people. **The introducing PR must not be self-merged — it requires human
legal review.** Not legal advice.

---

## ADR-0010 — R4 (the decorrelated non-LLM vote) is a pure-JS lexical classifier, not fastText

- **Status:** Accepted
- **Date:** 2026-06-21 *(shipped in Phase 6.5.2)*

**Context.** ADR-0003 names the R4 slot "a non-LLM statistical classifier (fastText)" and its
consequences anticipate "a self-hosted sidecar for the non-LLM layer (the pipeline is
Node/Hono, no Python today)." Implementing *literal* fastText needs a trained model artefact;
no off-the-shelf child-safety fastText model exists, so it would pull in a Python training
pipeline plus the very sidecar the architecture avoids — ballooning a safety-critical PR. The
architecture reference (`02-guardrail-pipeline-layers.md`) already blesses the alternative,
naming the slot "**fastText / pure lexical**".

**Decision.** Implement R4 as a self-contained **pure-JS lexical/statistical classifier**
(`apps/sprout-pipeline/src/lexical-classifier.ts`): canonicalise a scan copy (reusing 6.5.1), then
score weighted lexical features across the *semantic* harm categories the deterministic R2
blocklist structurally cannot reach — self-harm euphemism and reproduction/sexual framing.
Zero dependencies, no network, no Python, no sidecar; deterministic and sub-millisecond. It
fills the same decorrelated-third-vote role as fastText (it fails on genuinely different
inputs from the two transformers) while keeping the Node/Hono pipeline self-contained.

R3 stays as specified — Llama Guard 3 (8B) via OpenRouter (`safety-classifier.ts`). The two
network opinions (R3, R5) run concurrently; R4 is synchronous. Any disagreement → unsafe →
safe fallback (`opinion-vote.ts`).

**Consequences.** No new infra or Python; the base branch for the Track B stack stays clean.
Because R4 is deterministic and offline (unlike R3/R5), it also runs inside the 6.5.3 eval
harness as a CI-gating layer — the harness bypass rate dropped from 39.3% to 25.0% (four
previously-documented self-harm / reproduction-framing bypasses now caught). R4 runs on
**both paths**, mirroring the R2 blocklist: on the child input as a sensitive-topic signal
(`index.ts` Step 1 — a hit routes through the existing escalation + parent-flag path, not a
cold block, because its categories *are* sensitive topics) and on the model output in the
three-opinion vote (Step 6). So the harness scoring R4 on the trick-set text matches
production on either path. Because R4 favours **precision over recall** (under "any
disagreement → unsafe" a false positive blocks a legitimate reply / emits a false flag), bare
"hurt/cut myself" and similar are deliberately left to other layers. Trade-off: a
hand-curated lexicon has narrower recall than a trained classifier and needs maintenance as
new framings appear; a trained fastText model (with a sidecar) remains a future option if
lexical recall proves insufficient against real traffic. Does **not** supersede ADR-0003 —
it refines the R4 implementation choice within it.

---

## ADR-0011 — UK-only enforcement layers: app-level hook is load-bearing, edge WAF is belt-and-braces

- **Status:** Accepted *(for counsel review alongside ADR-0008 — not self-certified)*
- **Date:** 2026-07-29

**Context.** ADR-0008 measure 1 says "edge geo-IP block (Fly.io / Cloudflare) — refuse
non-UK requests before the app" without saying *where*. Research against primary vendor docs
(`.scratch/sprout-launch-clearance/assets/uk-geo-primitives-research.md`) established: the
Cloudflare free plan CAN block by country via a WAF custom rule (`ip.src.country`, 5-rule
quota) but CANNOT customise the block page (visitors get Cloudflare's unbranded Error 1020;
custom responses are Pro+); Fly has no geo primitive of any kind; Fly health checks run over
the app's private network, so an edge rule can never flap a machine but an app-level rule
applied to `/health` would fail every check; CI smoke tests hit
`https://hoe-sprout.fly.dev/health` directly from US runners, bypassing Cloudflare entirely;
and `hoe-sprout.fly.dev` is publicly reachable, so edge-only enforcement is bypassable by
anyone who knows the Fly hostname.

**Decision.** Enforce the UK boundary in **both layers, with the app-level layer
load-bearing**:

1. **The layer the legal posture rests on is an app-level Fastify `onRequest` hook** in
   sprout's `createAppServer` wiring, reading `CF-IPCountry`. It is versioned in the repo,
   reviewed, unit-testable over `createAppServer` (the `chat-sse.test.ts` pattern), and
   exercised in the docker stack — which is what makes the measure *defensible* under
   ADR-0008's reasonable-measures standard. A dashboard-only rule is none of those things.
2. **Exempt paths: `/health` only.** Everything else is enforced, explicitly including
   `/api/auth/*` (a non-UK parent must not be able to register or sign in) and
   `POST /api/chat/stream`. The deep health check returns no user data, so the exemption
   leaks nothing.
3. **The Cloudflare WAF country rule ships ON from launch** as belt-and-braces, matching
   ADR-0008's literal "edge geo-IP block … before the app". It is not load-bearing.
   Accepted consequence: edge-blocked visitors see the unbranded Cloudflare 1020; the app's
   own refused response (ticket 04) is seen only by traffic that bypasses the edge.
4. **The CI smoke staying on `.fly.dev` is a recorded constraint, not an accident.** Smoke
   URLs must stay on `hoe-<app>.fly.dev` and touch only geo-exempt paths: they deliberately
   verify Fly deployment health independent of Cloudflare, and a through-Cloudflare smoke
   would be 403'd from US runners by the WAF rule. Carried as a comment in
   `.github/workflows/deploy.yml`.
5. **The `.fly.dev` header-spoofing residual is an accepted risk.** With the hook refusing
   requests that carry no country header (ticket 03's fail-closed handling — this ADR
   depends on it), the only way through via the Fly hostname is deliberately forging
   `CF-IPCountry: GB`. That is more deliberate circumvention than the VPN bypass ADR-0008
   already accepts. The known hardening, if the posture ever needs tightening: a Cloudflare
   Transform Rule stamping a shared-secret header that the hook requires (free plan, 10-rule
   quota), plus an origin-IP allowlist. Deliberately not shipped at launch.
   *(2026-08-01: the ticket-03 dependency is discharged — missing-header handling resolved
   **fail-closed**; the full matrix is ADR-0012.)*
6. **`hoe-sprout-pipeline` needs nothing.** Confirmed: no `[http_service]`, no
   `[[services]]`, no public IPs (its `fly.toml` and `go-live.md` forbid allocating any) —
   it is reachable only on the private 6PN network via `.flycast`. No geo boundary applies.

**Consequences.** `docs/go-live.md` gains two human-gated Cloudflare steps: create the WAF
custom rule (its expression's handling of the `XX`/`T1` geolocation-failure sentinels must
match whatever ticket 03 decides for the app layer), and verify the zone's IP Geolocation
setting is on (without it the hook never sees `CF-IPCountry` — ticket 11). The refused-visitor
response is rendered by the hook itself, not the SPA — the SPA shell sits behind the boundary
(shapes ticket 04). The boundary's test strategy follows the layer: unit tests over
`createAppServer` asserting refusal/exemption per path, no docker-stack-only proof needed.
This ADR depends on ticket 03 resolving missing-header handling as fail-closed for non-exempt
paths; if 03 decides otherwise, revisit item 5. *(2026-08-01: resolved fail-closed —
ADR-0012 records the refusal matrix, `/health` exemption mechanism, and environment
controls.)* Implements ADR-0008 measure 1; does not supersede it.

---

## ADR-0012 — UK-boundary refusal matrix, `/health` exemption, and environment controls

- **Status:** Accepted *(for counsel review alongside ADR-0008 / ADR-0011 — not self-certified)*
- **Date:** 2026-08-01

**Context.** ADR-0011 made the app-level Fastify hook the load-bearing UK-boundary layer and
left three things open to ticket 03: what the hook does for every value of `CF-IPCountry`,
how `/health` is exempted, and how non-production environments get past a hook they can never
satisfy. Established facts: behind Cloudflare the header is never *absent* — geolocation
failure yields the sentinels **`XX`** (unknown) and **`T1`** (Tor) — so a missing header
strictly means the request did not come through Cloudflare (Fly health checks, direct
`hoe-sprout.fly.dev`, CI smoke). The dev simulator never runs the hook (simulator mode is the
Vite-plugin dispatch; `createAppServer` is not in that path), CI smoke touches only `/health`,
and the docker stack runs the production image with `NODE_ENV=production` — so `NODE_ENV`
cannot distinguish the docker stack from Fly.

**Decision.**

1. **Refusal matrix — allow `GB` only.** On every non-exempt path the hook applies one
   predicate: `CF-IPCountry === 'GB'` passes; everything else is refused.

   | `CF-IPCountry` | Meaning | Hook |
   |---|---|---|
   | `GB` | UK visitor | allow |
   | any other country code | known non-UK | refuse |
   | `XX` | geolocation unknown | refuse |
   | `T1` | Tor | refuse |
   | *(missing)* | did not come through Cloudflare | refuse (**fail-closed**) |

   Refusing `XX` is a knowing choice: a genuine UK visitor Cloudflare cannot geolocate is
   refused. The posture is "non-UK traffic is actively prevented" (ADR-0007/0008); admitting
   traffic we cannot place would invert it into "admitted unless proven foreign". Refusing
   `T1` follows the same logic — Tor deliberately conceals location. Fail-closed on missing
   discharges the dependency ADR-0011 item 5 rests on: the only way through the `.fly.dev`
   hostname is deliberately forging `CF-IPCountry: GB`.
2. **The WAF rule runs the identical predicate.** The go-live WAF custom rule expression is
   `ip.src.country ne "GB"`, which blocks `XX` and `T1` by construction — the edge and the
   app can never disagree about a sentinel. This is the concrete spec for the human go-live
   step named in ADR-0011's consequences.
3. **`/health` is exempt by exact string match only** (`req.url === '/health'`): no prefix
   match (a future `/health-ish` route must not inherit the exemption), query-stringed
   variants are **not** exempt, and nothing stronger is layered on (no token, no source-IP
   check, no second port). The deep health check returns `{ ok: true }` and leaks nothing;
   its two consumers — Fly health checks and the `.fly.dev` CI smoke (ADR-0011 item 4) —
   both need it plain and unauthenticated.
4. **Environment escape hatch: an explicit opt-out with a boot guard.** Enforcement is ON by
   default; setting `GEO_ENFORCEMENT=off` disables the hook. Only `compose.yml` sets it (the
   docker stack serves headerless browser traffic from the prod image). `main.ts` **fails
   fast at boot if the variable is set while `FLY_APP_NAME` is present** — Fly injects
   `FLY_APP_NAME` into every machine, so a disable flag that reaches real infrastructure
   crashes the deploy visibly rather than silently opening the boundary (the same fail-fast
   idiom `main.ts` uses for `CHILD_SESSION_SECRET`). The dev simulator and CI smoke need no
   hatch (see context).

**Consequences.** The go-live checklist gains the concrete WAF expression (item 2) and a
verify step that `GEO_ENFORCEMENT` is unset on the Fly app (the boot guard is the backstop,
the checklist line is the courtesy). Ticket 04's refused-visitor response is reshaped: with
the WAF blocking non-GB/`XX`/`T1` at the edge, the hook-rendered refusal is seen almost
exclusively by headerless direct-`.fly.dev` traffic — it cannot name a country (a missing
header has none) and should be one generic, self-contained response. The boundary's unit
tests (over `createAppServer`, per ADR-0011) assert every matrix row per path, including
`/healthx`-style near-misses of the exemption. Flagged on the launch-readiness gate's
"UK-only enforcement is confirmed adequate" item for counsel review — recorded, not
self-certified. Refines ADR-0011 (discharges its ticket-03 dependency); does not supersede it.
*(2026-08-01: ticket 04 resolved — the refused response itself is decided in ADR-0013:
`451`, one generic self-contained status-notice document.)*

---

## ADR-0013 — The refused-visitor response: `451` + one generic self-contained status notice

- **Status:** Accepted *(for counsel review alongside ADR-0008 / 0011 / 0012 — not self-certified)*
- **Date:** 2026-08-01

**Context.** ADR-0011 decided the app-level hook renders the refusal itself (the SPA shell
sits behind the boundary), and ADR-0012 fixed both the refusal matrix and the audience: with
the WAF rule ON (`ip.src.country ne "GB"`), through-Cloudflare refused visitors get
Cloudflare's unbranded Error 1020 and never reach the hook, so the hook's response is seen
almost exclusively by **headerless direct-`.fly.dev` traffic** — curl, scanners, the odd
human who found the Fly hostname — plus any window where the WAF rule is absent. Two design
constraints carry over: **one generic response** for every refused matrix row (no branching
on the header value) and it **cannot name a country** (a missing header has none). Three
structurally different self-contained documents were prototyped
(`.scratch/sprout-launch-clearance/assets/refused-visitor-prototype.html`) and reviewed.

**Decision.**

1. **Status code `451 Unavailable For Legal Reasons`** (RFC 7725), not `403`. It is the
   semantically honest description of why the boundary exists. Noted for counsel: `451`
   itself characterises the refusal as legal in nature, while our block is a voluntary
   compliance-posture choice (ADR-0007/0008), not a response to a legal demand — a
   legitimate use of the code, but a characterisation we record rather than self-certify.
2. **Body: the "status notice" document** — a single self-contained static HTML page
   (inline styles only, no assets, no scripts, well under 1 KB), dark, monospace,
   leading with the status code and reason phrase, then two lines:
   *"Sprout is only available in the United Kingdom."* and
   *"Sprout is UK-only while we complete our safety and legal work."*
   Chosen over a bare text-flow page and a branded card because it speaks to the audience
   that actually reaches it — people at a terminal — and stays legible as raw bytes in curl.
3. **The body says why.** The why-line is honest and matches ADR-0007's posture; the
   VPN-invite concern is moot because ADR-0008 already accepts VPN leakage as a
   reasonable-measures residual. The copy is plain product prose — any future edit that
   drifts toward a legal assertion goes to counsel first.
4. **No contact form or waitlist at launch.** The audience is mostly not parents abroad
   (ticket 03's finding); nothing to moderate, nothing to maintain.
5. **Response headers:** `content-type: text/html; charset=utf-8` and
   `cache-control: no-store` (a refusal must never be served stale from a cache if the
   boundary posture changes).

**Consequences.** The build is handed to `/tdd`: the ADR-0012 hook returns this exact
document with `451` for **every** refused matrix row, and the boundary unit tests (over
`createAppServer`, per ADR-0011) assert status and body per row. No new go-live step — the
response is versioned app code, not infrastructure. Useful diagnostic signature: if the
zone's IP Geolocation setting is off, the hook sees no `CF-IPCountry` on through-Cloudflare
requests, so **genuine UK visitors seeing this 451 page is the symptom that the setting is
off** (ticket 11). The prototype is a throwaway asset, not the implementation source.
Refines ADR-0011/0012; does not supersede either.

## ADR-0014 — UK residence attestation at parent registration (server-stamped, erased with the account)

- **Status:** Accepted *(for counsel review alongside ADR-0008 / 0011 / 0012 — not self-certified;
  the checkbox label copy is explicitly flagged for counsel)*
- **Date:** 2026-08-02

**Context.** ADR-0008 measure 2: "country at parent registration — UK-only, with ToS
restricting use to the UK." `ParentRegisterPage.tsx` collects name, email and password only.
Two facts shape the design. First, ADR-0012's geo gate already refuses every non-GB request
except `/health` before Better Auth sees it, so **presence** in the UK at registration time is
proven by enforcement — a country picker with one permitted option would capture nothing the
gate doesn't. What the gate cannot prove is **residence** (a tourist in London passes it).
Second, the app has never been deployed (P11 outstanding), so no accounts predate the field.

**Decision.**

1. **A required attestation checkbox, worded as residence** — proposed copy: *"I confirm I
   live in the United Kingdom"* — not a country `<select>`. The measure is a captured
   **claim**, complementing the gate's proof of presence. The exact label wording carries
   legal weight on a children's product and **goes to counsel**, not self-certified here.
2. **Stored as a Better Auth `additionalField` on the `user` table**, following the
   `subscriptionStatus` precedent: column `uk_residence_attested_at timestamptz NOT NULL`,
   landed as a committed drizzle-kit migration. No backfill needed and `NOT NULL` is safe —
   no production accounts exist.
3. **The server-side check is load-bearing** (same logic as ADR-0011's hook): the signUp
   payload carries the attestation, and a Better Auth `databaseHooks.user.create.before`
   hook **rejects any signup without a true attestation** and stamps the column with
   **server** time. The form checkbox is UX; the hook is the control — testable and
   versioned.
4. **The attestation is erased with the account.** No post-erasure evidence retention at
   launch: retaining identity-linked personal data past an erasure request needs its own
   lawful basis, and on a children's product the bias runs toward erasure-means-erasure.
   The *mechanism* (versioned hook + tests + migration + this ADR) is the evidence that
   every existing account attested. Knowing choice, counsel-flagged; if counsel wants a
   post-erasure erasure-log, that is a follow-up feature. (`Store.deleteUser` exists but no
   handler exposes it — erasure is currently an operator action.)
5. **No attestation-vs-geo conflict handling.** Structurally precluded: the ADR-0012 gate
   refuses non-GB traffic upstream of registration, and the `.fly.dev` header-spoofing
   residual is already accepted (ADR-0011). The existing flags pipeline could not take a
   registration flag anyway (`flags.childId` is `NOT NULL` — flags are child-scoped, and no
   child exists at parent registration). `CF-IPCountry` is **not** stored at registration:
   it would always read `GB`, adding a personal-data field for zero information. The VPN
   case (a genuine non-resident with a UK exit node) defeats geo and attestation alike; the
   attestation existing is the reasonable-measures answer to it.

**Consequences.** The build is handed to `/tdd`: the migration, the `additionalField`, the
before-create hook (unit-tested: signup without attestation rejected; timestamp is
server-stamped), and the registration-form checkbox. The ToS/consent gate (ticket 06) shares
the registration form and should reference this ADR; nothing here blocks it. Implements
ADR-0008 measure 2; refines nothing.

---

## ADR-0015 — ToS/Privacy pages: geo-exempt static documents, skeleton drafts, and a second consent checkbox

- **Status:** Accepted *(for counsel review alongside ADR-0008 / 0011 / 0012 / 0014 — not
  self-certified; the checkbox label copy is explicitly flagged for counsel)*
- **Date:** 2026-08-05

**Context.** ADR-0008 measure 2 requires "ToS restricting use to the UK", but the UK-only
measure has nowhere to land: `SettingsPage.tsx` links "Privacy Policy" and "Terms of
Service" as dead `href="#"`, and neither route nor page exists. The binding legal prose is
out of scope for any agent — it is drafted by a human with counsel — so this ADR decides
the *container*: routes, placement relative to the ADR-0011/0012 geo boundary, placeholder
content, where counsel's brief lives, and how agreement is captured at registration
alongside ADR-0014's residence attestation. Relevant facts: ADR-0012 made `/health` the
only geo-exempt path; ADR-0013 established the self-contained-static-document pattern; the
app has never been deployed, so no real user can see anything shipped before launch.

**Decision.**

1. **`/terms` and `/privacy` are geo-exempt.** The exempt-path list becomes three exact-match
   strings: `/health`, `/terms`, `/privacy` (same mechanism as ADR-0012 item 3 — exact match
   only, query-stringed variants not exempt). The load-bearing argument is privacy
   transparency: the privacy policy is not just for prospective users — a UK parent abroad
   is a data subject whose child's data we already hold, and UK GDPR transparency does not
   stop at the border. `/terms` rides along so the two legal links never behave
   inconsistently. Refines ADR-0012's exempt list; counsel-flagged with it.
2. **Served as self-contained static HTML documents from app code** (the ADR-0013 pattern:
   inline styles, no external assets, versioned and unit-testable), **not SPA routes**. SPA
   routes would need `index.html` plus every `/assets/*` bundle geo-exempted — a wildcard
   exemption that guts ADR-0012's narrow posture. Consequence: the pages look like
   documents, not app screens — correct for legal text. The `SettingsPage.tsx` links become
   plain `<a href="/terms">` / `<a href="/privacy">` full-page navigations.
3. **Until counsel drafts the real text, each page is a skeleton, not fake prose:** a
   prominent "**Draft — not yet in force**" banner, then the section headings from the
   clause brief (item 4) with one-line notes of what each section will cover. No invented
   legal sentences that an eyeball could mistake for binding terms. This is safe
   structurally, not typographically: a new launch-readiness row (counsel-owned) blocks
   release until the placeholders are replaced, and the app has never been deployed.
4. **Counsel's brief lives in [`legal-content-requirements.md`](legal-content-requirements.md)**
   — one section per document (ToS, Privacy Policy), each required clause tracing to the ADR
   or mechanism it comes from. The launch-readiness row links to it and the skeleton pages'
   headings mirror it: one source of truth, three consumers. It is assembly of
   already-decided facts, not new legal drafting.
5. **A second, separate consent checkbox at registration** — proposed copy: *"I agree to the
   Terms of Service and have read the Privacy Policy"*, both phrases linking to the pages
   (label copy **goes to counsel**). Not bundled with ADR-0014's residence attestation: the
   attestation is a statement of fact, ToS agreement is contract formation, and one
   timestamp bundling both claims is weaker evidence for each. You *agree* to terms and
   *acknowledge* a privacy policy, so one control covers both.
6. **Stored symmetrically with ADR-0014:** Better Auth `additionalField`
   `tos_agreed_at timestamptz NOT NULL` on `user`, stamped with **server** time by the same
   `databaseHooks.user.create.before` hook, which rejects any signup without agreement. The
   checkbox is UX; the hook is the load-bearing control. Erased with the account
   (ADR-0014 item 4's reasoning applies unchanged).
7. **No ToS version column at launch.** The launch-readiness row means no user can register
   before the counsel text lands, so every launch-era agreement is against v1. A
   re-acceptance flow for future ToS revisions is deliberately deferred — recorded here,
   not built.

**Consequences.** The build is handed to `/tdd`: the two static documents + routes, the
exempt-list extension (boundary unit tests over `createAppServer` gain rows asserting
`/terms` and `/privacy` pass headerless and `/terms?x=1`-style variants do not), the
`SettingsPage.tsx` anchor fix, the second checkbox, the `tos_agreed_at` migration, and the
before-create hook extension (unit-tested: signup without agreement rejected;
server-stamped). `launch-readiness.md` gains the counsel-owned "placeholders replaced" row.
Implements the container for ADR-0008 measure 2; refines ADR-0012 (exempt list) and extends
ADR-0014's hook; supersedes nothing.

---

## ADR-0016 — Safe-by-default preset: the property holds at the read seam; explicit choice stays required at creation

- **Status:** Accepted *(for counsel review alongside the 6.5.9 posture — not self-certified)*
- **Date:** 2026-08-07

**Context.** 6.5.9's "safe-by-default" half was marked ⚠️ unconfirmed: `createChildHandler`
takes `presetName` as **required** input (zod rejects its omission — no server-side
fallback), while `getChildConfigHandler` carries a comment claiming a strictest-preset
fallback, and the two read as contradictory positions. Verification against the tree
resolved the tension: the fallback is **real, shared, and tested** — `loadChildConfig.ts`
resolves a child with **no preset row** to the `early-learner` sliders, it is the single
loader behind all three read paths (parent dashboard `children.config`, the child's own
`children.myConfig` session-limit gate, and the chat SSE route), and
`getChildConfigHandler.test.ts` asserts the no-row fallback. Slider-by-slider check of
`PRESET_DEFINITIONS`: `early-learner` is `1` (most protective) on all six restriction
sliders **and** `5` on `parentVisibility`, whose protective end is high (`5` = full
conversation review) — so it is genuinely the strictest preset on all seven axes, and
"strictest" is a single preset, not a composite. The onboarding UI already pre-selects it
(`INITIAL_ONBOARDING_DATA`).

**Decision.**

1. **The safe-by-default property holds at the read seam, and that is the recorded
   posture.** The config that actually governs a child's chat comes from `loadChildConfig`,
   which fails safe to the strictest preset whenever no preset row exists. This is the
   load-bearing control: versioned, shared by every consumer, unit-tested.
2. **`presetName` stays required at creation — deliberately.** A rejected call is not an
   unsafe child. Making the preset optional with a silent server default would let a buggy
   client create a child on a configuration the parent never saw; the zod rejection is a
   loud failure instead. ADR-0008's framing is parental choice as the control — an explicit,
   required choice at creation is stronger evidence of that choice than a default.
3. **`early-learner` is the verified strictest preset.** Confirmed per-slider, including
   the inverted `parentVisibility` axis. Any future preset edit that dethrones it must
   revisit the `loadChildConfig` fallback in the same change.
4. **Onboarding keeps the strictest preset pre-selected.** The parent sees the selection on
   screen and can change it; if a UI regression ever skips the step, what flows through is
   the strictest option. In the UI there is no zod boundary to make non-interaction loud,
   so the safe state wins over the forced click.
5. **The non-transactional create gap is an accepted residual.** `createChildHandler` makes
   two store calls (`createChild`, then `createPreset`); if the second fails, a child row
   exists without a preset row — exactly the state the read-seam fallback covers, and the
   failure direction is "child is safer than the parent chose". A store-level transaction
   seam would be build cost for no safety gain; deliberately not built.

**Consequences.** No behavioural build: the control and its test already exist. Two doc-level
touches: `createChildHandler` gains a one-line comment citing this ADR so the
required-by-design position is visible at the seam (removing the apparent contradiction the
⚠️ was based on), and the guardrail roadmap's 6.5.9 entry cites this ADR for its
safe-by-default half — the ⚠️ itself clears only when the honest-disclosure half (ticket 08)
and parent flag visibility (ticket 09) are confirmed. Backs the 6.5.9 legal posture;
counsel-flagged with it. Refines nothing; supersedes nothing.

---

## ADR-0017 — Child-facing honest disclosure: first-run statement card plus a persistent line, per-preset wording

- **Status:** Accepted *(for counsel review — the child-facing copy below is part of the
  6.5.9 disclosure posture, not self-certified)*
- **Date:** 2026-08-07

**Context.** 6.5.9's "honest disclosure" half. The parent-facing disclosure exists
(`FlagsPage.tsx`, "What this can and can't do"); verification against the tree found **no
child-facing disclosure anywhere** — none of the child surfaces state that Sprout is a
computer, and the new-chat empty state ("Ask me anything! I'm here to help you learn.")
speaks in the first person without saying what "I" is. The pipeline system prompt
(`apps/sprout-pipeline/src/prompt.ts`) carries only a **negative** rule ("You must NEVER
pretend to be a real person or claim to be human") — always present, all presets — but no
positive instruction to plainly say what it is when a child asks directly; deflection would
technically comply. Three placements were prototyped on a facsimile of the chat surface
(asset linked from launch-clearance ticket 08): a persistent header line, an
introduce-itself first bubble, and a first-run card plus persistent input line. The card +
input-line variant was chosen, with the parent-visibility sentence kept.

**Decision.**

1. **Placement: a first-run statement card plus a persistent one-line disclosure.** The
   new-conversation empty state is replaced by a statement card (🤖, "I'm Sprout!", the
   per-preset lines below); a small muted disclosure line sits **above the chat input on
   every chat screen** (new and continue), so the disclosure survives mid-conversation
   without becoming header wallpaper. Two moments, two failure modes covered: the card is
   the explicit statement at the start; the line is the persistent reminder.
2. **The disclosure includes the parent-visibility sentence.** Honest disclosure covers
   monitoring, not just non-humanity: the child is told their grown-up can see the chats.
   This is code-true unconditionally today — `authorizeChildRead`/`authorizeConversationRead`
   grant the owning parent full read at every `parentVisibility` setting (the slider's
   advertised low end, "Summaries & flags only", is not enforced anywhere). The chosen
   wording ("can see what we talk about" / "can see your chats") stays true under both a
   full-read and a summaries-and-flags regime; if visibility enforcement ever lands, this
   sentence must be re-verified in the same change.
3. **Wording varies by preset register — one voice, three reading levels.** A disclosure a
   child can't read isn't a disclosure; vocabulary slider 1 targets reading age 5–7 while
   `independent-explorer` gets full natural vocabulary. This resolves the map's per-preset
   fog note inside this decision — no separate ticket. The copy (counsel-reviewable):

   | Preset | Persistent line (chrome voice) | Card lines (AI voice) |
   |---|---|---|
   | `early-learner` | Sprout is a computer, not a person. Your grown-up can see your chats. | I'm a computer, not a person. · I can help you learn things. · Sometimes I get things wrong. A grown-up can help you check. · Your grown-up can see what we talk about. |
   | `confident-reader` | Sprout is a computer program, not a person. Your parent can see your chats. | I'm a computer program, not a real person. · I can help you learn and explore. · Sometimes I get things wrong — it's worth checking with a grown-up. · Your parent can see what we talk about. |
   | `independent-explorer` | Sprout is an AI — a computer program, not a human. Your parent can see your conversations. | I'm an AI — a computer program, not a human. · I can help you learn, explore, and think things through. · I can be wrong, so check important things with a person you trust. · Your parent can see our conversations. |

4. **The system prompt gains a positive identity instruction.** Alongside the existing
   negative blocker, `prompt.ts` instructs: if the child asks whether Sprout is a real
   person or a human, answer plainly that it is a computer program, not a person — because
   the moment a child asks is the moment the disclosure actually matters. One sentence,
   always present, all presets (like the blocker it complements).

**Consequences.** Build handed to `/tdd`: (a) the statement card and persistent input line
in the sprout SPA (`ChatNewPage`/`ChatContinuePage`/chat input area), wording selected by
the child's preset from `children.myConfig`; (b) the one-sentence positive instruction in
`apps/sprout-pipeline/src/prompt.ts` with a `prompt.test.ts` assertion. The roadmap's 6.5.9
disclosure half cites this ADR as decided (the ⚠️ clears when the build lands and ticket 09
confirms parent flag visibility). The unenforced `parentVisibility` low end is recorded here
as an observed gap, not widened or fixed — any future enforcement must keep item 2's
sentence true. Counsel-flagged: the child-facing copy and the monitoring-disclosure framing.

## ADR-0018 — Launch-day behavioural limit values: ship the code defaults, extend signal retention to 7 days

- **Status:** Accepted *(counsel note: item 2 extends retention of children's behavioural
  metadata from 24 hours to 7 days — a data-retention posture change, flagged, not
  self-certified)*
- **Date:** 2026-08-19

**Context.** 6.5.6's thresholds (`apps/sprout/src/server/behavioural-limits.ts`) were
recorded as "placeholders until tuned against real traffic" — but there is no traffic
before launch, so launch-day values must be chosen deliberately. All nine knobs are
env-var-driven (`RATE_LIMIT_*`), so this is a values decision, not a code change. Facts
that shaped it: a throttle already writes a `rate_violation` row to `behavioural_events`
(and every pipeline guardrail flag writes a `probe` row), so firing rates are queryable
without new telemetry; the on-path prune caps that visibility at `RATE_LIMIT_RETENTION_S`;
a throttle's `Retry-After` equals the full window (60 s velocity, 5 min probe, 1 h device
reputation); the PIN lockout is keyed per child.

**Decision.**

1. **Launch values are the code defaults for eight of the nine knobs.**
   - `RATE_LIMIT_MAX_MESSAGES` stays **20**/min: to trip it a child must send every 3 s
     sustained while ignoring streaming replies, and the false positive is a gentle
     "take a short break" clearing in 60 s — an acceptable, arguably desirable, pause on
     a children's product. (Raising to 60 was considered and rejected: it only catches
     scripts.)
   - The probe limits stay strict **by intent** (4 flags / 5 min per child; 8 / hour per
     device): they back the 6.5.6 safety claim, a session that trips four guardrail flags
     in five minutes *should* pause whatever the child's intent, and each pause gives the
     parent-facing flag log time to be seen. Err strict at launch; loosen against real
     traffic if parents report friction.
   - The PIN lockout stays at **5 failures / 15 min**: sweeping half a 4-digit PIN space
     at that rate takes ~3 weeks of continuous guessing, and the false-positive cost (a
     child fumbling their own PIN) is a 15-minute wait. The lockout is per-child, so a
     sibling guessing at another child's PIN locks the target's entry, not their own
     device — a nuisance vector that only ever denies access; accepted.
2. **`RATE_LIMIT_RETENTION_S` rises from 86400 to 604800 (7 days)** so the tuning input
   (item 3) survives the whole first week, not just the last day. Retention must only be
   ≥ the largest window (3600 s), so this is safe; the worker's 30-day sweep
   (`BEHAVIOURAL_EVENT_RETENTION_DAYS`) remains the outer backstop, so 7 days stays inside
   the existing retention posture. The rows are safety-mechanism metadata only (childId,
   deviceToken, kind, timestamp — no message content), retained for a stated purpose
   (launch tuning), with intent to drop back towards 24 h once the limits are settled.
3. **No firing-rate telemetry is built for launch.** Visibility is pull-based: the
   existing `behavioural_events` rows are the tuning input, via

   ```sql
   SELECT kind, count(*) FROM behavioural_events
   WHERE created_at > now() - interval '7 days'
   GROUP BY kind;
   ```

   (add `child_id` to the grouping to spot one child tripping everything). Nobody is
   alerted — someone must go and look — which is proportionate for a launch with a
   handful of families.
4. **All nine values are pinned explicitly in `fly.toml [env]`**, including the eight that
   match code defaults. They are tuning knobs, not secrets: pinning makes the whole launch
   posture readable in one versioned block, and every future tune a one-line reviewable
   diff. No new go-live step — the values apply on an ordinary deploy.
5. **A week-one review is the follow-up, not a gate.** After the first week of real
   traffic, run the item-3 query, adjust values (a `fly.toml` diff), and record the
   outcome. Post-launch by definition, so it is deliberately *not* a launch-readiness row.
6. **One launch-readiness row is added** (dev-owned, code-side, agent-tickable once the
   `fly.toml` change is on `main`): the pinned values exist and match this ADR. This also
   settles the open question of whether other code-side items deserve gate rows — this is
   the only one left wanting.

**Consequences.** `fly.toml [env]` gains the nine `RATE_LIMIT_*` values (done alongside
this ADR — no `/tdd` handoff; env values have no unit-testable seam of their own, and the
`numEnv` fallback behaviour is already covered). The roadmap's 6.5.6 confirm-bullet cites
this ADR: thresholds are now *chosen*, with tuning scheduled against week-one traffic
rather than left open. Counsel-flagged: the item-2 retention extension.

---

## ADR-0019 — Supervised family pilot precedes counsel sign-off; invite-code-closed registration

- **Status:** Accepted *(a deliberate, owner-accepted deferral of the launch-readiness
  legal gate — recorded, not self-certified; the gate itself is unchanged)*
- **Date:** 2026-08-26

**Context.** Every launch-clearance build (tickets 12–17) has landed, but the
[launch-readiness gate](launch-readiness.md) blocks release to real users on counsel
sign-off (ADR-0007 scope review, the parents-view-conversations edge, the written-content
position, real ToS/Privacy text) and on the safeguarding runbook's named-people
placeholders. Counsel review has no start date. The product owner wants their own
children using the product under their direct supervision now, and will commission the
counsel review once the product is stable.

**Decision.** Run a **supervised family pilot** before the legal gate closes, under these
conditions:

1. **The cohort is the owner's household only.** Registration is closed behind a
   server-checked invite code (`REGISTRATION_INVITE_CODE`, checked in a Better Auth
   API-level sign-up hook, never persisted). The env var is **required in production**
   for the pilot's duration — a missing value crashes boot rather than silently opening
   registration. The invite code is not published anywhere.
2. **Every launched control stays live**: the UK geo boundary (ADR-0011–0013), residence
   attestation + ToS consent (ADR-0014/0015), safe-by-default presets (ADR-0016), honest
   disclosure (ADR-0017), behavioural limits (ADR-0018), and the full guardrail pipeline.
3. **The owner acts as de facto safeguarding lead** for the pilot: they are the only
   parent, supervise use directly, and review the flag log. The runbook's DSL/deputy/
   counsel placeholders remain open items for public launch — the pilot does not fill
   them.
4. **The launch-readiness gate is deferred, not ticked.** No counsel checkbox is marked;
   the gate document gains a note recording this ADR as the authority for the pilot.
   Opening registration to anyone outside the household — publishing the invite code,
   adding families, removing the env requirement — **is the release the gate protects**
   and re-blocks on the full gate.

**Consequences.** The owner knowingly accepts the legal risk of operating pre-sign-off
for their own family; the risk surface is the smallest available (one household, direct
supervision, all technical controls live). The go-live runbook gains
`REGISTRATION_INVITE_CODE` as a required secret. Public launch later requires: counsel
sign-off per the gate, named safeguarding people, counsel-drafted ToS/Privacy text, and a
deliberate decision to relax or remove the invite gate (its own ADR). Not legal advice.
