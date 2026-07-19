# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. All ADRs are centralized here (system-wide and app-specific alike); there are no per-context `docs/adr/` directories.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a multi-context repo. Contexts are the leaf apps (`apps/*`) and shared packages (`packages/*`):

```
/
├── CONTEXT-MAP.md                     ← points at each context's CONTEXT.md
├── docs/adr/                          ← ALL decisions, system-wide and app-scoped
├── apps/
│   └── <app>/
│       └── CONTEXT.md                 ← created lazily by /domain-modeling
└── packages/
    └── <package>/
        └── CONTEXT.md                 ← created lazily by /domain-modeling
```

Each app also has a scoped `CLAUDE.md` (working rules) — that is separate from `CONTEXT.md` (domain model / glossary); don't merge them.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (reference starter app) — but worth reopening because…_
