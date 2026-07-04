# Fonts

Three families are used. Only one (Fredoka) is external; the other two are system fonts.

## 1. Fredoka — display face (letters, numbers, brand wordmark)
Chunky rounded sans that gives the plastic-magnet look. Google Fonts, SIL Open Font License (free to bundle & self-host).

Weights used: **500, 600, 700**.

**Option A — link (what the prototype uses):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet">
```

**Option B — self-host (recommended for production):**
1. Download the family from https://fonts.google.com/specimen/Fredoka (or `npm i @fontsource/fredoka`).
2. Drop the `.woff2` files next to this file in `fonts/` and add:
```css
@font-face{
  font-family:"Fredoka"; font-style:normal; font-weight:700;
  font-display:swap; src:url("./fredoka-700.woff2") format("woff2");
}
/* repeat for 500 & 600 */
```

CSS var: `--font-display: "Fredoka", system-ui, sans-serif;`

## 2. Georgia — word/poetry tiles
System serif; no download needed. Gives the classic typewritten magnetic-poetry feel.
Stack: `Georgia, "Times New Roman", serif`

## 3. system-ui — all UI chrome
Native OS UI font for toolbar, tray, buttons, chips.
Stack: `system-ui, -apple-system, sans-serif`

> Note: the actual Fredoka `.woff2` binaries are **not** bundled in this zip (they're redistributed under OFL from Google Fonts — grab them via the link above). Everything else needed to render the type is in `styles/tokens.css`.
