# armoury

Design your own wand. A wand lies in a velvet-lined box on a shop counter, in
front of shelves of boxed wands. Pick its wood and stain, measure its length on
an inch ruler, choose a handle, a carved shaft and a core, then tap it to lift it
out, turn it in 3D and cast a spell in the core's colour. Keep the ones you like on "Your shelf", or share a
link or a picture.

Stateless ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)):
everything a child makes lives in their browser or in the link they send.

| Mode | Command | Notes |
| --- | --- | --- |
| dev | `pnpm --filter armoury run dev` | http://localhost:3011 |
| tests | `pnpm --filter armoury run test` | Vitest, then Playwright CT on 3111 |
| production | `pnpm build && pnpm start` | static SPA + shallow `/health` |

Decisions: [ADR 0073](../../docs/adr/0073-armoury-wand-shop.md) (the app and
its look), [ADR 0074](../../docs/adr/0074-armoury-save-format.md) (saving),
[ADR 0075](../../docs/adr/0075-armoury-share-links-and-picture.md) (sharing),
[ADR 0076](../../docs/adr/0076-armoury-generator-tuning.md) (generator tuning).
Layout and rules: [`CLAUDE.md`](CLAUDE.md).

## Credits

- Wood scans and the studio HDRI: [Poly Haven](https://polyhaven.com), CC0.
- Fonts: IM Fell English by Igino Marini, Alegreya Sans by Huerta Tipográfica,
  both under the SIL Open Font License.
