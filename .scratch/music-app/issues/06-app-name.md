# App name + subdomain

Type: grilling
Status: closed
Assignee: ed-barnes937
Blocked by: —

## Question

Pick the app's name — it fixes `apps/<name>`, the `<name>.homeofed.com`
subdomain, the Fly app name, and the port-registry row. Kid-friendly, short,
music/rhythm flavoured, not colliding with existing HomeOfEd apps (hub, boids,
espy, wotd, fridge, karesansui, Mosa/colour-by-numbers, sprout).

## Resolution

The app is **boop**.

- Package/dir: `apps/boop`
- Subdomain: `boop.homeofed.com`
- Fly app: `hoe-boop` (matches the repo's `hoe-<name>` convention)
- Port-registry row: claim the next-free row at build time per
  `docs/how-to/adding-an-app.md` — not pre-assigned here.

Chosen as a sound-word: kid-friendly, reads like a beat, fits the existing
plain-word-whimsy naming style (sprout, fridge, boids), no collisions. Bonus:
it can double as the runner character's name if the world layer lands.
