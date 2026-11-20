# apps/armoury - scoped rules

A design-your-own toy at `armoury.homeofed.com`, on a street with three shops: the
wand shop, the smithy and the potion shop. In each, a 3D item waits in its scene (a
wand in a box on a counter, a sword on an anvil, a bottle on a brewing table), a
child shapes it part by part, lifts it out to turn it and make it flourish, keeps it
on "Your shelf" and shares it. The idea and the generator research live in
`~/Code/Playground/ideas/armoury` (the prototype this app grew from); the wand
shop's look is direction D, "Wand shop"
([ADR 0073](../../docs/adr/0073-armoury-wand-shop.md)), the street and the smithy
are [ADR 0097](../../docs/adr/0097-armoury-street-and-last-shop.md) and
[ADR 0101](../../docs/adr/0101-armoury-smithy-scene-tag-and-picture.md), the potion
shop is [ADR 0108](../../docs/adr/0108-armoury-potion-shop-on-the-shell.md) and
[ADR 0113](../../docs/adr/0113-armoury-three-ingredients-that-mix.md).
Domain vocabulary: [`CONTEXT.md`](CONTEXT.md).

**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)).
Each kind's counter and shelf persist to its own `localStorage` document
([ADR 0074](../../docs/adr/0074-armoury-save-format.md),
[ADR 0096](../../docs/adr/0096-armoury-item-kinds-saves-and-links.md)), per player
([ADR 0094](../../docs/adr/0094-per-profile-local-saves.md)); sharing is a URL
fragment at `/shared` plus a downloadable picture
([ADR 0075](../../docs/adr/0075-armoury-share-links-and-picture.md)). The
server gates documents behind a family session when `FAMILY_ACCOUNT_URL` is
set, `/shared` excepted ([ADR 0093](../../docs/adr/0093-estate-gate.md)).

## Layout

```
src/
  engine/schema.ts    item-agnostic params: schema, normalise, randomise (with
                      locked groups), seeded PRNG. Knows nothing about wands
  items/              what every kind shares: ItemDef (item.ts), the registry
                      by kind, shopNumber, sRGB/linear colour helpers, a fake
                      ItemDef for generic tests
  landing.ts          SHOP_PATHS and landingPath: where the root redirects
  App.tsx             reads the family session and the arrival (the link's
                      item, the landing) once, before the router mounts
  router.tsx, views.tsx
                      / (redirect), /street, /wands, /swords, /potions, /shelf under
                      PlayerView (the player's profileStorage, reload on a
                      player change); /shared and every path under it is
                      SharedView (memoryStorage, the link's own shop, nothing
                      kept), since the gate leaves them all open
  wand/               the wand generator, pure and three.js-free
    wandSchema.ts     the wand's params, ranges, kid-facing labels, coupling
    compile.ts        params -> WandSpec (profile + groove sets + stain)
    geometry.ts       WandSpec -> radius field -> closed mesh arrays bent onto
                      the spine, gem and end poses
    gems.ts           where set gems go, in straight (angle, z) space, and
                      the shape of each cut's seat
    crystals.ts       the crystal tip's shapes, in the crystal's own frame
    stencils.ts       the engraving tiles, drawn as functions and
                      rasterised once
    presets.ts        hand-tuned starting wands; [0] is the first-visit wand
    describe.ts       name, shop number, tag line and lore - all derived
    item.ts           the wand's ItemDef
  sword/              the sword generator, pure and three.js-free
    swordSchema.ts    the sword's params, 0-1 sliders, kid words, coupling
    families.ts       one data row per Kind: bands in mm, allowed options,
                      fittings and steel tables
    compile.ts        params -> SwordSpec (outline, hilt parts, finish, marks)
    curve.ts, bend.ts monotone curves; the curved blade's centre line
    sweep.ts          the one mesh primitive: a closed section along stations
    blade.ts          the blade: a thickness field on feature-aligned columns
    hilt.ts           guard, grip, pommel, langets and gem settings
    geometry.ts       the whole sword: assembled, chord-turned, posed, reached
    outline.ts        the sword's silhouette as light polylines (main chunk)
    runes.ts          rune and engraving masks over the blade
    framing.ts        drawn size by overall length
    describe.ts       name, shop number, tag line and lore - all derived
    presets.ts        hand-tuned starting swords; [0] is the first-visit sword
    item.ts           the sword's ItemDef
  potion/             the potion generator, pure and three.js-free
    potionSchema.ts   the potion's params: three pour slots, the mixed flag,
                      the bottle and its finish, kid words, coupling
    ingredients.ts    one data row per ingredient, in wheel order
    pours.ts          pour helpers the item and the picker share
    wheel.ts, mix.ts  the mixing rule: three ingredients on a colour wheel add
                      up to one effect, or to murk
    mixColour.ts      the mixed colour, worked out in OKLCH
    mixBeats.ts       when a mix is revealed; the shell and the stage share it
    effects.ts        the six effects and murky: word, sentence, colours
    blends.ts         the secret blends
    bottles.ts        one data row per bottle shape
    compile.ts        params -> PotionSpec
    profile.ts        lathe profiles, the cavity's volume, upright levels
    outline.ts        the potion's silhouette for anything drawn in 2D
    framing.ts        drawn size, the base line, the picture's ground
    geometry.ts       PotionSpec -> closed mesh arrays in millimetres
    tipped.ts         each band's level when the bottle tips, volume kept
    traits.ts         what each trait draws in its band, and its motes
    describe.ts       name, shop number, tag line and lore - all derived
    doNotUse.ts       names a potion must never take
    presets.ts        hand-tuned starting potions; [0] is the first-visit potion
    item.ts           the potion's ItemDef
  workbench/          the item on the counter, one bench per kind: a pure
                      reducer (set, try another, put back, locks, rename, load)
                      + the provider that autosaves it to the storage it is
                      given, owns the shelf and the last shop
  persistence/        save format (total decode), the storage seam, the last
                      shop, and profileKeys (each kind's save document is a
                      player's; the last shop is the device's)
  share/              fragment links, keep-from-/shared, the share action, the
                      shared picture frame and each shop's painter (wandCard,
                      smithyCard, apothecaryCard)
  stage/              the three.js stages behind the seam; two lazy entries
    stage.ts          the seam: StageContext (StagesByKind), StageHandle,
                      CloseUpHandle, BoxPose, framing constants
    scene.tsx         camera and lights the wand's stages share
    boxRig.tsx        what every box stage shares: framing, roll, capture
    HeldRig.tsx       what every close look shares: the lift, the hold, the turn
    hold.ts           how an item is held: level, or upright, where it leans
                      and tips under a finger and rights itself
    WandStage.tsx     the wand's box stage and its chunk entry; re-exports
    CloseUpStage.tsx  the wand's close look: the lifted wand, waved
    wave.ts           the figure-of-8 wave: a pure function of time, fitted
                      to the screen (the sword's flourish reuses it, slowed)
    woodFinish.ts, metals.ts   the wand's materials, which the sword reuses
    SwordStage.tsx    the sword's box stage and its chunk entry; re-exports
    SwordCloseUpStage.tsx  the sword's close look
    SwordMesh.tsx     the sword's three.js meshes from its generated parts
    swordMaterials.ts steel, fittings and grips: one program for every sword
    swordGlow.ts      the glint and rune glow, bounded in time and brightness
    smithyScene.tsx   the smithy's lights, environment, tone mapping, framing
    PotionStage.tsx   the potion's box stage and its chunk entry; re-exports
    PotionCloseUpStage.tsx  the potion's close look: the held bottle, its show
    PotionMesh.tsx    the bottle's three.js meshes from its generated parts
    potionMaterials.ts  fake glass, the layered and the mixed liquid, the
                      stoppers, the label's paper and ink
    potionScene.tsx   the potion's lights, environment, tone mapping, framing
    LiquidMotes.tsx   the specks, bubbles and glitter inside the liquid
    slosh.ts          the held liquid's surface, a damped pendulum
    potionShow.ts     the show's one clock: lift, swirl, pop, effect, return
    effectKinds.ts, EffectShow.tsx   what comes out of the neck: the six effects
                      and murky as bounded particle programs, and the sprites
                      that draw them
    FlourishProbe.tsx, PotionPoseProbe.tsx   dev-only, for the shots script
  shop/               one shell for every shop: ShopPage, header, tag, controls
                      (panel/sheet), and the ShopView each shop supplies
  smithy/             the smithy's ShopView (smithy.ts), the forge and anvil
                      art, the sword's shadow and outline, its group summaries
                      and widgets
  apothecary/         the potion shop's ShopView (apothecary.ts), the brewing
                      table and the room behind it, the recipe card, the
                      bottle's footing and outline, the pour picker, its group
                      summaries and widgets
  street/             the shops traced on lit and dark paintings (public/street/)
  shelf/              "Your shelf", a section per kind
  testing/            IwftApp (with fake stages), fixture, page objects
scripts/gpu-shots.mjs real-GPU screenshots of the real stages
scripts/ingredient-pictures.ts   cuts a three by three sheet of ingredient art
                      into public/ingredients/
scripts/ingredient-placeholder-sheet.mjs   draws a test sheet to that layout
public/ingredients/   the nine painted ingredient pictures on the picker's jars
art/ingredients/      the sheet those nine were cut from, its prompt and reference
                      pictures; source art, never served
public/textures/      Poly Haven and ambientCG CC0 scans as webp: wood veneers
                      (wand); steel, leather, cord, weave (sword)
public/hdri/          CC0 maps: studio (wand), smithy (sword), downsampled
public/thumbs/        handle-picker thumbnails rendered by the real stage, all
                      with the same end and ring so only the handle differs
public/fonts/         IM Fell English (+SC, italic) and Alegreya Sans, OFL
```

## Commands

- `pnpm --filter armoury run dev` - port **3011**.
- `pnpm --filter armoury run test` - Vitest then Playwright CT (port **3111**).
- Prod: `pnpm build` then `pnpm start` (port 8080). Compose host port **8091**.
- Real-GPU shots of the real stages, for judging by eye:
  `node apps/armoury/scripts/gpu-shots.mjs <baseUrl> <outDir> <set.json> [names] [--picture] [--reduced-motion]`
  against `pnpm dev` (the file's header lists the other flags). Real GPU only:
  headless ANGLE Metal, never SwiftShader and never `playwright install`.
- `pnpm --filter armoury run ingredients:cut <sheet>` cuts a sheet of ingredient
  art into `public/ingredients/*.webp` (needs `cwebp`);
  `ingredients:placeholders <out.png>` draws a test sheet to the same layout
  ([ADR 0112](../../docs/adr/0112-armoury-ingredient-pictures.md)).

## Adding a shop

Five more shop fronts are already painted and traced in `street/shops.ts` (bows,
staffs, brooms, robes, pets); a shop opens when its entry gets a `to`. The smithy
and the potion shop are the worked examples.

- **What a shop adds:** its kind in `ItemKind` and `items/registry.ts`, a pure
  generator folder ending in `item.ts`, a path in `landing.ts` and `router.tsx`,
  a `ShopView` folder (like `smithy/`), stages on `boxRig` and `HeldRig` behind
  their own lazy entry, its picture painter in `share/`, and its kind in
  `scripts/gpu-shots.mjs`.
- **What the shared parts already offer:** on `ShopView`,
  `closeUp.flourishOnArrival`, `closeUp.reveal` (a change the item makes to itself
  a set time into each flourish, or at once if the close look closes first) and
  `offersPutBack: false` (hides "Put the last one back"); on the rigs,
  `hold: 'upright'` and `boxView: 'front'` for an item that stands
  ([ADR 0105](../../docs/adr/0105-armoury-upright-items-on-the-stage-rigs.md));
  for pictures on a picker, the sheet cutter
  ([ADR 0112](../../docs/adr/0112-armoury-ingredient-pictures.md)).
- **Behind the estate gate:** add the kind's save key to `PROFILE_KEYS`
  (`persistence/profileKeys.ts`) and its `ShopView` to `SharedView`'s `SHOPS`
  (`views.tsx`), and put its route under `PlayerView`. Share links and Keep
  follow `SHOP_PATHS` with nothing more.
- **Ask the owner first,** in rounds, and record each answer in the epic's
  `decisions.md`: what the child does to the item and what its flourish or
  reveal is; the parts and the options of each; whether it lies level or stands;
  the scene it waits in; the shop's name; which pictures the owner will paint;
  what is out of scope; and what to do with an option that fails its gate twice
  (cut it, or park it).
- **Build order:** the generator first, judged in plain grey (`--clay`) before
  any material; then materials and light; then the scene art; the close look
  last.
- **Settle the look on one item first:** take one hero item through materials
  and light and have the owner pick from one contact sheet, before cutting
  tickets for the options. Without that, the smithy's steel took five gate
  rounds and its close look four.
- **Painted art comes from the owner.** Write the prompt and a placeholder to
  the same layout (`art/ingredients/` is the pattern); never generate or derive
  a picture.
- **Tickets:** each ends at one gate and fits about 80 tool calls. The wiring
  (kind, registry, routes, save key, share field, shelf section, street door) is
  mechanical and proved by tests; only form, materials, the scene and the close
  look are judged by eye, and those are the tickets to keep small.
- **Gates:** form, materials, the close look and the whole shop each pass a
  real-GPU gate, judged from shots beside the wand and the sword by someone
  other than the builder. One gate per ticket, one review per gate: its fix
  round goes to a fresh builder and is checked against the reviewer's acceptance
  list, not reviewed again. The whole-shop gate also looks once in WebKit
  (`--browser=webkit`): the potion's effect lights vanished there and passed
  every Chromium gate.

## Rules

### Every shop

- **three.js stays behind the stage seam.** Only `stage/*.tsx` imports three or
  R3F, and the shop reaches the item through `StageHandle` (roll, capture) and,
  in the close look, `CloseUpHandle` (`flourish`, put back). `App` lazy-loads
  each kind's stages from its own entry, so a shop paints before its 3D arrives
  and a wand-only visit downloads no sword or potion code, texture or map
  ([ADR 0077](../../docs/adr/0077-armoury-close-look.md),
  [ADR 0099](../../docs/adr/0099-armoury-smithy-stage.md)). `.iwft` swaps in
  fakes via the `stages` prop, so suites assert what the stage was asked to
  draw, never pixels. Generator facts (closed mesh, the surface stays within its
  envelope, proportions) are unit tests on `wand/`, `sword/` and `potion/`, not
  iwft.
- **A shop plugs in through `ItemDef` and `ShopView`.** Everything generic
  (workbench, save and share codecs, shelf, shell) takes an `ItemDef` or a
  `ShopView` and imports none of `wand/`, `sword/` and `potion/`. A new kind is
  a new `ItemDef`, storage key, share field name, path and door on the street.
- **Shader uniforms that change go through the material, not R3F props.** R3F
  copies `<shaderMaterial uniforms>` on mount, so later writes never reach the
  GPU. Build the material once (`stage/glow.ts`) and write its uniforms.
- **Nothing persists or shares except through `persistence/saveFormat.ts` and
  `share/shareLink.ts`.** One save document per kind: `armoury:save` (wands,
  unchanged since ADR 0074), `armoury:save:sword`, `armoury:save:potion`, and
  `armoury:shop` for the last shop. An item is `StoredItem` `{ params, name? }`; params always pass
  through `normalise`, so old and future saves still open. A link names its kind
  by its payload field (`wand`, `sword` or `potion`), is built at `/shared` and decoded by
  `decodeStored`. Never bump `SAVE_FORMAT_VERSION` for a new kind: a stale tab
  reads an unknown version as empty and wipes the shelf.
- **Saves go through the storage the route hands the workbench**, never
  `window.localStorage` directly: `profileStorage` under PlayerView,
  `memoryStorage` on `/shared`, which must write nothing. Never build
  `profileStorage` on `/shared` (building it adopts the legacy documents, a
  write), and never call `reloadOnPlayerChange` there (a reload loses the
  visitor's edits). `/shared` links to nothing gated in-app: "Keep this" and
  the street are page loads, so the gate sees them. Hub links are `hubUrlFor`
  and `switchPlayerUrlFor` from `@hoe/accounts`, never a port literal.
- **The player chip** (`Player`, `shop/Header.tsx`) shows in every shop's header
  and on the street, only with a session. Signed out, nothing in the header
  moves. With a chip the shop header gives way in measured steps (the motto,
  then the chip's name, then every label); a header change re-measures them
  with a 22-character name (the width tests in `profiles.iwft.tsx`).
- **The root redirect reads only `Landing`**, worked out once in `App` from
  `arrivalFragment()` and the last shop before the router runs; nothing else
  writes the address during a redirect
  ([ADR 0097](../../docs/adr/0097-armoury-street-and-last-shop.md)). Read a
  share fragment through `arrivalFragment()`, never `location.hash`: the router
  decodes the address bar on mount and the redirect drops it.
- **Names, numbers and tag lines are derived**, never stored, apart from a
  child's own rename. Change `describe.ts` freely; the shop number is a hash
  of the params, so it changes whenever the item does.
- **No franchise vocabulary.** Cores, woods, steels, names and lore are original;
  sword names are checked against a `DO_NOT_USE` list (see the idea README's
  open questions).
- **Motion.** Everything that moves honours `prefers-reduced-motion`: no
  sparkles, burst, wave, flourish, glint, forge or candle flicker, box arrival,
  slosh or drifting in the liquid, and the close look appears and goes back
  without flying or idling. A potion's mix is a cross-fade and its effect a still
  arrangement that fades in and out.
- **Styles.** `styles/tokens.scss` is the one global sheet (tokens, fonts,
  reset, and the later shops' overrides under `[data-shop='smithy']` and
  `[data-shop='apothecary']`); everything
  else is SCSS modules. Fonts are self-hosted.
- **Check a generator or material change by eye on a real GPU** before calling
  it done: the tests prove the mesh is valid, not that it reads as carved wood,
  forged steel or glass with liquid in it.

### The wand

- **Every combination must look good.** New params get curated ranges in
  `wandSchema.ts`; handle styles and collars are data tables in `compile.ts`.
- The wand's canvas has no tone mapping; the sword's settings never reach it.

### The sword

- **The generator is pure and three-free:** schema -> `compileSword` ->
  `SwordSpec` -> mesh. `compile.ts`, `outline.ts` and the light modules they use
  may ship in the main chunk (the shelf, thumbnails and the anvil's shadow draw
  from `swordOutline`); `sweep`, `blade`, `hilt`, `geometry` and `runes` may not.
  Only `stage/` builds meshes.
- **A Kind is a data row in `families.ts`.** Sliders are 0-1, mapped into the
  Kind's band, so no slider leaves its Kind. Every `allowed` list starts with the
  Kind's signature option, which `normalise` falls back to. A hidden param never
  changes the spec.
- **Lengths are measured before the curve, and the bend keeps arc length.** The
  chord turn then puts pommel and tip on the axis; framing, hit boxes and the
  picture read the drawn extents (`reach`, `tipPose`), not `lengthMm`.
- **The blade's normals are exact and are turned with its positions, never
  recomputed.** Every hard edge is a filleted corner of at least 0.3 mm.
- **Runes and engraving are masks, not geometry.**
- **Vertex budgets are asserted** (blade 45k, fittings 35k, grip 45k, total
  120k), on vertex counts.
- **No wall-clock assertions, and the sword unit suite stays fast.** Test a
  chosen catalogue of swords (each Kind's options cycled, slider extremes, its
  heaviest, a few random), built once each; never hundreds of random swords.
- **Every new option passes a real-GPU gate** judged by someone other than the
  builder, or it is cut: delete it from `swordSchema.ts` and `families.ts`, fix
  any preset that used it, and record the cut in the ADR that owns it.
- **Tone mapping and the smithy environment are for the sword canvas only**
  (`smithyScene.tsx`); nothing at rest exceeds the bloom cap, so nothing blooms.
  The glint and rune wake are the bounded exception in the close look
  ([ADR 0100](../../docs/adr/0100-armoury-sword-close-look-and-stage-rigs.md)).
- **The smithy's frame is fixed:** sword centred in its slot along its
  pommel-to-tip line, pommel left, the forge from the low left and the window
  from the high right. The anvil never scales and the drawn shadow follows
  `swordOutline`; change the stage's light or pose and the art with it.

### The potion

- **The generator is pure and three-free:** schema -> `compilePotion` ->
  `PotionSpec` -> profile -> mesh. The main chunk may import `compile.ts`,
  `mix.ts`, `mixBeats.ts`, `profile.ts`, `outline.ts`, `framing.ts` and the data
  tables (the shelf, the scene's shadow and the picture draw from
  `potionOutline`); never `geometry.ts` or `tipped.ts`. Only `stage/` builds
  meshes.
- **A bottle shape is a data row in `bottles.ts`,** turned on a lathe from radius
  points, foot to neck. Each ingredient fills a third of the cavity's volume,
  upright or tipped
  ([ADR 0107](../../docs/adr/0107-armoury-bottle-generator.md)).
- **Ingredient ids are permanent:** they are in saves and links. Labels, words,
  colours, traits and lore may change. The rows stay in wheel order, which is the
  picker's order and the mixing rule's.
- **Three ingredients and a `mixed` flag.** `pour1` to `pour3` fill from the
  bottom with no gaps, and one ingredient may go in more than once. "Empty the
  bottle" is the only way to take anything out, and it unmixes. Only the close
  look's reveal sets `mixed`, and only on a full bottle; Try another always pours
  three and never mixes.
- **The wheel rule decides what a mix does** (`mix.ts`): the three ingredients'
  places on the colour wheel add up to one of six effects, or cancel out into
  murk. Order never changes the result. The odds over all 165 recipes are pinned
  by a test (24 for each effect, 21 murky): a change to the wheel, the sectors or
  `MURK_REACH` must keep those counts
  ([ADR 0113](../../docs/adr/0113-armoury-three-ingredients-that-mix.md)).
- **Murk is an outcome, never an ingredient.** A murky mix has no effect but one
  lazy bubble, its own names and the `murk` trait, which no ingredient has.
- **The mixed colour is designed, never an average:** a hue from the wheel pulled
  into a jewel range, or a designed mud (`mixColour.ts`). Tests pin the bounds,
  not hex values.
- **Names never mention drinking,** and every reachable name is swept against
  `doNotUse.ts`.
- **The show is one pure clock** (`stage/potionShow.ts`): lift, swirl, pop,
  effect, return. The shell's reveal and the stage's pop share
  `MIX_REVEAL_SECONDS`. Nothing in a shader may be a growing clock times a thing
  that changes (a span, the sloshed up): it jumps when that thing moves.
- **Budgets are asserted:** vertices (glass 20k, liquid 10k, stopper and label
  8k, total 40k), 300 motes in the liquid, and an effect of at most 300 points
  and six smoke sprites, inside a box that stays on screen, gone when the show
  ends.
- **ACES tone mapping and the candle's environment are for the potion canvas
  only** (`potionScene.tsx`), with no post pass: nothing at rest exceeds
  `REST_CAP`, and the effect's sprites are capped, not bloomed
  ([ADR 0109](../../docs/adr/0109-armoury-potion-look.md),
  [ADR 0111](../../docs/adr/0111-armoury-potion-close-look.md)).
- **The glass is faked:** two passes either side of the liquid, no
  `transmission`. Two WebGL contexts already run in the close look.
- **The scene's frame is fixed:** the bottle stands on the table's line, the
  candle on the left and a cool rim from the right; change the stage's light and
  the room art with it
  ([ADR 0110](../../docs/adr/0110-armoury-potion-shop-scene-card-and-picture.md)).
