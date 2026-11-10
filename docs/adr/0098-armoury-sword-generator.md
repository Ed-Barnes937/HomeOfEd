# 0098 - armoury sword generator: Kinds, sliders in bands, the section sweep, the outline

- **Status:** Accepted (first half: params and compile; ticket 06 adds the geometry)
- **Date:** 2026-11-10
- **Related:** [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (item kinds),
  [ADR 0084](0084-armoury-branch-wands.md) (a Kind kept by Try another),
  [ADR 0083](0083-armoury-glowing-gems.md) and [ADR 0087](0087-armoury-crystal-colours-and-shapes.md)
  (one glow colour, the wand's gem colours), [ADR 0085](0085-armoury-carved-pattern-stencils.md)
  (the stencil tiles the engraving reuses).

## Context

The smithy needs a sword generator as good as the wand's: every combination a child can
reach must look like a real sword. Swords differ far more than wands do. A dagger blade is
22 cm and a greatsword's is 130 cm; a katana has a disc guard and a diamond wrap that no
knight's sword has. The schema engine (`engine/schema.ts`) is shared with the wand and stays
unchanged: a `NumberParam` has one static range, and a `ChoiceParam` narrows its options with
`allowed(p)`, falling back to the first allowed option.

## Decision

### A Kind of sword, kept by Try another

- `family` is a choice alone in group `kind` ("Kind of sword"): Dagger, Short sword, Knight's
  sword (default), Longsword, Greatsword, Sabre, Katana, Rapier. Try another locks the group,
  as the wand's Branch kind does (ADR 0084), so it reshapes the sword without changing what
  it is.
- A Kind is a data row in `sword/families.ts`: edges, hands, bands in mm, the tip-width ratio,
  the curve's peak, and the allowed options for `profile`, `middle`, `tip`, `ricasso`,
  `guard`, `wrap` and `pommel`. A family becomes a Kind only when it changes the hilt's parts
  or the edge count; scimitar, flamberge, leaf blade and Viking looks are options and presets.

### 0-1 sliders mapped inside per-Kind bands

- Because a `NumberParam` range is static, every size is a 0-1 slider with kid words at its
  ends (Short/Long, Slim/Broad, Snug/Roomy). `compileSword` maps it into the Kind's band from
  research "4.3" (cm there, mm here), so a slider never takes a sword outside its Kind.
- Coupling lives in the compiler, not the schema: width gains up to 10% with length (kept in
  its band); Longsword and Greatsword grips scale with the blade and stay 0.2-0.3 of it; cross
  spans are 3.5-5.5x the base width, clamped to the band and never under base width + 60 mm;
  disc, dome and cup diameters 2.2-2.8x; pommel diameter 0.8-1.2x the base width on one hand,
  1.0-1.4x on two.
- One addition to rule 5: a pommel is never narrower than 1.25-1.5x the grip's diameter. On a
  Rapier (base 20-26 mm) the rule alone gives a pommel no wider than its grip, which reads as
  missing.
- `families.ts` also gives `bladeLengthMm` and `overallLengthMm`, so a tag line can state a
  length without compiling a spec. `lengthMm` is pommel + grip + guard + blade along the
  axis, before any curve.

### Allowed lists, signature first

- `normalise` falls back to `allowed(p)[0]`, so each per-Kind list starts with that Kind's
  signature option (Katana: disc guard, diamond wrap, cap, angled tip; Rapier: swept guard).
  `signatureFor(family)` returns those first options plus the signature pattern (the
  Katana's temper line), for the item's `follows` to reset to when the Kind changes.
- Every other coupling rule is `allowed(p)` (a round tip only while `taper` <= 0.4; runes
  need a home; gems need a seat; temper needs a Katana in Satin or Mirror; no engraving with
  both runes and Ripples; a plain base under waves and on every Rapier) or `visible(p)` (curve
  on single-edged Kinds; wave count with waves; disc shape with a disc).
- A hidden param never changes the spec. A unit test perturbs every hidden param of a wide
  sample of swords and checks the compiled spec is unchanged.

### Tiers A and B, and how an option is cut

- Tier A ships; its gate repeats until it passes. Tier B ships only if it passes its gate
  within two fix rounds. To cut a B option, delete it from `swordSchema.ts` (and from the
  Kind rows in `families.ts`), fix any preset that used it, re-run `vitest run src/sword`,
  and record the cut for Ed. A choice left with one option becomes a constant in
  `compile.ts`. A cut signature (marked B) hands the signature to the next entry.

### Left out of the research's param list

- `temperStyle` (one wavy temper line in v1), `backEdge` (derived: a flared Sabre always has
  a sharpened back from 0.7 of the blade), `hooks`, `tassel`, gems on the blade base,
  engraving on the guard, forked or hooked tips, side rings, a rain guard, sculpted pommels
  and a crystal pommel. Each adds a part or a rule for a rarely chosen look; the grounded
  range reads without them. Kinds beyond the eight (falchion, jian, dao, messer, tanto, kris,
  khopesh) are out for the same reason, and the kris for its cultural weight.

### The spec

- `SwordSpec` is architecture "3.3" with: sections `lenticular | diamond | wedge` only (the
  picker reaches no other); `ridgeAt` (the Katana's ridge line) and `backBevelFrom`;
  `tipFrom` (where the tip's closing run starts, the Katana's point line); guard `ends`,
  `discShape` and `langets`; grip wraps `leather | cord | wire | wood | ribbed | diamond`;
  finish `pattern` and `wear`; an `engraving` band from the wand's stencil tiles; runes that
  carry their own colour and glyph count; and `glow` as the gems' light and stone, null
  without gems. Fuller and wave positions are z in mm; their widths are fractions of the
  local blade width, so they follow the taper.
- Unspecified sizes are estimates, kept as tables in `families.ts` and `compile.ts`, and are
  tuned by eye at gate G1: guard bar sections and depths, grip radius and oval, pommel length
  per style, wrap pitch, riser count, tip runs, fuller depth, rune and engraving sizes.

### Names, tag lines and lore

- All derived in `sword/describe.ts`, nothing stored: research "8.1"-"8.3", with these
  changes. Satin steel with iron fittings is "Steel" (not "Grey": "Grey Warden" and "Grey
  Pilgrim" are borrowed), dark iron is "Dusk" (not "Iron": "Iron Giant"), and the Dagger's
  noun is "Wren" (not "Thorn": "Silverthorn"), matching the Little Wren preset.
- `DO_NOT_USE` is research "8.4" and "3.3" plus the near misses above and "Golden Rune",
  "Silver Flame", "Golden Crescent", "Silver Star" and "Bronze Star". A name it would make
  falls back to the Kind's noun; a unit test covers every colour and noun pair.
- Feel words add "Well balanced" for a slim two-hander, where "Quick in the hand" read oddly
  on a five-foot sword; a Dagger is never "Mighty".
- `swordItem.follows` resets the per-Kind choices to the new Kind's signature only when the
  Kind actually changes.

## Consequences

- A sword's numbers come from one place per Kind; tuning a Kind is editing a row.
- The schema engine stays item-agnostic. The cost is that a slider's real size depends on the
  Kind, so the tag line, not the slider, states the length.
- Research "2.2" calls for a dagger's guard under 3x its blade width, while rule 3 gives
  3.5-5.5x clamped to a 7-14 cm band; rule 3 and the band won. G1 may narrow the band.
- The rune and gem colours repeat the wand's values (`GEM_COLOURS`, the core swatches) rather
  than import them, because the wand's tables are private to `wand/compile.ts`.
