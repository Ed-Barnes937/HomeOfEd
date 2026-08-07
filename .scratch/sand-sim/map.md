# Map: Sand simulation app (wayfinder:map)

## Destination

A spec (`.scratch/sand-sim/spec.md`) for a new HomeOfEd app — a cellular-automata
sand simulation with scene setup, element interactions, and spawners — with all
key decisions locked, ready to hand to implementation. Building the app is a
separate effort.

## Notes

- Domain: falling-sand cellular automata; HomeOfEd leaf app (SPA, TanStack, tRPC,
  stateless per ADR 0008).
- Skills to consult: `design-an-interface` / `prototype` for the element model
  ticket; `research` for prior art; `grilling` for anything unresolved.
- Standing preferences: start simple but very modular; modest v1 targets with
  ambitious architecture; judicious tests, not exhaustive suites.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [01 — Prior-art research](issues/01-prior-art-research.md) — architecture stance fully validated; adopt Sandspiel's 4-byte cell + `clock` generation stamp, a tag-keyed pair-reaction table alongside per-element updates, and winter.dev's two-rect chunk pattern (no thread pool) — with the seeded PRNG owning the cross-chunk move tie-break.

- [03 — App name](issues/03-app-name.md) — **Silt**: `silt.homeofed.com`, `apps/silt`, Fly app `hoe-silt`.

- [02 — Element modularity model](issues/02-element-modularity-model.md) — **archetype + hooks**: a closed engine-owned set of four motion archetypes (static/powder/liquid/gas + params) owns movement; transmutation is open via one `onTick(api)` hook (runs after movement), an engine-managed `lifetime` flag, and the tag-keyed pair-reaction table. Grafts: WALL sentinel for out-of-bounds reads, boot-time registry validation, `ra`/`rb` byte ownership rules. Four candidate designs compared in [element-model-designs.md](research/element-model-designs.md).

- [04 — UI/UX design prompt for claude-design](issues/04-ui-design-prompt.md) — prompt written at [design/ui-design-prompt.md](design/ui-design-prompt.md); visual direction deliberately left open for the design work. Running claude-design is new ticket [08 — Run claude-design and capture the UI/UX output](issues/08-run-claude-design.md), which now gates the spec assembly.

- [06 — Grid dimensions / world size](issues/06-grid-dimensions.md) — fixed logical grid, **300×200** build-time constant (growable later — scene header must store dimensions, handed to ticket 07); canvas scale-to-fit with smoothing off, letterboxed; resize = refit only, DPR-aware; no compression requirement or scene cap needed for localStorage.

- [07 — Scene serialisation format](issues/07-scene-serialisation-format.md) — versioned JSON envelope per scene: `species+ra+rb` planes as raw base64 (`encoding` field is the future-compression seam), element-id→name table with remap-by-name on load (unknown → empty cell), minimal `{x,y,element}` spawners, `silt:scene:<uuid>` keys + `silt:scenes` index, bottom-centre paste if the grid grew / refuse if it shrank, loud non-destructive failure handling, loads always enter paused.

- [08 — Run claude-design and capture the UI/UX output](issues/08-run-claude-design.md) — design done and captured: **pixel toy** direction on a **docked left rail**; full component inventory, states, colour/type tokens, keyboard map, mobile bottom-bar adaptation; scenes popover includes the required delete affordance. Agent-readable capture at [design/design-brief.md](design/design-brief.md); source HTML in `design/Silt handoff/`. The brief's residual open questions (reset semantics, a letterboxing conflict with ticket 06, rail collapse) are new ticket [09 — Resolve the design brief's open questions](issues/09-design-open-questions.md), which now gates the spec assembly.

- [09 — Resolve the design brief's open questions](issues/09-design-open-questions.md) — reset clears everything (cells *and* spawners); letterboxing stands (06 wins, unamended at 300×200 — Sandspiel is 300×300 for reference), margins painted `world` colour; rail collapse is post-v1; one-word element names confirmed, water+lava product named **Obsidian**.

- [05 — Assemble the spec](issues/05-assemble-spec.md) — **spec written at [spec.md](spec.md)**; all decisions consolidated into twelve sections, ready to hand to implementation. **The destination is reached — no open tickets remain.**

Decisions locked during charting (grilling session, 2026-08-02):

- **Interaction model** — pause/play toggle (paused = setup mode), painting works
  in both states; step + reset controls.
- **Stateless** — no Postgres; scenes persist to localStorage with a simple scene
  list; shallow `/health`.
- **v1 roster** — Dirt (static), Sand (powder), Water (liquid), Lava (slow
  liquid); one reaction (water + lava → stone/obsidian); one spawner type
  (continuous emitter). Eraser is a tool, not an element. Lava ignition out of
  v1 but the interaction model must accommodate it later.
- **Architecture stance** — typed-array grid (never objects-per-cell);
  sim/renderer split behind a narrow interface (Canvas 2D first, WebGL drop-in
  later); chunked/dirty-region design from the start; fixed-timestep sim
  decoupled from render loop; worker-ready transferable buffers.
- **Determinism** — seeded PRNG owned by the sim, no `Math.random()`, fixed
  update-order rules. Tests are few and targeted (behavioural unit cases), not
  golden-snapshot suites.
- **Desktop-first, mobile-ready** — responsive layout and basic touch painting
  must work; no mobile-specific investment.

## Not yet specified

(nothing — remaining open decisions are all live tickets)

## Out of scope

- Building/deploying the app — separate effort once the spec exists.
- Database / shareable scene URLs — additive later (ADR 0008).
- Mobile-specific investment (Capacitor, mobile layouts beyond "works").
- Lava ignition and elements beyond the v1 roster — post-v1; engine must merely
  accommodate them.
