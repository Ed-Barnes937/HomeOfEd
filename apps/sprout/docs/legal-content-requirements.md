# Legal content requirements — the brief for counsel

The clause-by-clause requirements for the two binding documents served at `/terms` and
`/privacy`. Decided in
[ADR-0015](product-legal-adrs.md#adr-0015--tosprivacy-pages-geo-exempt-static-documents-skeleton-drafts-and-a-second-consent-checkbox);
gated by the launch-readiness row that blocks release until counsel-approved text replaces
the skeleton drafts.

**How to read this:** each clause states *what the document must cover* and *where the
requirement comes from*. The product mechanisms are already decided and built (or handed to
build) — counsel drafts the words, and may of course add clauses; this list is the floor,
not the ceiling. The skeleton pages' section headings mirror this document.

**This is not legal drafting.** It is an assembly of decisions already recorded in
[`product-legal-adrs.md`](product-legal-adrs.md). Where a clause's *content* is a legal
judgment (lawful bases, controller identity, statutory rights wording), it is listed under
"for counsel to determine".

---

## Terms of Service — required clauses

1. **UK-only use.** Use of the service is restricted to the United Kingdom. This is the ToS
   half of ADR-0008 measure 2; the enforcement half is the geo boundary (ADR-0011/0012) and
   the residence attestation (ADR-0014). The whole legal posture (ADR-0007) is valid only
   while non-UK use is prevented.
2. **Who may hold an account.** The account holder is a parent or guardian; child profiles
   are created and supervised by them. The child never holds the contract.
3. **UK residence.** The account holder confirms they live in the UK — the ToS clause
   backing the registration attestation (ADR-0014; checkbox copy itself is separately
   counsel-flagged).
4. **The AI is not a person.** The service is a chat with an AI, not a human; it can be
   wrong; it is not a substitute for professional (medical, mental-health, educational)
   advice. The parent-facing disclosure ("What this can and can't do", `FlagsPage.tsx`)
   already exists; the ToS clause is its contractual counterpart.
5. **Parental visibility.** Parents can review their children's conversations and receive
   safety flags — stated plainly, since the child is the one being read. (The
   parents-view-conversations feature is separately under counsel review against the OSA
   user-to-user test — see launch-readiness.)
6. **How agreement is captured.** Agreement is given at registration via a checkbox and
   recorded server-side (`tos_agreed_at`, ADR-0015). No re-acceptance flow exists at launch;
   revising the ToS after launch requires deciding one (deferred in ADR-0015 item 7).
7. **Termination and erasure.** What happens to the account and its data on closure —
   erasure means erasure, including the attestation and agreement timestamps (ADR-0014
   item 4).

## Privacy Policy — required clauses

1. **What is collected.** Parent name, email, password; child profiles (name, PIN — stored
   hashed, ADR-0006) and guardrail settings; the child's conversations with the AI; safety
   flags and behavioural events; device tokens. Country of request (`CF-IPCountry`) is
   checked at the boundary but **not stored** (ADR-0014 item 5).
2. **Children's data, prominently.** The service's entire purpose is processing children's
   conversations; the policy must be written for that audience of one — a parent deciding
   whether to allow it.
3. **Who processes it.** Conversations are sent to third-party LLM providers for generation
   and safety-checking — currently gpt-4o-mini and Llama Guard 3 via OpenRouter
   (ADR-0007 context, ADR-0010). Named, with what they receive.
4. **Retention windows.** Conversations and behavioural events are pruned on a schedule
   (`RETENTION_DAYS` / `BEHAVIOURAL_EVENT_RETENTION_DAYS`, the retention worker). The
   policy states the launch values — which are being set in the launch-clearance effort
   (behavioural-limits ticket) — and must be updated if the knobs change.
5. **Parental access.** Parents see their children's conversations and flags — the privacy
   side of ToS clause 5.
6. **Erasure.** Account deletion cascades through children, conversations, and devices
   (`onDelete: cascade`), and erases the attestation/agreement evidence (ADR-0014 item 4).
   Erasure is currently an operator action — no self-serve handler exists — and the policy
   must describe the route honestly (how a parent requests it).
7. **UK-only service.** Data is processed on the basis that users are in the UK
   (ADR-0007/0008); the geo boundary and what it checks (ADR-0012) described in plain terms.

## For counsel to determine

Content that is a legal judgment, not a product fact — deliberately not drafted here:

- Controller identity and contact details; ICO registration and complaint route.
- Lawful bases per processing purpose (UK GDPR), including the children's-data analysis
  and whether any processing rests on consent vs contract vs legitimate interests.
- Statutory rights wording (access, rectification, erasure, portability, objection).
- Whether the ADR-0013 `451` characterisation and the ADR-0012 refusal of `XX`/`T1`
  visitors need mentioning anywhere user-facing.
- Whether a post-erasure erasure-log is wanted (ADR-0014 item 4 flags this as a possible
  follow-up).
- Age/consent thresholds referenced in the ToS (e.g. account-holder minimum age).
