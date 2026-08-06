# 0026 — boop share links live in the URL fragment

- **Status:** Accepted
- **Date:** 2026-08-06
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (boop is stateless),
  [ADR 0025](0025-boop-save-format.md) (the creation shape this encodes), the
  spec's "Sharing & export" section
  ([`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md)).
  Implements ticket 21.

## Context

A child should be able to send a groove to someone. The
[spec](../../.scratch/music-app/spec.md) makes URL-hash links the primary
sharing affordance: no server, no account, no gallery. boop is stateless
([ADR 0008](0008-apps-without-a-database.md)) and already has a versioned save
format for the working grid ([ADR 0025](0025-boop-save-format.md)).

The design handoff mentions a server-backed `/g/<id>` short link; the spec is
the authority and it says stateless. A short-link service stays a later,
additive option — the codec below is what a short link would store anyway.

## Decision

**Encoding.** `#g=<base64url(JSON({ version, creation }))>`, where `creation`
is the save format's `StoredCreation` — the same object the autosave writes.
The share codec calls the save format's own `decodeStoredCreation`, so pattern,
tempo and kit id validate identically whether they arrive from `localStorage` or
from a link, and V2 additions (more instruments, new kits, chained patterns)
extend both at once.

`SHARE_FORMAT_VERSION` is its own number, deliberately *not* the save format's:
links are out in the world for good, so bumping how boop stores things must not
invalidate every link ever sent. It moves only when the link scheme itself
changes, and a V2 decoder keeps the V1 branch beside it.

Base64url of JSON rather than a tighter bit-packed scheme: a 6×16 grid encodes
to roughly 300–400 characters, which messaging apps carry fine, and the version
field leaves the door open to a denser V2 without breaking V1 links.

**Defensive decode.** `decodeShare` returns `null` for anything that is not a
current-version creation — bad base64, bad UTF-8, bad JSON, an unknown version,
a malformed pattern, an out-of-range tempo. `null` means "no shared groove", and
the app opens its normal empty grid. It never throws and never shows an error.

**Fragment, not query string.** The fragment is never sent to the server, so
nothing a child made is logged by Fly or Cloudflare.

**Hash semantics on load.** The fragment is decoded once on boot, loaded into
the engine in place of the autosaved grid, written to the autosave slot, and
then removed with `history.replaceState`. So: a reload after following a link
keeps what the child has since played with, rather than snapping back to the
sender's version; and the URL in the address bar stops being a stale link to a
groove that has since been edited.

**Share affordance.** One button. `navigator.share` on touch devices
(`(pointer: coarse)` — capability alone can't decide, since macOS Safari and
Windows Chrome/Edge ship `navigator.share` too), `navigator.clipboard.writeText`
otherwise, with the label flipping to a cyan "Copied!" for 1.6s. A dismissed
share sheet is reported as dismissed, not quietly copied. No modal, no link
field.

## Consequences

- Links are long-ish but self-contained and outlive any deployment of boop.
- Nothing to run, store, moderate or expire; no privacy surface.
- Sharing a groove replaces the recipient's working grid. Acceptable while
  "My grooves" is the deliberate save; revisit if that changes.
- WAV export (the demoted secondary link under Share) is a separate ticket and
  reuses none of this beyond the button's placement.
