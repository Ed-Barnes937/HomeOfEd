# What the server does when a child is created without an explicit preset

Type: grilling
Status: resolved
Blocked by: —

## Question

6.5.9 is "safe-by-default", and the roadmap marks it ⚠️ unconfirmed. The state of the tree:

- `createChildHandler.ts` takes `presetName` as **required** input and reads
  `PRESET_DEFINITIONS[input.presetName].sliders`. There is no server-side fallback — omit it and
  zod rejects the call. So safe-by-default currently depends entirely on what the onboarding
  client sends.
- `getChildConfigHandler.ts` separately carries a comment claiming safe-by-default for a child
  with no preset row. So two handlers hold two different positions on the same property.

Points to resolve:

- **Is "required input" acceptable as safe-by-default?** There's a real argument that it is —
  a rejected call is not an unsafe child, and forcing the parent to choose is arguably *more*
  deliberate than defaulting. The counter-argument is that the property should hold at the
  seam regardless of caller, which is this repo's whole DI posture (handlers depend on
  interfaces, never trust the transport).
- **If a fallback is added, to what?** Confirm `early-learner` is genuinely the strictest across
  all seven sliders rather than just the youngest-sounding — check `PRESET_DEFINITIONS` in
  `packages/sprout-shared` slider by slider. "Strictest" may not be a single preset.
- **Does onboarding pre-select the strictest option**, or start with nothing selected? Nothing
  selected forces a choice; pre-selecting the strictest is safe-by-default in the UI sense.
  These are different answers to different questions — decide both.
- **Reconcile the two handlers** so one position is recorded and the other's comment stops
  contradicting it.
- Does this need recording in `product-legal-adrs.md`? Safe-by-default is cited as part of the
  6.5.9 posture, so the answer likely has a legal-facing consequence.

**Recommendation to react to:** make the property hold at the seam — default to the strictest
preset server-side when absent, verified slider-by-slider rather than assumed to be
`early-learner` — *and* pre-select it in onboarding. Belt and braces, and it removes the
contradiction between the two handlers.

## Answer

Recorded as **ADR-0016** in `apps/sprout/docs/product-legal-adrs.md`, counsel-flagged with
the 6.5.9 posture. The ticket's premise dissolved on verification: the "comment claim" in
`getChildConfigHandler` is real, shared, tested code.

- **Verified facts (not decisions):** the strictest-preset fallback is implemented in
  `loadChildConfig.ts` — the single loader behind `children.config`, `children.myConfig`,
  and the chat SSE route — and unit-tested (`getChildConfigHandler.test.ts`: "falls back to
  the strictest preset when a child has no preset row"). `early-learner` is genuinely the
  strictest on **all seven** sliders (`1` on the six restriction axes, `5` on
  `parentVisibility` where high = protective). Onboarding already pre-selects it
  (`INITIAL_ONBOARDING_DATA`).
- **Posture: the property holds at the read seam** — the config governing a child's chat
  fails safe. `presetName` stays **required at creation, by design**: a rejected call is
  not an unsafe child, and a silent server default would hide a buggy client creating
  children on config the parent never saw. This departs from the ticket's written
  recommendation (drafted before the fallback was verified as real); no server-side default
  is added.
- **Onboarding keeps the pre-selection** — the safe state wins in the UI, where there is no
  zod boundary to make non-interaction loud.
- **Handler reconciliation is doc-level:** `createChildHandler` gained a comment citing
  ADR-0016 ("required by design"); the loader's comment was already correct.
- **Accepted residual:** `createChild` → `createPreset` is non-transactional; a
  second-call failure leaves a rowless child — exactly the state the fallback covers, and
  the failure direction is "safer than chosen". No transaction seam built.
- **Roadmap:** 6.5.9's safe-by-default half now cites ADR-0016 as confirmed; the ⚠️ clears
  only when disclosure (ticket 08) and parent flag visibility (ticket 09) are confirmed.

No build handed off — the control and its test already exist; the ADR, the handler comment,
and the roadmap citation were written this session (doc-level assembly, per the map's
decisions-only rule).
