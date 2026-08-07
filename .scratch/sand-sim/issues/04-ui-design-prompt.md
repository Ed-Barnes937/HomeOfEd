# 04 — UI/UX design prompt for claude-design

Type: task
Status: resolved
Blocked by: 02, 03

## Question

Produce the prompt to send to claude-design for the app's UI/UX, once the shape
of what we're building is known (element model resolved, name chosen). The
prompt should cover: canvas-centric layout, element palette, brush/eraser
tools, spawner placement/removal, pause/play/step/reset controls, scene
save/load list (localStorage), desktop-first but mobile-ready. The ticket
resolves when the prompt exists and is linked here (the design output itself
feeds the spec, ticket 05).

## Answer

Prompt written: [design/ui-design-prompt.md](../design/ui-design-prompt.md)
(2026-08-02). It covers the fixed functional inventory (canvas-centric layout,
four-element palette scaling to ~15, brush sizes, eraser-as-tool, spawner
place/remove, pause/play/step/reset with paused-as-setup-mode, localStorage
scene list), the constraints (SPA, Canvas 2D sim area, desktop-first
mobile-works), and asks claude-design for a wireframe, component inventory,
interaction states, and 2–3 visual directions — visual direction is the one
axis deliberately left open for the design work to answer.

Running claude-design with this prompt and capturing its output is follow-on
ticket [08](08-run-claude-design.md); ticket 05's spec assembly now blocks on
that output, not on this prompt.
