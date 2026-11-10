# 24 - apps: small follow-ups found in the reviews of tickets 10-15

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 6, 7

None blocks the epic. Each is small.

- **boop: Keep from a link with no boop sends a junk fragment to `/`.** On
  `/shared#<malformed or empty>` the page shows the first-visit state; Keep
  with no edits then carries the bogus fragment to the root, which decodes to
  nothing and leaves the junk in the address bar. armoury fixed the same case
  in ticket 11 (`keepFragment`: no fragment or undecodable goes to `/` with no
  fragment). Copy that guard and its test.
- **espy: the native-shell check can be met by a third-party in-app
  WebView.** Capacitor reports "native" when `window.androidBridge` or
  `window.webkit.messageHandlers.bridge` exists. Inside such a WebView espy
  would save to the unscoped device key with no player pill. The check already
  drove Save's native path before the epic. Hardening: also require the
  Capacitor origin (`capacitor://localhost` or `https://localhost`).
- **espy: a profile whose first copy of the device doodle fails never gets it
  later** (ADR 0094, "espy's drawing, measured"). Past about 1.3 MB of
  drawings on a device, a later profile opens a blank page; the device doodle
  stays where it is. Only worth acting on if it is met in practice; bounding
  the saved doodle's size would close it.
- **fridge: a stale Keep stash can apply.** Press Keep with edits, abandon at
  hub, later reach `/keep/<id>` in the same tab: the earlier edits are
  imported. Accepted in ticket 14; a timestamp on the stash would close it.
- **A player change in another tab reloads the page, losing an unsaved edit**
  in karesansui (garden not yet saved as a preset) and boop's player view.
  Accepted; noted so nobody rediscovers it.

## Comments
