# 08 — Postcard export

**Type:** research
**Status:** claimed
**Blocked by:** 01

## Question

The postcard (design: `2d Postcard` — cream card, rotated, planet photo,
"GREETINGS FROM <NAME>", Blip stamp, telemetry strip) exports as
`[ SAVE PICTURE ]` / `[ PRINT ]`. Research the mechanics:

1. Capturing a frame from the WebGL canvas: `preserveDrawingBuffer` trade-offs
   vs an on-demand re-render into a capture, `toBlob`/`toDataURL` limits.
2. Compositing the card: 2D canvas composite (planet frame + text + stamp
   drawn in) vs DOM-to-image approaches — which is reliable cross-browser
   without new heavyweight deps?
3. Saving: anchor-download vs Web Share API (nice on tablets); printing via
   `window.print` + print CSS on a dedicated element.
4. Any interaction with the chosen rendering stack (ticket 01) that changes
   the answer.

## Answer
