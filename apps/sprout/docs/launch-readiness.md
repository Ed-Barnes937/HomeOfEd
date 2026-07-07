# Launch readiness — release gate

**A release to real users is blocked until every item below is satisfied.**

This is the durable gate. **Merging code or docs to `main` is *not* a release** — work can
land freely while these items are open. What this list protects is the moment real children
and parents start using the product under the legal assumptions we've made.

**Gate owner:** _[NAME — TO BE CONFIRMED]_ (signs off that every blocker below is closed
before launch).

---

## 🚫 Legal / compliance sign-off (counsel)

These rest on a *legal characterisation of a technical design* — see
[ADR-0007](product-legal-adrs.md#adr-0007--uk-launch-is-out-of-osa-user-to-user-scope-while-text-only-and-one-to-one),
[ADR-0009](product-legal-adrs.md#adr-0009--documented-manual-grooming--csam-escalation-path-now-tier),
and the [safeguarding runbook](safeguarding/csam-grooming-escalation.md). **An agent must
not tick these — they require a human lawyer.**

- [ ] **Counsel has reviewed ADR-0007** (the OSA out-of-scope determination) and the
      safeguarding runbook, and confirms the legal posture.
- [ ] **The parents-view-conversations edge is confirmed** against the OSA user-to-user
      test. This is the one feature that could flip the service into the user-to-user regime
      (and its threshold-free CSEA reporting duty). Do **not** self-certify.
- [ ] **UK-only enforcement is confirmed adequate** ("reasonable measures" — 6.5.12 /
      ADR-0008). The whole analysis is UK-only; if non-UK users can register, US (COPPA +
      NCMEC) and EU (AI Act) regimes pull in.
- [ ] **Written-content position confirmed** — strict CSAM (imagery) is out of surface
      (text-only, no upload/generation), but the law on *written* sexual material involving
      children is narrower and greyer; counsel confirms our position.

## 🚫 Safeguarding path is operational (6.5.8 / ADR-0009)

- [ ] **Named owner filled in** — the Designated Safeguarding Lead, deputy, and counsel
      contact in the [runbook §2](safeguarding/csam-grooming-escalation.md#2-the-named-owner)
      are real, reachable people (not placeholders).
- [ ] **Flag-review cadence set** and the secure incident-log location + access controls
      exist (runbook §3, §6).
- [ ] ADR-0009 moved from **Proposed** to **Accepted** once the above are done.

---

*Add other launch blockers (security, data, ops) here as they surface — this is the single
list a release checks against.*
