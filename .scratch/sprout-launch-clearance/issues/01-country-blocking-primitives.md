# What Cloudflare's free plan and Fly.io actually offer for country blocking

Type: research
Status: resolved
Blocked by: —

## Question

Establish the facts that the enforcement-layer decision waits on. All of these are lookups,
not decisions:

1. **Cloudflare free plan.** Is `CF-IPCountry` set on all proxied requests by default, or does
   it need a Managed Transform / setting enabled? How many WAF Custom Rules does the free plan
   allow, and can a custom rule block by country (`ip.geoip.country`)? Is the free-plan block
   response customisable, or is it Cloudflare's own interstitial?
2. **Fly.io.** Does Fly offer any native geo primitive (region-based routing is not the same as
   refusing a client by country)? What headers does a Fly proxy add — is there a client-country
   header independent of Cloudflare?
3. **Fly health checks.** Where do `[[http_service.checks]]` requests originate, and what
   headers do they carry? Specifically: do they traverse Cloudflare (and so carry
   `CF-IPCountry`), or hit the machine directly? This decides whether a naive
   "block unless country == GB" rule makes every machine flap unhealthy.
4. **The direct-origin bypass.** What is the current recommended way to ensure a Fly app is
   only reachable *through* Cloudflare — Cloudflare Tunnel, an allowlist of Cloudflare origin
   IPs, Fly's `[[services]]` restrictions, or a shared secret header (Authenticated Origin
   Pulls)? Note whether each is free-plan-available.
5. **Accuracy.** Any published accuracy figure for Cloudflare's country data, and what happens
   for requests it can't geolocate (is `CF-IPCountry` absent, `XX`, or `T1` for Tor?).

Prefer primary sources — Cloudflare and Fly.io docs. Record findings on a throwaway
`research/uk-geo-primitives` branch and link them back here.

**Why this is first:** every option in the enforcement-layer decision hangs on whether the
free plan can block at the edge at all, and on whether health checks would break.

## Answer

Full findings with citations: [`assets/uk-geo-primitives-research.md`](../assets/uk-geo-primitives-research.md)
(328 lines, primary sources throughout — Cloudflare and Fly docs). Resolved 2026-07-29 by a
`/research` subagent. No `research/` branch — `.scratch/` is gitignored, so the sanctioned
asset-path fallback was used; nothing was committed.

The five answers, distilled:

1. **Cloudflare free plan: yes, with two caveats.** `CF-IPCountry` comes from the free
   "IP Geolocation" zone setting (or the visitor-location Managed Transform) — **not documented
   as on-by-default**, so the zone setting must be verified (→ new task ticket). WAF Custom
   Rules on free: **5 rules**, country blocking fully supported via `ip.src.country`
   (`ip.geoip.country` is a deprecated alias). Cloudflare's own docs show the exact
   allow-one-country pattern. **Trap:** "country block is Enterprise-only" applies to IP
   *Access* Rules, a different tool. **Block response is NOT customisable on free** — visitors
   get Cloudflare's unbranded Error 1020, not our page (custom responses are Pro+).
2. **Fly.io has nothing.** No geo primitive, no client-country header. `Fly-Region` is the
   Fly edge, not the client; behind Cloudflare, `Fly-Client-IP` is *Cloudflare's* IP (right
   field for proving the caller is Cloudflare, wrong one for locating the visitor).
3. **Health checks are safe from edge rules — decisive.** `http_service.checks` runs "over the
   app's private network, not against the public hostname" (verbatim, Fly config reference).
   An edge WAF rule can never flap a machine. Corollary: an **app-level** country check WOULD
   fail health checks (no CF headers) unless `/health` is exempt — and would break CI, whose
   smoke tests hit `https://hoe-<app>.fly.dev/health` directly (US runners, no Cloudflare).
4. **Direct-origin bypass — four options.** (a) Shared-secret header via a free Transform Rule
   (10 free) — cheapest, works today; (b) Cloudflare origin-IP allowlist enforced in-app
   against `Fly-Client-IP` — proves *a* Cloudflare zone, not ours; pairs with (a);
   (c) Cloudflare Tunnel + release Fly public IPs — strongest, costs a `cloudflared` process
   and the `.fly.dev` CI smoke URL; (d) Authenticated Origin Pulls — effectively blocked by
   Fly's managed TLS termination; not recommended.
5. **No published accuracy figure.** Cloudflare commits to update cadence only. Failure yields
   **sentinel values, not a missing header**: `XX` (unknown) and `T1` (Tor). So
   `not ip.src.country in {"GB"}` is fail-closed (blocks XX/T1 too — behind an unbrandable
   1020); the inverse framing is fail-open. This choice must be made knowingly.

**Implication for the enforcement-layer decision** (ticket 02): the free plan can do edge
blocking safely (health checks untouched), but can't control what a blocked visitor sees;
app-level enforcement controls the copy but must exempt `/health` and would break the current
CI smoke unless the boundary accounts for it. Either layer alone leaves the `.fly.dev` bypass
open; the Transform-Rule shared secret is the cheap close.

**Two facts a doc read couldn't settle**, handed onward:
- Whether the homeofed.com zone has IP Geolocation enabled → new task ticket
  [Check the Cloudflare zone's IP Geolocation setting](11-check-zone-geolocation-setting.md).
- CI smoke URLs staying on `.fly.dev` is currently an accident that edge enforcement depends
  on → folded into ticket 02's considerations.
