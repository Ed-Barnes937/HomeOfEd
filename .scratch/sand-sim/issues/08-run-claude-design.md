# 08 — Run claude-design and capture the UI/UX output

Type: task
Status: closed
Assignee: ed
Blocked by: 04

## Question

Send the prompt at [design/ui-design-prompt.md](../design/ui-design-prompt.md)
to claude-design (human-run) and capture its output — wireframe, component
inventory, interaction states, chosen visual direction — under
`.scratch/sand-sim/design/`, linked from this ticket. Resolving this clears
the remaining scene-tools and scene-list fog and unblocks the spec assembly
([05](05-assemble-spec.md)).

Constraint from [07 — Scene serialisation format](07-scene-serialisation-format.md):
the scene list must include a **delete-scene affordance** — it is the only
escape from a full localStorage quota, so it is required, not nice-to-have.

## Resolution (2026-08-05)

claude-design was run (human) and its output captured under
`design/Silt handoff/` — two self-contained HTML files (wireframes + hi-fi,
and the design brief) plus a README index. Because the HTML files are
JS-bundled and need a browser, the brief is also captured as agent-readable
markdown at [design/design-brief.md](../design/design-brief.md).

**What was chosen:**

- Visual direction **pixel toy** (over field notebook / dark cabinet);
  layout **docked left rail** (over floating dock / framed object).
- Full component inventory: grouped palette (Solid/Powder/Liquid/Energy),
  four brush sizes, paint/spawner mode toggle, erase as a tool, sim controls
  top-right, spawner chrome (white-outlined box, ghost preview, red-minus
  removal), scenes popover, status bar. Keyboard map included.
- Scene-list UX: popover with save-current, thumbnail rows, inline rename,
  **delete with a second click** — the required delete affordance is present.
- Four interaction states (first visit / running / paused / spawner mode),
  full colour tokens and type (Silkscreen + IBM Plex Mono), mobile
  bottom-bar adaptation.

This clears the scene-tools and scene-list fog. The brief's own open
questions (reset-vs-spawners, rail collapse, and a letterboxing conflict
with [06 — Grid dimensions](06-grid-dimensions.md)) are new ticket
[09 — Resolve the design brief's open questions](09-design-open-questions.md),
which now also gates [05 — Assemble the spec](05-assemble-spec.md). The
brief's question about storing spawners is already answered by
[07 — Scene serialisation format](07-scene-serialisation-format.md)
(spawners are `{x,y,element}` entities).
