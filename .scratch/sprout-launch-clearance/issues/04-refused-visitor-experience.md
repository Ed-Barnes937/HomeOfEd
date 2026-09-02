# What a refused non-UK visitor sees

Type: prototype
Status: resolved
Blocked by: 02 (resolved)

## Question

Someone outside the UK opens `sprout.homeofed.com`. What happens?

This needs a rough concrete artifact to react to rather than a discussion — a stub page and a
couple of alternatives, via `/prototype`.

Points to resolve:

- **Status code.** `451 Unavailable For Legal Reasons` is semantically the honest answer and is
  a real registered code; `403` is blunter but more widely understood by intermediaries. Which?
- **Body.** A branded sprout page explaining that the service is UK-only for now, or a bare
  text response? A parent in France who was sent a link deserves an explanation, not a wall.
- **Does it say why?** "We're only available in the UK while we complete our safety and legal
  work" is honest and matches ADR-0007's posture. Consider whether saying so invites
  VPN workarounds — and whether that matters, given VPN leakage is already accepted.
- **Is there a contact or waitlist?** Probably not for launch, but decide rather than default.
- **Where does it live** — a static response from the hook, or a real SPA route? If the block is
  before the app, the SPA never loads, so it's likely a static HTML string. That constrains the
  design; make the prototype reflect it.

Link the prototype from this ticket as an asset.

**Recommendation to react to:** `451` with a small self-contained HTML response (no SPA, no
assets), plainly stating UK-only-for-now, no contact form.

## Answer

Resolved 2026-08-01 by `/prototype` (three self-contained alternatives, reviewed by Ed).
Recorded as **ADR-0013 — "The refused-visitor response: `451` + one generic self-contained
status notice"** in
[`apps/sprout/docs/product-legal-adrs.md`](../../../apps/sprout/docs/product-legal-adrs.md),
with a dated pointer note in ADR-0012's consequences (same new-ADR precedent as tickets
02/03 — accepted counsel-facing records stay untouched). The decisions:

1. **Status code `451`** (Unavailable For Legal Reasons, RFC 7725), not `403`. Counsel
   note carried in the ADR: `451` characterises the block as legal in nature while ours is
   a voluntary compliance-posture choice — legitimate but recorded, not self-certified.
2. **Body: variant C, the "status notice"** — dark, monospace, status-code-first, then
   *"Sprout is only available in the United Kingdom."* / *"Sprout is UK-only while we
   complete our safety and legal work."* Chosen over A (bare text-flow document) and
   B (branded sprout card) because the audience is people at a terminal, and it stays
   legible as raw bytes in curl. Self-contained, inline styles, no assets, under 1 KB.
3. **It says why.** Honest, matches ADR-0007's posture; the VPN-invite worry is moot
   (ADR-0008 accepts VPN leakage). Copy is plain product prose — any drift toward a legal
   assertion goes to counsel.
4. **No contact or waitlist at launch** — the traffic mostly isn't parents abroad.
5. Headers: `text/html; charset=utf-8`, `cache-control: no-store`.

**Prototype asset:**
[`assets/refused-visitor-prototype.html`](../assets/refused-visitor-prototype.html) —
throwaway viewer with all three variants, the 451/403 toggle, the says-why toggle, and the
raw-bytes view. Not the implementation source; the build is handed to `/tdd`.

**Handed onward:** no new go-live step (the response is versioned app code, covered by the
ADR-0011/0012 unit-test strategy — tests assert `451` + this body for every refused matrix
row). Ticket 11 gains a diagnostic signature (comment added there): genuine UK visitors
seeing this 451 page means the zone's IP Geolocation setting is off.

## Comments

**2026-07-29 (from the ticket-02 resolution / ADR-0011):** the layer decision reshapes this
ticket's premise. The WAF rule is ON from launch, so a non-UK visitor opening
`sprout.homeofed.com` is blocked at the edge and sees **Cloudflare's unbranded Error 1020 —
not our page** (free plan can't customise it; accepted knowingly in ADR-0011 item 3). The
hook-rendered response this ticket designs is seen only by traffic that bypasses the edge:
direct `hoe-sprout.fly.dev` requests and whatever ticket 03's sentinel/missing-header matrix
routes to refusal. The "where does it live" point is settled: a **self-contained static
response from the hook** — the SPA shell sits behind the boundary, so no SPA route and no
asset references. Status code, body copy, whether it says why, and contact/waitlist remain
open; weigh them knowing the audience is now edge-bypassing traffic, not the ordinary parent
in France (who gets the 1020).

**2026-08-01 (from the ticket-03 resolution / ADR-0012):** the matrix is decided — allow `GB`
only; non-GB, `XX`, `T1`, and missing-header all refused, and the WAF runs the identical
predicate (`ip.src.country ne "GB"`), so through-Cloudflare non-GB/`XX`/`T1` visitors are
blocked at the edge (1020) and never reach the hook. The audience for this ticket's response
is therefore **almost exclusively headerless direct-`.fly.dev` traffic** — curl, scanners,
the odd human who found the Fly hostname — plus any window where the WAF rule is absent.
Two design constraints follow: the response **cannot name a country** (a missing header has
none — one generic response for every refused row, don't branch on the value), and it must be
fully self-contained (already settled by ADR-0011). Given the audience, the case for `451` +
plain honest copy is unchanged, but a waitlist/contact aimed at "parents abroad" is aimed at
traffic that mostly isn't parents.
