# armoury

Design your own wand or sword. A street has two shops. In the wand shop a wand
lies in a velvet-lined box on a shop counter, in front of shelves of boxed wands:
pick its wood and stain, measure its length on an inch ruler, choose a handle, a
carved shaft and a core, then tap it to lift it out, turn it in 3D and cast a
spell in the core's colour. In the smithy a sword lies across an anvil by the
forge: pick a kind (Dagger to Greatsword, Sabre, Katana, Rapier), its steel, blade,
guard, grip and pommel, then tap it to lift it out, turn it and watch it shine.
Keep the ones you like on "Your shelf", or share a link or a picture.

Stateless ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)):
everything a child makes lives in their browser or in the link they send.

## Routes

| Path | Shows |
| --- | --- |
| `/` | Nothing: sends a page load to the shop a share link names, else the last shop, else the street |
| `/street` | The street: one painting, with a link traced over each open shop |
| `/wands` | The wand shop |
| `/swords` | The smithy |
| `/shelf` | Your shelf, a section for each kind |

## Running it

| Mode | Command | Notes |
| --- | --- | --- |
| dev | `pnpm --filter armoury run dev` | http://localhost:3011 |
| tests | `pnpm --filter armoury run test` | Vitest, then Playwright CT on 3111 |
| production | `pnpm build && pnpm start` | static SPA + shallow `/health` |

## The two generators

Both are pure and three.js-free, and turn a schema's params into a spec, then a
mesh the stage draws: `src/wand/` (radius field, groove sets, a lathe bent onto a
spine) and `src/sword/` (a section sweep, a blade thickness field on its feature
lines, parts that overlap). A sword's eight kinds are data rows in
`src/sword/families.ts`. The wand's rules and the sword's are in
[`CLAUDE.md`](CLAUDE.md); the words are in [`CONTEXT.md`](CONTEXT.md).

## Screenshots

`scripts/gpu-shots.mjs` photographs the real stages on the real GPU, for judging by
eye (the unit and `.iwft` suites use fake stages and never see a pixel):

```
node apps/armoury/scripts/gpu-shots.mjs <baseUrl> <outDir> <set.json> [names] [--picture] [--reduced-motion]
```

Start `pnpm --filter armoury run dev` first and pass its address. The set file is
`{ "<name>": { "kind": "wand" | "sword", "params": { ... } } }`; the script's header
lists the other flags. It needs a GPU-backed Chromium: never SwiftShader, and never
`playwright install`.

## Decisions

[ADR 0073](../../docs/adr/0073-armoury-wand-shop.md) (the wand shop and its look),
[ADR 0074](../../docs/adr/0074-armoury-save-format.md) (saving),
[ADR 0075](../../docs/adr/0075-armoury-share-links-and-picture.md) (sharing),
[ADR 0076](../../docs/adr/0076-armoury-generator-tuning.md) (generator tuning),
[ADR 0096](../../docs/adr/0096-armoury-item-kinds-saves-and-links.md) (item kinds),
[ADR 0097](../../docs/adr/0097-armoury-street-and-last-shop.md) (the street),
[ADR 0098](../../docs/adr/0098-armoury-sword-generator.md) (the sword generator),
[ADR 0099](../../docs/adr/0099-armoury-smithy-stage.md) (the sword's stage),
[ADR 0100](../../docs/adr/0100-armoury-sword-close-look-and-stage-rigs.md) (the sword's close look),
[ADR 0101](../../docs/adr/0101-armoury-smithy-scene-tag-and-picture.md) (the smithy's scene).
Layout and rules: [`CLAUDE.md`](CLAUDE.md).

## Credits

- Wood scans and the studio HDRI: [Poly Haven](https://polyhaven.com), CC0.
- The sword's scans, all CC0: brushed steel
  [Metal009](https://ambientcg.com/a/Metal009) (`steel-*`), cord
  [Rope001](https://ambientcg.com/a/Rope001) (`cord-*`) and woven braid
  [Fabric031](https://ambientcg.com/a/Fabric031) (`weave-*`) from
  [ambientCG](https://ambientcg.com); leather
  [fabric_leather_02](https://polyhaven.com/a/fabric_leather_02) (`leather-*`) from
  Poly Haven; the smithy's reflections,
  [castle_zavelstein_cellar](https://polyhaven.com/a/castle_zavelstein_cellar)
  (`hdri/smithy.hdr`), Poly Haven, CC0.
- Fonts: IM Fell English by Igino Marini, Alegreya Sans by Huerta Tipográfica,
  both under the SIL Open Font License.
