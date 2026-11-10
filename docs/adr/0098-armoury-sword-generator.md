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
  its band); Longsword and Greatsword grips scale with the blade and stay 0.2-0.3 of it;
  pommel diameter 0.8-1.2x the base width on one hand, 1.0-1.4x on two.
- **Guard size is placed inside the Kind's guard band, not as a multiple of the base width.**
  Research rule 3 (3.5-5.5x the base width, clamped to the band) fell outside the band for
  the Greatsword, the Rapier and the Short sword's dome, so the slider did nothing there, and
  it put default guards at the fantasy end (a 241 mm Knight's cross). Now `guardWidth`, nudged
  up to 0.1 either way by where the base width sits in its band, picks a point in the band.
  A bar guard keeps rule 3's floor of base width + 60 mm, and its range starts there, so the
  whole slider always moves it by at least 20 mm. A disc, dome or cup is never under 1.4x
  the base width (narrower reads as a collar), with at least 15 mm of range; the Short
  sword's dome band runs to 100 mm (research: 90). Default spans: Dagger 107, Short sword 137
  (dome 87), Knight's 210, Longsword 270, Greatsword 450, Sabre 150, Katana disc 80, Rapier 230
  (cup 100).
- The Dagger's guard band is 70-120 mm (research "4.3" says 70-140): research "2.2" wants a
  dagger's guard under 3x its blade width, about 102 mm at the default width.
- The Short sword's grip band starts at 90 mm (research: 85), a hand's width.
- Two additions to rule 5: a pommel is never narrower than 1.25-1.5x the grip's end, because
  on a Rapier (base 20-26 mm) the rule alone gives a pommel no wider than its grip; and a cap
  is not sized by rule 5 at all but sits nearly flush, 1.05-1.15x the grip's end.
- `families.ts` also gives `bladeLengthMm` and `overallLengthMm`, so a tag line can state a
  length without compiling a spec.
- **`lengthMm` and every z in the spec describe the sword before its curve:** pommel + grip +
  guard + blade along one straight axis. This differs from architecture "3.1", which makes
  `lengthMm` the straight pommel-to-tip distance after the bend; the code does not know the
  bend's shape, which the mesh owns. The mesh bends the blade in its plane with zero offset
  and slope at the shoulder, keeping its length along the curve (arc length); `curve.depthMm` is the sagitta, the largest distance from the
  bent centre line to the straight line from the shoulder to the bent tip, and `curve.peak`
  is the u where it falls. After the rotation that puts pommel and tip on the axis, the drawn
  pommel-to-tip distance is under 0.5% shorter than `lengthMm` on a Katana and up to about 5%
  on the deepest Sabre; framing reads `lengthMm`.

### Allowed lists, signature first

- `normalise` falls back to `allowed(p)[0]`, so each per-Kind list starts with that Kind's
  signature option (Katana: disc guard, diamond wrap, cap, angled tip; Rapier: swept guard).
  `signatureFor(family)` returns those first options plus the signature pattern (the
  Katana's temper line), for the item's `follows` to reset to when the Kind changes.
- Every other coupling rule is `allowed(p)` (a round tip only while `taper` <= 0.4; runes
  need a home; gems need a seat; temper needs a Katana in Satin or Mirror; no engraving with
  both runes and Ripples; a plain base under waves and on every Rapier) or `visible(p)` (curve
  on single-edged Kinds; wave count with waves; disc shape with a disc; any per-Kind picker
  only when the Kind offers it more than one option, so a Katana shows no one-pill pickers).
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
  without gems (so a hidden gem or rune colour never changes the spec). Fuller and wave positions are z in mm; their widths are fractions of the
  local blade width, so they follow the taper.
- Unspecified sizes are estimates, kept as tables in `families.ts` and `compile.ts`, and are
  tuned by eye at gate G1: guard bar sections and depths, grip radius and oval, pommel length
  per style, wrap pitch, riser count, tip runs, fuller depth, rune and engraving sizes.

### Names, tag lines and lore

- All derived in `sword/describe.ts`, nothing stored: research "8.1"-"8.3", with these
  changes. Satin steel with iron fittings is "Steel" (not "Grey": "Grey Warden" and "Grey
  Pilgrim" are borrowed), dark iron is "Dusk" (not "Iron": "Iron Giant"), and the Dagger's
  noun is "Wren" (not "Thorn": "Silverthorn"), matching the Little Wren preset.
- Gold fittings are "Gold", not "Golden" ("Golden Swallow" is a film title), and blue
  fittings are "blued" in words and never name a satin sword (the hilt is a dark navy).
- `DO_NOT_USE` is research "8.4" and "3.3" plus the near misses above and "Golden Rune",
  "Silver Flame", "Golden Crescent", "Silver Star", "Bronze Star" and "Gold Star". A name it
  would make falls back to the Kind's noun; a unit test covers every colour and noun pair.
- The tag line closes on a feel word chosen from what the sword is, so no word closes more
  than about 30% of any Kind: Mighty (long and broad), Sturdy (broad), Long in the reach
  (long), Quick in the hand or Well balanced (slim, one or two hands), Steady (a middling
  two-hander), Nimble and Handy (a short or longer Dagger), Light as a feather (a slim
  Rapier), Graceful and Swift (a deep curve or a slim curved blade). A Dagger, Sabre, Katana
  or slim blade is never "Mighty". A Katana's temper line is named in its tag line.
- `swordItem.follows` resets the per-Kind choices to the new Kind's signature only when the
  Kind actually changes.

## Consequences

- A sword's numbers come from one place per Kind; tuning a Kind is editing a row.
- The schema engine stays item-agnostic. The cost is that a slider's real size depends on the
  Kind, so the tag line, not the slider, states the length.
- Marks on the blade never cross a fuller: fullers start after the engraving, and runes
  "near the guard" sit in the fuller when there is one (reported as `where: 'fuller'`).
- The gem colours and the sRGB/linear helpers moved to `items/colour.ts`, shared by the wand
  and the sword; the wand's output is unchanged. Rune colours repeat the wand's core swatches.
