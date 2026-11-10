# 0026 — boop share links live in the URL fragment

- **Status:** Accepted
- **Date:** 2026-08-06
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (boop is stateless),
  [ADR 0025](0025-boop-save-format.md) (the boop shape this encodes), the
  spec's "Sharing & export" section
  ([`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md)).
  Implements ticket 21. Terminology updated by ticket 35 ("groove" → "boop");
  the encoding itself is unchanged — see the note below.

> **Ticket 35 note:** the `#g=` prefix and the payload's `{ version, creation }`
> field names are frozen — every link already shared depends on them, and the
> `g` and `creation` predate this rename (both stood for "groove"). Only the
> TS type (`StoredCreation` → `StoredBoop`) and the decode function
> (`decodeStoredCreation` → `decodeStoredBoop`) renamed.

## Context

A child should be able to send a boop to someone. The
[spec](../../.scratch/music-app/spec.md) makes URL-hash links the primary
sharing affordance: no server, no account, no gallery. boop is stateless
([ADR 0008](0008-apps-without-a-database.md)) and already has a versioned save
format for the working grid ([ADR 0025](0025-boop-save-format.md)).

The design handoff mentions a server-backed `/g/<id>` short link; the spec is
the authority and it says stateless. A short-link service stays a later,
additive option — the codec below is what a short link would store anyway.

## Decision

**Encoding.** `#g=<base64url(JSON({ version, creation }))>`, where `creation`
is the save format's `StoredBoop` — the same object the autosave writes.
The share codec calls the save format's own `decodeStoredBoop`, so pattern,
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
current-version boop — bad base64, bad UTF-8, bad JSON, an unknown version,
a malformed pattern, an out-of-range tempo. `null` means "no shared boop", and
the app opens its normal empty grid. It never throws and never shows an error.

**Fragment, not query string.** The fragment is never sent to the server, so
nothing a child made is logged by Fly or Cloudflare.

**Hash semantics on load.** The fragment is decoded once on boot, loaded into
the engine in place of the autosaved grid, written to the autosave slot, and
then removed with `history.replaceState`. So: a reload after following a link
keeps what the child has since played with, rather than snapping back to the
sender's version; and the URL in the address bar stops being a stale link to a
boop that has since been edited.

**Share affordance.** One button. `navigator.share` on touch devices
(`(pointer: coarse)` — capability alone can't decide, since macOS Safari and
Windows Chrome/Edge ship `navigator.share` too), `navigator.clipboard.writeText`
otherwise, with the label flipping to a cyan "Copied!" for 1.6s. A dismissed
share sheet is reported as dismissed, not quietly copied. No modal, no link
field.

## Consequences

- Links are long-ish but self-contained and outlive any deployment of boop.
- Nothing to run, store, moderate or expire; no privacy surface.
- Sharing a boop replaces the recipient's working grid. Acceptable while
  "My boops" is the deliberate save; revisit if that changes.
- WAV export (the demoted secondary link under Share) is a separate ticket and
  reuses none of this beyond the button's placement.

## Amendment (2026-11-10): links open at `/shared`

The encoding is unchanged. Share now builds `<origin>/shared#g=...`, the view
the estate gate leaves open ([ADR 0093](0093-estate-gate.md) decision 6): it
opens the boop to play and edit, keeps nothing, and leaves the fragment in the
address bar so a reload reopens it. Old root links keep working for a
signed-in player.

"Keep this boop" goes to `/`, where the hash semantics above apply, and keeps
what the visitor has now, edits included. On a signed-in device it therefore
replaces that profile's working grid, as a root share link always did; the
saved boops in "My boops" survive. This refines ADR 0093 decision 6,
which said "the same fragment". If the boop still encodes exactly as it did
when the view opened, the link carries the arrival fragment byte for byte, so
an untouched share (even one this build cannot decode) arrives at the root
exactly as it was sent. Otherwise the current boop is encoded with this same
codec into a fresh `#g=`.

The kept link is no longer than a share link for the same boop. The largest
boop the save format allows (35 clips, every row of the 23-instrument kit, every
step and pitch on) encodes to about 68,000 characters. Typical boops are a few
hundred to a few thousand. The fragment never reaches a server: the gate's
`302` and hub's `returnTo` carry no fragment, and the browser carries it across
the redirect. The ceiling that matters is the browser's own: Chromium's is 2 MB,
far above the worst case. The worst case was sent through the
docker stack's gate, sign-in and pick in Chromium and WebKit and arrived byte
for byte. If a messaging app truncates a link, decode is total (above): the
recipient gets a first visit, not an error.
