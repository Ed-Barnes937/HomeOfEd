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
