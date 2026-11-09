# apps/armoury - scoped rules

A design-your-own-wand toy at `armoury.homeofed.com`: a 3D wand lies in a box on
a shop counter, a child shapes it part by part, lifts it out to turn and wave
it, keeps it on "Your shelf" and shares it. The idea and the generator research live in
`~/Code/Playground/ideas/armoury` (the prototype this app grew from); the look
is direction D, "Wand shop" ([ADR 0073](../../docs/adr/0073-armoury-wand-shop.md)).
Domain vocabulary: [`CONTEXT.md`](CONTEXT.md).

**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)).
The wand on the counter and the shelf persist to `localStorage`
([ADR 0074](../../docs/adr/0074-armoury-save-format.md)); sharing is a URL
fragment plus a downloadable picture
([ADR 0075](../../docs/adr/0075-armoury-share-links-and-picture.md)).

## Layout

```
src/
  engine/schema.ts    item-agnostic params: schema, normalise, randomise (with
                      locked groups), seeded PRNG. Knows nothing about wands
  wand/               the generator, pure and three.js-free
    wandSchema.ts     the wand's params, ranges, kid-facing labels, coupling
    compile.ts        params -> WandSpec (profile + groove sets + stain)
    geometry.ts       WandSpec -> radius field -> closed mesh arrays
    presets.ts        hand-tuned starting wands; [0] is the first-visit wand
    describe.ts       name, shop number, tag line and lore - all derived
  workbench/          the wand on the counter: a pure reducer (set, try
                      another, put back, locks, rename, load) + the provider
                      that autosaves it and owns the shelf
  persistence/        save format (total decode) + the localStorage seam
  share/              fragment links, the share action, the picture card
  stage/              the three.js stages behind the seam (one lazy chunk)
    stage.ts          the seam: StageContext (Stages), StageHandle,
                      CloseUpHandle, BoxPose, framing constants
    WandStage.tsx     the box stage and the chunk's entry; re-exports
    CloseUpStage.tsx  the close look: the lifted wand, turned and waved
    scene.tsx         camera and lights both stages share
  shop/               the counter scene, header, tag, controls (panel/sheet)
  shelf/              "Your shelf"
  testing/            IwftApp (with fake stages), fixture, page objects
public/textures/      Poly Haven CC0 veneer scans as webp (colour + roughness)
public/hdri/          Poly Haven CC0 studio HDRI, downsampled to 512x256
public/thumbs/        handle-picker thumbnails rendered by the real stage, all
                      with the same end and ring so only the handle differs
public/fonts/         IM Fell English (+SC, italic) and Alegreya Sans, OFL
```

## Commands

- `pnpm --filter armoury run dev` - port **3011**.
- `pnpm --filter armoury run test` - Vitest then Playwright CT (port **3111**).
- Prod: `pnpm build` then `pnpm start` (port 8080). Compose host port **8091**.

## Rules

- **three.js stays behind the stage seam.** Only `stage/*.tsx` imports three or
  R3F, and the shop reaches the wand through `StageHandle` (roll, capture)
  and, in the close look, `CloseUpHandle` (cast, put back). `App` lazy-loads
  both stages from one chunk so the shop paints before the 3D arrives
  ([ADR 0077](../../docs/adr/0077-armoury-close-look.md)). `.iwft` swaps in fakes via the `stages` prop, so suites
  assert what the stage was asked to draw, never pixels. Generator facts
  (closed mesh, carving only removes wood, proportions) are unit tests on
  `wand/`, not iwft.
- **Every combination must look good.** New params get curated ranges in
  `wandSchema.ts`; handle styles and collars are data tables in `compile.ts`.
  Check a generator change by eye on a real GPU before calling it done - the
  tests prove the mesh is valid, not that it reads as carved wood.
- **Nothing persists or shares except through `persistence/saveFormat.ts`.** A
  stored wand is `{ params, name? }`; params always pass through `normalise`,
  so old and future saves still open. Share links reuse `decodeStoredWand`.
- **Names, numbers and tag lines are derived**, never stored, apart from a
  child's own rename. Change `describe.ts` freely; the shop number is a hash
  of the params, so it changes whenever the wand does.
- **No franchise vocabulary.** The cores, woods and lore are original; keep
  them that way (see the idea README's open questions).
- **Motion.** Everything that moves honours `prefers-reduced-motion`: no
  sparkles or burst, a shorter cast flash, no box arrival, and the close look
  appears and goes back without flying or idling.
- **Styles.** `styles/tokens.scss` is the one global sheet (tokens, fonts,
  reset); everything else is SCSS modules. Fonts are self-hosted.
