# 07 — Scene serialisation format

Type: grilling
Status: resolved
Assignee: ed-barnes937 (resolved 2026-08-05)
Blocked by: 06

## Question

What is the localStorage scene format? The element model is locked
([02](02-element-modularity-model.md)): cells are `{species, ra, rb, clock}`
with pinned element ids, so the raw payload is knowable once grid dimensions
land ([06](06-grid-dimensions.md)). Decide: which bytes persist (species only,
or species + ra/rb — e.g. does a saved fire cell keep its remaining lifetime?),
encoding (raw bytes → base64 vs RLE — scenes are mostly empty space), a
versioned envelope (format version + element-id table so saves survive roster
changes), spawner persistence (spawners are entities, not cells), and the
per-scene size budget against the ~5 MB localStorage cap.

Constraints handed down from [06 — Grid dimensions](06-grid-dimensions.md)
(resolved): the grid is a fixed 300×200 build-time constant that **may grow
later**, so the envelope must store grid dimensions in its header (old scenes
stay loadable after a bump); byte budget is a non-issue at this size (~60KB
type-only, ~240KB worst case vs ~5MB) — compression is optional, not required.

## Answer

Grilling session, 2026-08-05. All decisions confirmed one-by-one.

**Persisted bytes:** `species + ra + rb`; `clock` is runtime bookkeeping, reset
to 0 on load. Keeping `rb` makes a loaded scene pixel-identical to what was
saved (colour variants kept); keeping `ra` means lifetime-bearing cells resume
mid-life.

**Encoding:** raw bytes → base64, three planar strings (`species`, `ra`, `rb`).
An explicit `encoding: "raw"` field in the envelope is the seam for adding
native `CompressionStream('deflate-raw')` or RLE later as a new encoding value
— noted as the future path, not built in v1. ~240KB/scene ≈ 20 scenes in the
5MB quota (Silt's own origin), plenty for v1.

**Envelope** — one JSON object per scene:

```json
{
  "version": 1,
  "width": 300, "height": 200,
  "encoding": "raw",
  "elements": { "1": "dirt", "2": "sand", "3": "water", "4": "lava", "5": "stone" },
  "species": "<base64>", "ra": "<base64>", "rb": "<base64>",
  "spawners": [ { "x": 150, "y": 10, "element": "water" } ]
}
```

- **Remap by name, not byte**: the `elements` table records what each species
  byte meant at save time; load remaps to the current registry's ids. Unknown
  element name → **empty cell** (load succeeds, console warning) — a slightly
  degraded scene beats an unopenable one.
- **Spawners**: minimal `{x, y, element}` (element by name); spawner with an
  unknown element is dropped; unknown extra fields tolerated-and-ignored so a
  later version can add type/rate knobs without breaking v1 loads.
- Envelope is **pure simulation data** — no name/timestamps (no duplication
  with the index; export/share is out of scope).

**Storage layout:** one key per scene `silt:scene:<uuid>`
(`crypto.randomUUID()`) plus an index key `silt:scenes` holding
`[{id, name, updatedAt}]` for the scene-list UI. Boot-time reconcile (~10
lines): drop index entries with no blob, adopt orphan blobs.

**Dimension mismatch** (grid is growable — constraint from
[06](06-grid-dimensions.md)): saved smaller than current → paste anchored
**bottom-centre** (gravity sim: piles stay on the floor), spawner coords get
the same offset. Saved larger than current (shrink, not planned) → **refuse to
load** with a clear error.

**Failure handling:** loud errors, never silent, never destructive.
`QuotaExceededError` on save → "storage full, delete a scene"; write order is
scene blob first, index second, so a failed write never corrupts the index.
Load failure (parse error, unknown `version`, plane length ≠ width×height) →
scene stays in the list with an error; **never auto-delete** a blob.

**Runtime state is not persisted:** loading always enters **paused** (setup
mode); the PRNG seed is per-session, not saved — determinism serves tests, not
cross-session replay.

**Handed to the design work ([08](08-run-claude-design.md)):** the scene list
needs a **delete-scene affordance** — it is the only escape from a full
localStorage quota, so it is required, not nice-to-have.
