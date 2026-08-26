# ToS and Privacy plumbing, and the registration consent gate

Type: grilling
Status: resolved
Blocked by: 05

## Question

`SettingsPage.tsx` links "Privacy Policy" and "Terms of Service" as dead `href="#"`. Neither
route nor page exists. ADR-0008 measure 2 requires a ToS restricting use to the UK, so the
UK-only measure currently has nowhere to land.

**Scope reminder:** the routes, placeholder pages, and consent plumbing are in scope. The
binding legal prose is **not** — it's drafted by a human with counsel (see the map's Out of
scope). This ticket decides the container, not the words.

Points to resolve:

- **Routes.** `/terms` and `/privacy` as SPA routes, or static files served outside the router?
  If a non-UK visitor is blocked before the SPA loads, are these pages reachable to them? A ToS
  you can't read until you're allowed in is a slightly awkward artifact — decide whether they
  sit outside the geo boundary.
- **Placeholder content shape.** What does the page say before counsel writes it — an explicit
  "draft, not yet in force" banner, or is a placeholder ToS worse than a dead link? Consider
  whether shipping a placeholder is safe at all given the product's audience.
- **How the UK-restriction requirement is recorded for counsel.** A structured list of clauses
  the ToS must contain (UK-only use, age of the account holder, the AI-not-a-person disclosure,
  data retention windows) handed to counsel — where does that list live? Candidate: a section in
  `launch-readiness.md`, or its own doc under `apps/sprout/docs/`.
- **The consent gate.** Does registration require ticking "I agree to the Terms"? Is that the
  same control as the UK attestation from
  [How country is captured and stored at parent registration](05-country-at-registration.md),
  or a second one? Two checkboxes is friction; one checkbox bundling two claims is weaker
  evidence for both.
- **Fixing the dead links** in `SettingsPage.tsx` — trivial once the routes exist, but note it
  so it isn't orphaned.

**Recommendation to react to:** real SPA routes at `/terms` and `/privacy`, placed *outside* the
geo boundary so they're always readable, carrying an explicit "draft — not yet in force" banner;
the clause list lives in a new `apps/sprout/docs/legal-content-requirements.md` cross-linked
from the launch-readiness gate; and two separate checkboxes at registration, because the
attestation and the agreement are different claims.

## Answer

Recorded as **ADR-0015** in `apps/sprout/docs/product-legal-adrs.md`, counsel-flagged
(the checkbox label copy explicitly).

- **Geo boundary: both pages exempt.** The exempt list becomes three exact-match strings —
  `/health`, `/terms`, `/privacy` (refines ADR-0012). The load-bearing argument is privacy
  transparency: a UK parent abroad is a data subject whose child's data we already hold;
  UK GDPR transparency doesn't stop at the border. `/terms` rides along so the two legal
  links behave consistently.
- **Not SPA routes: self-contained static HTML documents from app code** (the ADR-0013
  status-notice pattern). SPA routes would force a wildcard exemption for `index.html` +
  `/assets/*`, gutting ADR-0012's narrow posture. The `SettingsPage.tsx` dead links become
  plain `<a href>` full-page navigations — noted in the build, not orphaned.
- **Placeholder shape: skeleton, not fake prose.** "Draft — not yet in force" banner +
  section headings mirroring the clause brief, one-line notes per section, no invented
  legal sentences. Safe structurally: a new launch-readiness row (counsel-owned) blocks
  release until real text lands, and the app has never been deployed.
- **Counsel's brief: new `apps/sprout/docs/legal-content-requirements.md`** — one section
  per document, each clause tracing to its ADR, plus a "for counsel to determine" list.
  Linked from the new launch-readiness row; skeleton headings mirror it.
- **Consent gate: a second, separate checkbox** — "I agree to the Terms of Service and have
  read the Privacy Policy" (agree to terms, acknowledge the policy — one control covers
  both). Not bundled with ADR-0014's attestation: fact-claim vs contract formation; one
  bundled timestamp is weaker evidence for each. Stored symmetrically:
  `tos_agreed_at timestamptz NOT NULL` additionalField, server-stamped by the same
  before-create hook (which rejects unagreed signups), erased with the account. No ToS
  version column at launch (no user can register before v1 lands); re-acceptance on
  revision deliberately deferred.

**Build handed to `/tdd`** (two static documents + routes, exempt-list extension + boundary
test rows, `SettingsPage.tsx` anchor fix, second checkbox, `tos_agreed_at` migration, hook
extension). `launch-readiness.md` row added; `legal-content-requirements.md` written this
session (assembly of decided facts, per the map's decisions-only rule).
