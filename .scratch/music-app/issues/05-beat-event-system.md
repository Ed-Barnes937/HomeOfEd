# Beat-event system shape

Type: grilling
Status: resolved
Blocked by: 03, 04, 09

## Question

Define the beat-event contract the sequencer/sound engine exposes: the event
model (event types, payload, timing guarantees) and the seam. V1 ships no
visual consumer (runner-prototype decision: music-first V1), so this is the
seam a **future** visual/world layer rides without rework — plus V1's own UI
needs (playhead, hit flashes). Must support an extensible sound palette. Use
/domain-modeling; informed by what the three prototypes actually needed —
note the runner prototype's finding that a monotonic tick + beat-space
arrival positioning is the model a world layer needs.

## Answer

Decided with the user (2026-08-02), grilled one decision at a time. The
contract, in full:

**Channels & timing.** The **schedule-time event stream is the canonical
contract**: beat events fire when the engine schedules a step (~lookahead,
default 0.1 s, before it sounds) and carry `audioTime` so any consumer can
align itself. A future world layer needs this lookahead (entity spawning). On
top of it the engine offers a **draw-time convenience subscription** (Tone.Draw
semantics) — all V1's playhead/hit-flashes need, without every UI consumer
re-implementing the draw dance.

**Beat event payload** — one event **per step** (empty steps included, so the
playhead and `songPos()` anchoring never starve), never per hit:

```ts
{
  tick: number,             // monotonic, never wraps at the pattern boundary
  step: number,             // 0–15 grid column; tick mod 16
  audioTime: number,        // AudioContext time this step will sound
  hits: [{ instrumentId }]  // rows sounding on this step; possibly empty
}
```

`hits` entries are objects, not bare strings, so future fields (e.g. `note`
for the melody lane) are additive, not breaking.

**`songPos()`** is a continuous query method on the engine (read per animation
frame), guaranteed re-anchored on each scheduled beat — the runner prototype's
key primitive; it can't be event-shaped.

**Non-beat events:** `started` / `stopped` transport events and
`tempoChanged { bpm }`. **Pattern edits are deliberately not an event
stream** — the engine exposes the current pattern as readable state;
consumers re-derive (Hill Rider's pure-function terrain validated this).
Immediate audition on toggle is the engine's job, internal to it. Edit deltas
can be added later if a real consumer needs them.

**Instrument identity:** `instrumentId` is an **opaque string key defined by
the kit manifest**; the contract never enumerates instruments. Instrument
metadata (name, artwork, sound file) is read from the loaded kit, which the
engine exposes as readable state — so adding instruments stays pure data. The
manifest reserves an **optional semantic `role` field** per instrument
(kick / snare / hat / perc / melodic) so a V2 world layer can map behaviour
without hardcoding ids; V1 ignores it.

**Where it lives:** a `SequencerEngine` TypeScript interface inside
`apps/boop`, Tone.js implementation behind it. No `packages/*` extraction
(no consumer outside boop; packages are plumbing) and no ADR now — the spec
(ticket 07) is the artifact; an ADR can be written at build time if needed.

**For the spec ticket to carry:** the minted domain terms — beat event, tick
vs step, hit, `songPos()`, kit manifest, role — should land in
`apps/boop/CONTEXT.md` when the app is built.
