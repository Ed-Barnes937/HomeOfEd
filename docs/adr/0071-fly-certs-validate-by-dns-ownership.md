# 0071 - Fly certs validate by DNS ownership, not by a grey-cloud window

- **Status:** Accepted
- **Date:** 2026-10-22
- **Supersedes:** [ADR 0011](0011-scripted-go-live.md) - its cert flow only; the
  rest of 0011 (one idempotent human-run script, human credentials, `--dry-run`
  as the testable path) stands unchanged.
- **Related:** [runbook G4.4](../runbooks/phase-4-go-live.md#g44--cloudflare-dns--tls),
  [G4.9](../runbooks/phase-4-go-live.md#g49--scripted-go-live-scriptsgo-livesh),
  [G4.12](../runbooks/phase-4-go-live.md#g412---certificate-renewal-failure-525-behind-cloudflare)

## Context

ADR 0011 resolved the Cloudflare-proxy / Fly-cert chicken-and-egg with a
**grey → Issued → orange** sequence: create the CNAME DNS-only so Let's Encrypt
validates against Fly directly, then flip it to proxied once the cert issues.

That validates exactly **once**. Roughly 30 days before expiry Let's Encrypt
retries, the HTTP-01 challenge can no longer reach the origin through the orange
cloud, renewal fails silently, the cert lapses, and Full (strict) turns every
request into **HTTP 525**. Every app the script onboarded carried this fault from
the day it went live.

On 2026-10-22 seven of nine apps were stuck at `Issuing...`. **Five had been
serving 525 for two weeks** (wotd, boids, fridge, espy, karesansui) with no
signal other than someone visiting one of them; boop and silt were days from the
same fate. The only healthy apps were `hub` and `sprout` - the two set up by hand
with a permanent `_fly-ownership` TXT record.

Two independent defects:

1. **The strategy.** The validation path exists only during a window at go-live
   and is deliberately closed afterwards.
2. **The poll.** `grep -qiE 'issued|ready'` matched the `Issued = rsa,ecdsa`
   line - a *key-types* field, unrelated to status - so the loop returned true on
   its first iteration while `Status = Issuing...`. The script re-proxied the
   record within seconds and reported success on the cert step, then failed at
   verification. Re-running it on a broken app only re-flipped DNS.

## Decision

Validate by **DNS ownership, permanently**.

- **The CNAME is proxied from creation.** No grey window, no flip. The origin is
  never briefly exposed unproxied.
- **An `_fly-ownership.<app>` TXT record is added at go-live and never removed.**
  Fly accepts it in place of reaching the origin, so validation works identically
  at first issuance and at every unattended renewal.
- **The poll asserts a real certificate**, from `fly certs show --json`: at least
  one entry with `status == "active"` *and* `expires_at` in the future. A status
  word alone is never sufficient - a lapsed cert reports `Status = Issued` next
  to a past expiry, which is precisely how the old check passed while the site
  was down.

The `_acme-challenge` CNAME that `fly certs setup` also prints is **not** added:
Fly documents it as "only needed if you want to generate the certificate before
directing traffic", which is not this flow. `sprout` has run without one since
August.

## Rejected alternatives

- **Fix the grep, keep the grey-cloud dance.** Repairs the false green but not
  the cause: renewal still has no validation path, so every app still breaks at
  ~60 days. The dance also exposes the origin unproxied during each window.
- **Cloudflare Origin CA certificates** (15-year, no ACME at all). Genuinely
  removes this failure class, but Full (strict) would then trust a
  Cloudflare-issued cert, the origin stops being publicly verifiable, and each
  app needs a manual cert install into Fly. Worth revisiting if Fly's ACME proves
  unreliable; the DNS-ownership path is simpler and keeps real public certs.
- **Alerting on expiry instead of fixing issuance.** Rejected as the primary
  response - monitoring an avoidable failure is not a fix. Declined outright for
  now by the owner (single user, no external audience).

## Consequences

- Renewal is unattended. **Proven in the incident:** once their TXT records
  existed, `boop` and `silt` completed their stuck renewals with no further
  intervention, moving from 2 weeks to ~3 months of remaining life.
- **An already-lapsed cert is not self-healing.** Adding the TXT verifies
  ownership but does not retroactively reissue; recovery needs
  `fly certs remove --yes` + `fly certs add`. Only ever do that on a cert that
  has *already* expired - running it against a live cert takes a working site
  down. See G4.12.
- New CLI-shape dependency: the ownership token is scraped from `fly certs setup`
  text, because that command ignores `--json`. The status poll moved the other
  way, from text to `--json`, so net fragility is roughly unchanged (ADR 0011's
  warning still applies).
- `go-live.sh` is now also the repair tool for a lapsed app: it is idempotent and
  adds the missing TXT, though the `fly certs remove`/`add` step stays manual
  because it is destructive.
