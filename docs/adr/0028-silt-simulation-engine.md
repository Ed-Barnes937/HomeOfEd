# 0028 — silt: simulation engine calls not fixed by the spec

- **Status:** Accepted
- **Date:** 2026-08-05
- **Related:** `.scratch/sand-sim/spec.md` §5 (the locked spec — cell layout, the
  archetype/hook split, the reaction table, chunking, determinism). Implemented
  across silt tickets 03 (sim core), 05 (chunking) and 06 (full element model).
  **Amended by [ADR 0036](0036-silt-sim-in-a-worker.md)** (2026-08-26): the
  engine described here is unchanged, but it no longer ticks on the main
  thread — it runs in a worker over shared memory. Everything below about the
  engine's internals still holds; read 0036 for the threading model.

## Context

The spec fixes the engine's *shape*: a 4-byte cell in one buffer, a `clock`
double-update guard, archetypes that own movement and hooks that own
transmutation, a tag-keyed reaction table, chunking with two dirty rects and a
deferred cross-chunk move list, and a seeded PRNG. It does not say how those
pieces interact once they are all in the same tick, and several of those gaps
are places where a plausible implementation is silently wrong. This ADR records
the calls made in the gaps.

## Decision

### 1. The clock guard is restored on wake, not maintained while asleep

The `clock` guard works because every occupied cell carries the same value at a
tick boundary; the byte wraps every 256 ticks, and the invariant is what stops a
wrapped value colliding with a live one. Chunk sleeping breaks it directly — a
cell in a sleeping chunk goes unstamped for as long as it sleeps.

**Every tick opens with a pass that stamps every cell it is about to scan with
the settled clock**, over *all* awake chunks before *any* chunk is scanned. The
ordering matters: a per-chunk restore would un-stamp a cell an earlier chunk had
just moved into. `Grid.stamp` is therefore exempt from the chunk bookkeeping
every other write goes through — it touches every occupied cell each tick, so
treating it as a change would mean nothing ever slept.

### 2. Scan order deviates from the unchunked sim within a chunk band

Chunk rows run bottom-up and rows within a chunk run bottom-up, so a falling
cell still travels exactly one cell per tick. But a chunk is scanned in full
before its neighbour, so within a horizontal band `CHUNK_SIZE` rows tall the
order is *per chunk column*, not per row: a cell at `y` in one chunk is
processed before a cell at `y + 1` in the chunk beside it. A globally row-major
bottom-up scan would do the opposite.

Accepted. It is deterministic, it does not affect the one-cell-per-tick
invariant, and preserving global row order would mean interleaving chunks row by
row — which destroys the point of chunking (a chunk being independently
scannable, and one day independently *runnable*).

### 3. The archetype set is closed by an exhaustive switch

`applyArchetype` switches over the `Archetype` union with a `never` default, so
the set cannot grow without its kernel landing in the same change. This is the
spec's "closed set of four" made mechanical rather than documentary. The
accepted cost is named in the spec: a projectile would someday force a fifth
`particle` archetype, and that will be a compile error until it is written.

### 4. Reactions run after movement, before decay, before the hook

Per cell, in order: **archetype movement → reactions → lifetime → `onTick`**.
Each step can transmute the cell, and each is gated on the last, so an element's
code never runs on a cell that is no longer that element.

- Movement first is the spec's rule and the reason the rest is safe: nothing
  after it moves anything.
- Reactions before the hook because a reaction is the world acting on the cell,
  and a hook that fires on a cell already turned to obsidian is a bug the
  element author cannot defend against.
- Reactions are checked **against the four orthogonal neighbours only**. A
  diagonal touch is a corner; counting it doubles the neighbour checks on every
  cell in the world for a crust that looks much the same.

Consequence: a reaction with `p < 1` that fizzles between two cells which then
settle can leave the pair permanently unreacted, because the chunk sleeps. This
is fine for the one v1 row (`p: 1`) and is a real constraint on any future
probabilistic row — such a row wants its element to keep its chunk awake (§7).

Two limits of the tag expansion, worth knowing before a second row lands: tags
resolve against the authored roster, so the engine's own `wall`/`empty`
pseudo-elements can never be matched by a tag side even though `wall` carries
`solid`; and where an element name and a tag collide, the name wins silently.

### 5. The reaction table is flattened to id pairs at boot

The authored table stays tag-keyed, which is what stops it growing with the
roster. At boot it is expanded into a map from an ordered `(speciesA, speciesB)`
pair to a resolved rule, stored **both ways round** with the `becomes` sides
swapped, so the outcome does not depend on which of the two cells the scan
reaches first. Where two rows cover the same pair, the earlier row wins.

`maxHardness` is resolved at boot too: a pair the row is too weak to affect is
never registered, rather than re-checked every tick. It is read as a constraint
on **both** participating cells.

### 6. Dispersion is a walk of validated single steps, and only strays stop

`liquid`/`gas` take up to `dispersion` sideways cells in a tick. Each cell is a
separate, separately-validated swap rather than one long jump, so a liquid can
never skate through something that arrived mid-tick.

- Both sideways directions are tried, like the powder's two diagonals — the coin
  picks the order, not the opportunity. Trying only one would leave a cell that
  wrote nothing whenever its draw picked the blocked side, and its chunk would
  sleep with the puddle still uneven.
- A step that crosses a chunk edge is queued rather than committed, and the
  cursor does not follow, so the spread **stops at the chunk edge** and resumes
  next tick. `MovementApi.deferred` is how a kernel sees this.
- Sideways is the one move with no gravity behind it, and it is the one that
  refuses to settle: a lone cell on open ground slides a fresh `dispersion`
  cells every tick forever, and nothing near it ever sleeps. **The gate is
  strays only** — a cell with nothing resting on it and no more of the same
  liquid either side does not spread. Weaker-looking gates were tried and
  rejected: gating on weight above, or on weight plus a reachable drop, both
  leave pools **mounded like a powder** instead of level, which fails the point
  of having a liquid archetype at all.

Consequence: an unconfined body of liquid never goes perfectly still — cells
that still have a neighbour keep shuffling. That is bounded and cheap (tens of
cells, ~0.02ms/tick in a scene with a full basin) because everything else in the
world does sleep, and it is the price of pools that actually level.

### 7. A cell that declines to move must say so: `keepAwake()`

Chunk sleeping is driven by writes. A `move` probability that does not come up
writes nothing, so a slow liquid would fall asleep in mid-air. `MovementApi`
gains `keepAwake()`, which marks the cell's chunk dirty for the next tick and
changes nothing else; the fluid kernel calls it when the gate blocks a step that
*was* available. `canMove(dx, dy)` — a `tryMove` peek — is what makes "was
available" answerable.

### 8. Gas rises by being lighter than everything, not by pushing

Gas density is negative and displacement stays a single direction-free rule
(`mover density > target density`). A gas therefore never displaces anything; it
moves into empty space, and rises because everything above it sinks *past* it.
This keeps one displacement rule shared by the in-chunk and deferred move paths,
where a direction-aware rule would need both to agree about "up".

### 9. Lifetime is seeded lazily, and the byte ceiling is a boot error

`ra == 0` means "not seeded yet". A cell painted or spawned mid-run starts its
countdown on the first tick that sees it, jittered from the sim PRNG so a batch
spawned together does not expire in one frame. Writing `ra` also marks the chunk
dirty, which is what keeps a decaying cell awake in a settled corner.

`ticks + jitter` must fit in the byte, and the registry **refuses the roster**
if it does not. Clamping at runtime instead would give the author a shorter life
than they asked for and never say so — the same class of bad value as the
unknown `becomes` targets that already fail at load.

### 10. Obsidian's colour is invented

The design brief's swatch list names only the paintable elements. Obsidian is a
reaction product, so it has no brief value; `#2a2430` was chosen to sit between
the world's near-black and the cooled-rock purple the lava suggests. Water
(`#6f9fc4`) and lava (`#d4622a`) are the brief's exact values.

## Consequences

- The clock guard, the deferred move list and the sleep path are now three
  things that must be changed together. The two chunking traps the spec names
  (PRNG tie-break, fixed chunk order) are joined by a third: **anything that
  should keep happening must write, or say `keepAwake()`**.
- `MovementApi` grew three members (`canMove`, `keepAwake`, `deferred`) that
  exist only because of chunking. They are on the *movement* surface, not the
  element-facing `Api`, so element authors never see them.
- The reaction table's cost is paid at boot, in the roster's size, not per tick.
  A roster ten times the size costs ten times the boot work and the same tick.
- Probabilistic reactions and probabilistic movement have different sleep
  behaviour: movement can declare itself still-live, a reaction currently
  cannot. If a `p < 1` row is ever added, that gap has to close.
