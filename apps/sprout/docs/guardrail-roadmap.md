# sprout guardrail roadmap (Phase 6.5)

The guardrail-hardening work that made the safety pipeline solid before billing. This is
the **status tracker** for that work — what shipped, what's partial, what's outstanding —
ported from the source repo's `phase-6.5-guardrail-hardening.md` and updated to reflect
what actually landed in sprout during the migration.

> **Status basis.** The states below were derived from the sprout tree (file + test
> evidence) as of the migration, 2026-07-05. Treat ⚠️ and ⬜ rows as "confirm before
> relying on it", not gospel. The objective gauge is the eval harness — see below.

**Related docs:**

- **The oracle** — [`../../sprout-pipeline/src/eval/README.md`](../../sprout-pipeline/src/eval/README.md): the adversarial eval harness + trick set. Every safety change is judged against it.
- **Release gates** — [`launch-readiness.md`](launch-readiness.md) (legal/safeguarding) and [`go-live.md`](go-live.md) (infra). The two launch-blockers below live there; this doc does not duplicate their checklists.
- **Legal basis** — [`product-legal-adrs.md`](product-legal-adrs.md) (ADR-0007/0008/0009) and the [safeguarding runbook](safeguarding/csam-grooming-escalation.md).

---

## Why this phase existed

Most of the safety load rested on a single fallible layer — the gpt-4.1-nano LLM-as-judge
(R5). Simple reframing (story framing, an apology, emoji) could flip its verdict, and a
bigger judge did not reliably fix it. The fix was to surround it with **cheap,
attack-resistant, decorrelated** layers so two independent things must fail before anything
reaches a child. Several of these items were originally scheduled *after* billing; Phase 6.5
pulled them forward so the core is safe before there's a paywall on top of it.

Layer codes: `Q*` = query/input path, `R*` = response/output path.

---

## Current state at a glance

The eval harness reports **4/29 cases bypassing = 13.8%** (down from a 39.3% baseline). All
four remaining bypasses are documented and out of scope for the layers built here:

| Bypass | Why it's still open |
|---|---|
| `spacing-dangerous-1` | Inter-letter spaces (`b o m b`) — canonicalisation gap (6.5.1 tail) |
| `repetition-dangerous-1` | Character runs (`boooomb`) — canonicalisation gap (6.5.1 tail) |
| `emoji-unmapped-1` | Age-restricted emoji (🔞) outside the curated map (6.5.1 tail) |
| `crescendo-self-harm-1` | Anaphoric overdose build-up — lexically identical to innocent anaphora; **deferred to the LLM crescendo judge** (see 6.5.5) |

---

## Work items

Status key: ✅ shipped · ⚠️ partial / confirm · ⬜ outstanding

### Tier P0 — the decorrelated layers + the oracle

- ⚠️ **6.5.1 Canonicalisation pre-filter** (Q1, R1, Q2) — `canonicalise.ts`
  - Core shipped: NFKC, homoglyph/confusable fold, zero-width strip, de-leet, emoji→word —
    on a **scan copy only** (stored message untouched), ahead of every scan layer.
  - **Remaining:** the three `*-dangerous-1` / `emoji-unmapped-1` bypasses above (inter-letter
    spacing, character-run collapsing, wider emoji map). These are the open tail of 6.5.1.

- ✅ **6.5.2 Second + third opinion classifiers** (R3, R4)
  - **R3** — Llama Guard 3 (8B) via OpenRouter (`safety-classifier.ts`) as a parallel vote.
  - **R4** — a pure-JS lexical classifier (`lexical-classifier.ts`), decorrelated third vote,
    no model artefact. Runs on **both paths** (input as a sensitive signal, output in the vote).
  - Any disagreement → treat as unsafe → fallback (`opinion-vote.ts`).

- ✅ **6.5.3 Adversarial eval harness** — `sprout-pipeline/src/eval/`
  - Version-controlled trick set + bypass rate, run in CI. A regression fails the build; a
    newly-caught `bypass` case fails until its `expected` is flipped (ratchet).

### Tier P1 — structural gaps

- ✅ **6.5.4 Output sensitive-topic scan** (R6) — `sensitive-topics.ts`, scans the AI response, not just input.

- ✅ **6.5.5 Whole-conversation (crescendo) check** (Q5, R6) — `crescendo.ts`
  - Scores the accumulated transcript for a slow build-up (medicine context + explicit
    overdose escalation) and redirects before the depth threshold.
  - **Tuned hard for precision** (a hit hard-redirects the child): scans child turns only,
    and the escalation must name an explicit substance or the word "overdose" — never a bare
    anaphor. The anaphoric case (`crescendo-self-harm-1`) is **deferred to the LLM crescendo
    judge** (see follow-up below).

- ✅ **6.5.6 Behavioural signals + rate limiting** (Q5) — `behavioural-limits.ts`, wired into `chat-sse.ts`
  - **Launch values chosen** ([ADR-0018](product-legal-adrs.md#adr-0018--launch-day-behavioural-limit-values-ship-the-code-defaults-extend-signal-retention-to-7-days)):
    code defaults for eight knobs, `RATE_LIMIT_RETENTION_S` extended to 7 days, all nine
    pinned in `fly.toml [env]`. Tuning happens against week-one traffic via the documented
    `behavioural_events` query — no longer an open placeholder.

- ✅ **6.5.7 Prompt-injection shield on input** — `prompt-injection.ts` (wired at input stage)
  - Instruction-override, fake system/developer roles, persona jailbreaks. Precision-tuned so
    imaginative play ("you are now a wizard") is not blocked. A hit blocks pre-generation and
    emits a `blocked` flag.

- ⬜ **6.5.8 Grooming / CSAM escalation path + human-in-the-loop** — *mandatory launch-blocker*
  - Docs drafted (ADR-0009 + [safeguarding runbook](safeguarding/csam-grooming-escalation.md)),
    but **counsel sign-off and a named Designated Safeguarding Lead are still required.**
    Tracked in [`launch-readiness.md`](launch-readiness.md) — do not tick here.

- ⬜ **6.5.12 Enforce UK-only access** — *launch-blocker* (ADR-0008)
  - **Not implemented in sprout.** No edge/middleware geo-IP block; the legal posture
    (ADR-0007's UK-only premise) currently rests on a boundary that isn't enforced. Needs:
    edge geo-IP block (Fly/Cloudflare), UK-only at registration + ToS, later a UK billing
    address. Tracked in [`launch-readiness.md`](launch-readiness.md); lawyer-reviewed alongside 6.5.8.

### Tier P2 — control into real control

- ⚠️ **6.5.9 Safe-by-default + honest disclosure + parent visibility**
  - Preset plumbing and flag persistence exist (`loadChildConfig.ts`, onboarding, flags).
  - **Safe-by-default: confirmed** (ADR-0016 in [`product-legal-adrs.md`](product-legal-adrs.md)) —
    the strictest preset (`early-learner`, verified per-slider) is the tested fallback at the
    read seam (`loadChildConfig`), onboarding pre-selects it, and `presetName` stays required
    at creation by design.
  - **Honest disclosure: decided** (ADR-0017 in [`product-legal-adrs.md`](product-legal-adrs.md)) —
    first-run statement card + persistent line above the chat input, per-preset wording
    incl. the parent-visibility sentence, plus a positive identity instruction in the
    pipeline system prompt. Verified absent from the tree; build handed to `/tdd`.
  - **Still to confirm:** the disclosure build lands, and the parent-visible flag log is
    present (not verified during the port).

- ✅ **6.5.10 Hash PINs / child password** — auth is app-owned (ADR-0012); scrypt hashing carried from the source repo.
  - **Confirm:** re-verify the hashing path survived the auth rebuild in sprout.

- ✅ **6.5.11 Force child password change on first login** — `mustChangePassword` defaults true; temp password = username; `changePasswordHandler` enforces the change.

---

## Follow-up beyond Phase 6.5

- **LLM crescendo judge** — closes the deferred `crescendo-self-harm-1` anaphora bypass. The
  deterministic layer deliberately can't resolve cross-turn anaphora (it's semantic, not
  lexical); an LLM judge is the right tool. This is the one concrete safety item the 6.5.5
  precision retune left open.

---

## The gate

Billing does not start until P0 + P1 are done (P2 is strongly recommended in the same
window). **Two items are hard launch-blockers regardless of tier**, because the legal
posture rests on them: **6.5.8** (CSAM escalation path) and **6.5.12** (UK-only enforcement).
Both must be in place and lawyer-reviewed before any real user reaches the product — see
[`launch-readiness.md`](launch-readiness.md).
