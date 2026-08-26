# What the app trusts when the country header is missing

Type: grilling
Status: resolved
Blocked by: 02 (resolved)

## Question

This is the sharp edge of the whole boundary, and it's a genuine dilemma rather than an
oversight to tidy up.

A country header is only present on requests that came through Cloudflare. Requests that
don't: **Fly health checks** (which would mark every machine unhealthy if refused) and
**direct `hoe-sprout.fly.dev` requests** (which bypass Cloudflare entirely — and therefore
bypass any WAF rule).

So:

- **Fail open** on a missing header and the boundary has a hole big enough to drive through:
  anyone who knows the `.fly.dev` hostname is unrestricted. The legal posture then rests on
  obscurity.
- **Fail closed** and the app refuses its own health checks, so Fly kills the machines — unless
  the health path is exempt, which then becomes the hole (smaller, but a hole that also has to
  stay safe to expose).

Points to resolve:

- Fail open or fail closed by default, given the research findings from
  [What Cloudflare's free plan and Fly.io actually offer for country blocking](01-country-blocking-primitives.md)?
- How is the `.fly.dev` bypass closed — origin-IP allowlist, Authenticated Origin Pulls, a
  shared secret header, or accepted as within "reasonable measures" and documented as a known
  limitation? Accepting it is a legitimate answer, but it has to be a *recorded* one, because
  ADR-0007's scope determination leans on it.
- Is the health path exempted by path match, or by something stronger (a token, source-IP
  check, or a separate internal port)?
- Does the answer differ between environments — dev simulator, docker stack, production? A hook
  that hard-blocks in dev would make local work impossible, so what's the escape hatch, and how
  is it kept from shipping enabled?
- Whatever is chosen, does it need to be visible to counsel as part of the "UK-only enforcement
  is adequate" item on the launch-readiness gate? Likely yes — flag it, don't tick it.

**Recommendation to react to:** fail closed, exempt `/health` by exact path only, and close the
`.fly.dev` bypass properly rather than documenting it away — a hole you've written down is
still a hole, and this one undermines the thing it's meant to support. Environment behaviour
gated on the same prod check `main.ts` already uses for its required secrets, so it cannot ship
disabled by accident.

## Answer

Resolved 2026-08-01 by `/grilling` (five decisions). Recorded as **ADR-0012 —
"UK-boundary refusal matrix, `/health` exemption, and environment controls"** in
[`apps/sprout/docs/product-legal-adrs.md`](../../../apps/sprout/docs/product-legal-adrs.md),
with dated pointer notes in ADR-0011 item 5 + consequences marking the fail-closed dependency
discharged (a new ADR, not an in-place amendment — same precedent ticket 02 set for ADR-0008:
accepted counsel-facing records stay untouched). The decisions:

1. **Missing header on non-exempt paths is fail-closed.** ADR-0011 item 5's assumption holds;
   nothing reopens.
2. **The matrix is "allow `GB` only"** — non-GB, `XX`, and `T1` all refused. Refusing `XX`
   (a genuine UK visitor Cloudflare can't geolocate) is recorded as a knowing choice: the
   posture is "non-UK traffic actively prevented", and admitting unplaceable traffic would
   invert it. **The WAF expression mirrors by construction**: `ip.src.country ne "GB"` —
   the identical predicate, so the layers can never disagree on a sentinel. That expression
   is the concrete spec the go-live step needed.
3. **`/health` is exempt by exact string match only** (`req.url === '/health'`; no prefix,
   query-stringed variants not exempt) — nothing stronger. The endpoint leaks nothing and
   both consumers (Fly checks, `.fly.dev` CI smoke) need it plain.
4. **Escape hatch: `GEO_ENFORCEMENT=off` opt-out + Fly boot guard.** Premise corrections
   from the code: the dev simulator never runs the hook (`createAppServer` isn't in the
   simulator path) and CI smoke touches only the exempt `/health` — neither needs a hatch.
   The docker stack is the one real case, and it runs the prod image with
   `NODE_ENV=production`, so the `main.ts` prod-check pattern *cannot* be the gate. Instead:
   enforcement ON by default, `compose.yml` alone sets the opt-out, and `main.ts` throws at
   boot if the var is set while `FLY_APP_NAME` exists (Fly injects it everywhere) — a leaked
   disable crashes the deploy instead of silently failing open.
5. **Counsel visibility: flagged, never ticked.** ADR-0012 is marked for counsel review
   alongside ADR-0008/0011, and the launch-readiness "UK-only enforcement is confirmed
   adequate" row now references ADR-0011 + ADR-0012; its checkbox is untouched.

**Handed onward:** ticket 04 reshaped (comment added there) — the hook-rendered refusal's
audience is almost exclusively headerless direct-`.fly.dev` traffic, so one generic
self-contained response, no country to name. Go-live gains the concrete WAF expression and a
verify-`GEO_ENFORCEMENT`-unset line (carried in ADR-0012's consequences for the build to
apply). Boundary unit tests assert every matrix row per path, including `/healthx`-style
near-misses.

## Comments

**2026-07-29 (from the ticket-01 research):** a premise refinement. Behind Cloudflare the
header is never *absent* on failure — geolocation failure yields sentinel values **`XX`**
(unknown) and **`T1`** (Tor), so "missing header" strictly means "didn't come through
Cloudflare" (health checks, direct `.fly.dev`, CI smoke). The fail-open/fail-closed question
therefore has three inputs, not two: GB / non-GB / sentinel — a UK visitor Cloudflare can't
geolocate arrives as `XX`, and blocking them is a knowing choice, not a side effect. See the
[research answer](01-country-blocking-primitives.md), items 3–5.

**2026-07-29 (from the ticket-02 resolution / ADR-0011):** the layer is decided — app-level
Fastify hook load-bearing, `/health` the only exempt path, WAF on from launch. Two of this
ticket's points are already settled there, don't re-open them: (a) **the `.fly.dev` bypass is
NOT closed** — no shared secret at launch; header spoofing is an accepted reasonable-measures
residual, recorded in ADR-0011 item 5 with the hardening step named for later; (b) the ticket's
"close it properly" recommendation was considered and overruled by Ed. **Load-bearing
dependency the other way:** ADR-0011's accepted-risk stance assumes this ticket resolves
missing-header (non-exempt paths) as **fail-closed** — if it doesn't, ADR-0011 item 5 must be
revisited. Still genuinely open here: the GB / non-GB / `XX` / `T1` / missing matrix (and
whether the WAF expression's sentinel handling mirrors it — the go-live step spec needs the
answer), exempt-by-exact-path vs something stronger for `/health`, per-environment behaviour
(dev simulator / docker stack / CI smoke reach the hook with no header), and the
counsel-visibility flag.
