# Grooming / CSAM escalation & safe-handling path

**Status:** Draft — **NOT YET COUNSEL-REVIEWED. Do not treat as live policy until signed off (see [§9](#9-counsel-sign-off--gating)).**
**Scope:** NOW tier — UK launch, text-only, one-to-one child↔AI chat.
**Owner:** Designated Safeguarding Lead (see [§2](#2-the-named-owner)).
**Implements:** Phase 6.5 item **6.5.8** (mandatory). **Governed by [ADR-0007](../product-legal-adrs.md#adr-0007--uk-launch-is-out-of-osa-user-to-user-scope-while-text-only-and-one-to-one)** and recorded as **[ADR-0009](../product-legal-adrs.md#adr-0009--documented-manual-grooming--csam-escalation-path-now-tier)**.

> **This is not legal advice.** It is an operational runbook. The underlying scope
> determination (ADR-0007) and this path must both be reviewed by counsel before launch.

---

## 0. The one rule that never bends

**Grooming and CSAM signals must never be adjudicated by an LLM.** This category does
**not** rest on the general validation judge (`apps/sprout-pipeline/src/validation.ts`), the
sensitive-topics classifier, or any model. A model may *surface* a signal; only a **named
human** triages it and decides on reporting. There is no automated reporting and no
automated "all clear" for this category.

This is a deliberate decorrelation from the rest of the guardrail stack: every other flag
type can be auto-handled (fallback response + parent-visible flag). This one cannot.

---

## 1. What this path covers (and what it cannot, at NOW tier)

The product as built is a **one-to-one, text-only** chat between a child and the AI. There
is **no user-to-user channel** and **no media upload**. That shapes the realistic threat
surface:

| Scenario | Can it occur at NOW tier? | Notes |
|----------|---------------------------|-------|
| **A. A child discloses abuse / exploitation** to the AI (current, historical, or a threat). | **Yes — the primary case.** | The child treats the AI as a confidant. This is a safeguarding disclosure, not a content-moderation event. |
| **B. Attempts to make the AI produce sexualised content about a child** (CSAM-adjacent text, sexual roleplay involving a minor). | **Yes.** | Caught upstream by the blocklist / generation refusal, but the *attempt* is itself a signal worth escalating if persistent or severe. |
| **C. A child is being groomed by another person and re-enacts / seeks help** (e.g. "an adult online asked me to…"). | **Yes — as a disclosure (variant of A).** | The grooming happens *off-platform*; the AI chat is where it surfaces. |
| **D. Peer-to-peer grooming *inside the product*** (an adult contacting the child through the service). | **No.** | The product has no user-to-user channel. This is the boundary ADR-0007 turns on. If a sharing/community feature ships, this becomes possible → see [§8](#8-triggers-that-re-open-scope). |
| **E. Indecent imagery (still/video) of a child** uploaded or generated. | **No.** | No media upload, no image generation. If either ships → indecent-images criminal regime + IWF hash-matching + NCA reporting → [§8](#8-triggers-that-re-open-scope). |

**At NOW tier this path is about scenarios A–C: disclosures and attempts that arrive as
text.** It is a *manual safeguarding response*, not a content-reporting integration.

---

## 2. The named owner

This path is owned by a single accountable role — the **Designated Safeguarding Lead
(DSL)** — with a named deputy for cover. **A model is never the owner.**

> **PRE-LAUNCH GATING ACTION — the placeholders below must be replaced with real, named
> individuals before launch. A path "owned by a role" with no named person does not satisfy
> 6.5.8.**

| Role | Named individual | Contact (24/7 reachable) |
|------|------------------|--------------------------|
| **Designated Safeguarding Lead (DSL)** | _[NAME — TO BE CONFIRMED]_ | _[phone / email — TO BE CONFIRMED]_ |
| **Deputy DSL** (cover when DSL unavailable) | _[NAME — TO BE CONFIRMED]_ | _[phone / email — TO BE CONFIRMED]_ |
| **Counsel / legal contact** (for the reporting decision) | _[NAME / firm — TO BE CONFIRMED]_ | _[contact — TO BE CONFIRMED]_ |

The DSL:

- is the single point of triage for every grooming/CSAM signal;
- decides whether, where, and when to report (see [§5](#5-the-reporting-decision));
- is reachable on a defined channel with a fallback to the deputy;
- keeps the secure incident record ([§6](#6-record-keeping));
- is **not** the child's parent by default (a disclosure may concern the family —
  scenario A can implicate a parent). Parent notification is a *DSL decision*, not automatic.

---

## 3. How a signal reaches the DSL

There is **no operator/moderation dashboard at NOW tier.** Signals surface through the
existing flag pipeline and through human reports. The DSL reviews these manually.

Sources, in order of reliability — **none of them is the validation judge acting alone**:

1. **Deterministic blocklist hit** (`apps/sprout-pipeline/src/blocklist.ts`) on input or output —
   e.g. `dangerous`/`explicit` categories. Emitted as a `blocked` flag and persisted by
   the web app to the `flags` table.
2. **Sensitive-topic match** (`apps/sprout-pipeline/src/sensitive-topics.ts`) — e.g.
   `violence-and-conflict` (abuse/assault), `family-distress` (a parent hurting the child),
   `mental-health` (self-harm). Emitted as a `sensitive` flag.
3. **Child report** — the in-chat "report" control (`type: "reported"` flag).
4. **Parent report** — a parent raising a concern from the dashboard or via support.

> **Important limitation, stated honestly:** the current flag pipeline does **not** single
> out grooming/CSAM as a distinct, deterministically-routed category, and it does **not**
> page the DSL. At NOW tier, surfacing depends on **a human reviewing the flag queue** and
> recognising scenarios A–C. This is acceptable for a text-only 1:1 launch (low volume,
> human-in-the-loop by design) and is the reason this path is *manual*. A dedicated
> deterministic signal + routing is explicitly **deferred** — see
> [§7](#7-what-we-deliberately-do-not-build-at-now-tier).

**Review cadence (set before launch):** the flag queue is reviewed by the DSL (or deputy)
at least _[CADENCE — TO BE CONFIRMED, e.g. every business day]_, and any flag matching the
grooming/CSAM indicators below jumps the queue for **immediate** handling.

**Indicators that escalate a flag into this path** (non-exhaustive; err toward escalation):

- A child describing sexual contact, sexual requests, or being asked to keep a secret by an adult.
- A child describing being hurt, threatened, or coerced by an adult (online or offline).
- Any content sexualising a child, or attempts to elicit such content from the AI.
- A child expressing they are in immediate danger.

---

## 4. Triage (what the DSL does, in order)

> **Do not investigate, interview the child, or contact a suspected abuser.** That can
> compromise a later criminal investigation and is not our role. Preserve, assess, refer.

1. **Stabilise & contain.** Confirm whether the child is in **immediate danger**. If yes →
   **call 999** (UK emergency) first; everything else follows.
2. **Preserve, do not collect.** Follow the safe-handling rules in [§6](#6-safe-handling-of-content)
   *before* doing anything else with the material. **Never download, copy, screenshot, or
   forward suspected indecent imagery** (there is none at NOW tier, but the rule stands).
3. **Assess.** Using the indicators in [§3](#3-how-a-signal-reaches-the-dsl), classify:
   disclosure (A/C), content-generation attempt (B), or false positive.
4. **Decide reporting** ([§5](#5-the-reporting-decision)). Document the decision and its
   reasoning either way — *including a decision not to report.*
5. **Record** ([§6](#6-record-keeping)) with a timestamped entry in the secure incident log.
6. **Review controls.** If a generation attempt (B) succeeded or nearly did, raise it as a
   guardrail regression to feed the adversarial eval harness (6.5.3) — *separately from*
   the safeguarding action, never as a substitute for it.

```
                         signal reaches DSL
                                │
              ┌─────────────────┴─────────────────┐
       immediate danger?                       not immediate
              │ yes                                 │
        call 999 now                          assess (A/B/C?)
              │                                     │
              └──────────────┬──────────────────────┘
                             ▼
                  reporting decision (§5)  ── always documented,
                             │                including "no report"
                             ▼
              record (§6) + review controls (§4.6)
```

---

## 5. The reporting decision

**The DSL owns this decision.** It is taken with counsel input where time allows, and is
**never** made by a model or by default automation.

**What binds us, and what does not (per ADR-0007):**

- We are **outside** the OSA *user-to-user* regime while text-only and 1:1, so the **7 Apr
  2026 statutory CSEA reporting duty (NCA CSEA-IRP) does not bind the product as built.**
  We therefore do **not** operate a statutory reporting integration at NOW tier.
- **Criminal law on CSAM applies regardless of OSA scope.** Where a report is warranted, we
  report as a responsible organisation / member of the public through the public channels
  below — this is a child-protection action, not a statutory-duty filing.

**UK reporting routes** (DSL selects per the situation; confirm details with counsel):

| Situation | Route |
|-----------|-------|
| Child in **immediate danger**. | **999** (police, emergency). |
| Non-emergency report of a crime / abuse concern. | **101** (police, non-emergency). |
| Online child sexual abuse / exploitation, grooming. | **CEOP / NCA** public reporting route (Child Exploitation and Online Protection). |
| Concern about a child's welfare / a child at risk. | **Local Authority children's services / MASH**; **NSPCC** helpline for advice. |
| Indecent **imagery** of a child encountered online. | **IWF** (Internet Watch Foundation) report. _(Not applicable at NOW tier — no media — listed for completeness; becomes live per [§8](#8-triggers-that-re-open-scope).)_ |

**Parent notification is a separate decision.** Because a disclosure may concern the family
(scenario A), the DSL decides whether and when to inform the parent — it is **not**
automatic, and it never precedes contacting authorities where a child is at risk.

---

## 6. Safe handling of content & record-keeping

### Safe handling of content

- **Never download, copy, screenshot, print, or forward** suspected child sexual abuse
  material. Making/possessing/distributing indecent images of children is itself a criminal
  offence (UK) — handling is for law enforcement, not us. At NOW tier the material is text,
  but this rule governs the day media is in scope ([§8](#8-triggers-that-re-open-scope)).
- **Preserve in place.** The conversation and flag already persist in the web app's
  `messages` / `flags` tables. Do not delete, edit, or "tidy" them. If a retention/purge job
  (summarisation, [conversation retention](../../CLAUDE.md)) would otherwise delete the
  record, the DSL places a **legal hold** on that conversation first.
- **Minimise access.** Restrict who can see the record to the DSL/deputy and counsel.
- **The pipeline holds nothing.** Per [ADR-0002](../product-legal-adrs.md#adr-0002--validate-before-show-non-streaming-generation),
  the pipeline service has no DB; the evidence lives only in the web app's database.

### Record-keeping

The DSL keeps a secure, access-controlled incident log. Each entry records: timestamp,
child reference (ID, not free-text PII beyond what is needed), what was observed, the
assessment, the reporting decision **and its reasoning** (including any decision *not* to
report), who was notified, and follow-up actions. This log is itself sensitive — store it
under the same access restrictions as the evidence.

---

## 7. What we deliberately do NOT build at NOW tier

Per ADR-0007, these belong to the **GATED tier** and are **not** built now:

- ❌ **NCA CSEA-IRP reporting integration** — a statutory-duty filing pipeline.
- ❌ **IWF hash-list matching** — image hash matching (there is no media to match).
- ❌ A bespoke deterministic grooming/CSAM classifier or auto-routing to a paging system.

Building these now would be premature: the statutory duty does not bind a text-only 1:1
service, and there is no media to hash. They are **mandatory before** the gated triggers in
[§8](#8-triggers-that-re-open-scope) reach users.

---

## 8. Triggers that re-open scope

From ADR-0007 — each pulls in the **full regime** and must be satisfied **before** the
feature reaches users:

1. **Any user-to-user feature** (children sharing conversations, group/community) → the
   product becomes a user-to-user service → the CSEA reporting duty (NCA CSEA-IRP, **no size
   or risk threshold**) applies → build the reporting integration first; re-run the scope
   determination.
2. **Media upload or AI image generation** → indecent-images criminal regime + **IWF
   hash-matching** + **NCA reporting** → build those first.

**The one edge to confirm with counsel even at NOW tier:** the
**parents-view-children's-conversations** feature — whether it constitutes a user-to-user
service must be tested against the user-to-user definition. **Do not self-certify.**

Adding **non-UK users** also re-opens this: US → COPPA + NCMEC CyberTipline reporting; EU →
EU AI Act. Both require a fresh assessment.

---

## 9. Counsel sign-off & gating

**This path and ADR-0007 are not live until a lawyer has reviewed them.** 6.5.8's NOW-tier
verification requires the scope determination to be *lawyer-reviewed*, and the named-owner
placeholders in [§2](#2-the-named-owner) to be filled.

**The gate is on *release*, not on merging this document.** This runbook may land on `main`
as work-in-progress so development continues, but the product **must not launch to real
users** until counsel has signed off. The blockers below are tracked durably in
[`docs/launch-readiness.md`](../launch-readiness.md) — that list is what a release checks
against.

**Pre-launch checklist (all required):**

- [ ] Counsel has reviewed **ADR-0007** (the OSA scope determination) and this runbook.
- [ ] Counsel has confirmed the **parent-views-conversations** edge against the
      user-to-user test.
- [ ] The **DSL, Deputy DSL, and counsel contact** in [§2](#2-the-named-owner) are named
      real people with reachable contact details.
- [ ] The **flag-review cadence** in [§3](#3-how-a-signal-reaches-the-dsl) is set.
- [ ] The secure **incident log** location and access controls in [§6](#6-safe-handling-of-content--record-keeping) exist.

> **An agent must not mark the counsel items above as complete, and must not certify the
> legal posture.** Those require a human lawyer. ADR-0009 stays **Proposed** until they are
> done.
