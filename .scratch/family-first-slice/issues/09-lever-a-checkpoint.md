# 09 - Lever A checkpoint: hub scale-to-zero, revisited

**Status:** ready-for-human
**Type:** grilling (HITL - this is Ed's deferred decision)
**Spec:** [../spec.md](../spec.md) §11; map decision 8
Blocked by: 08

Decision 8 deferred Lever A (hub `min_machines_running` 1 -> 0, ~$3.24/mo)
until the first slice ships and the apex/login cold start can be felt for
real. Once the pilot has run for a bit:

- Ed feels the cold start on `homeofed.com` and the `/account` flows.
- Decide: flip hub to scale-to-zero, or keep it always-on and close Lever A.
- Record the verdict here; if flipping, the fly.toml change is a normal PR
  and the deploy is human-gated as ever.

Nothing in the slice depends on this either way.

## Comments
