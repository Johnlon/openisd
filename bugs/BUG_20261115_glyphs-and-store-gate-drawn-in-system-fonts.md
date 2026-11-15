# BUG_20261115_glyphs-and-store-gate-drawn-in-system-fonts

**Status:** FIXED by T832

## Symptom

The app is meant to draw every character in its bundled fonts, never a device default (John, QO466, T742). Three
things were drawn by the machine's own font (DejaVu Sans on Linux; another face on Windows, macOS, Android):
the "■" swatch of the phone colour key (U+25A0, `MobileKeyStrip.vue`, `&#9632;`), the "♫" of the desktop
"What-if" button (U+266B, `OriginalShell.vue`, `&#9835;`), and every word of the store gate (`StoreGate.vue`:
the page mounts before the app sets the font variables, so `--font-ui` was undefined). John: "the fonts are 100pc baked
into the app why would they diff?"

## Steps to reproduce

1. Open the app on a project in the phone skin and ask Chrome which font drew the "■" (CDP `CSS.getPlatformFontsForNode`
   on `.mob-key-item.value-e`): DejaVu Sans, 1 glyph.
2. Same on the desktop `button.what-if-btn`: DejaVu Sans for the "♫".
3. Open the store-gate screen (`visual desktop dialog-shared-store-gate`): all of its text is DejaVu Sans.
4. Expected: every font reported is one of Selawik, Roboto, JetBrains Mono, AppSymbols.

## Why two tests did not see it

- `font-glyph-coverage.test.ts` read the source for literal characters above 127. Both glyphs were HTML entities
  (`&#9632;`, `&#9835;`), invisible to it. It now decodes entities and script/CSS escapes first.
- `app-font-bundled.browser.spec.ts` compares each element's computed `font-family` with the skin's stack. That
  says nothing about which font painted a character, nor does it see a page whose variable is undefined. It stays
  (it proves the declared stack and the loaded faces); the new `visual-fonts.browser.spec.ts` asks Chrome which
  platform font drew each text, on every visual screen in both skins.

## Fix (T832)

The key swatch is a CSS square in the item's colour, the What-if note an inline SVG (no bundled face has either
glyph, and no new font file was needed). `main.ts` sets the font variables before the gate or the app mounts, and the
gate declares `font-family: var(--font-ui)`. The elements next to the What-if button (Save, Revert) moved with its
width, which is why their pixels differed natively too.
