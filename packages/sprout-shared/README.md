# @hoe/sprout-shared

Cross-cutting domain constants for the sprout product: preset definitions, the
slider model, and the sensitive-topic calibration question bank. **Zero
runtime dependencies. TypeScript only.**

The leaf-node home for the subset of `apps/sprout`'s domain model that
`apps/sprout-pipeline` also needs (system-prompt construction) — root
`CLAUDE.md` hard rule 1 forbids app→app imports, so this package is the shared
seam (plan [`0004`](../../docs/plans/0004-sprout-migration-plan.md) §5.6).

## What's here vs. what stays app-local

- **Here:** `PresetName`, `PresetSliders`, `PresetDefinition`, `Preset`,
  `PRESET_DEFINITIONS`, `PRESET_LIST`, `SLIDER_LABELS`, `CalibrationQuestion`,
  `CalibrationOption`, `CalibrationAnswer`, `CALIBRATION_QUESTIONS` — used by
  both `apps/sprout` (onboarding UI, handlers, prompt building) and
  `apps/sprout-pipeline` (system-prompt construction).
- **Stays app-local** (`apps/sprout/src/server/domain/`): `SLIDER_KEYS`, the
  server-side slider-key allow-list — a sprout-only concern the pipeline never
  needs. Also app-local: sprout's own `ChatMessage`/`FlagType` shapes
  (`features/chat/useChat.ts`, `server/handlers/flags/schemas.ts`) — these are
  tRPC/DB-driven and diverge from the source repo's plain shared types, so they
  were not ported here.

## Usage

```ts
import { PRESET_DEFINITIONS, CALIBRATION_QUESTIONS } from '@hoe/sprout-shared'
import type { PresetName, PresetSliders, CalibrationAnswer } from '@hoe/sprout-shared'
```

## Testing

No logic lives here — pure data/type definitions — so there is no test suite,
only `lint` + `typecheck`.
