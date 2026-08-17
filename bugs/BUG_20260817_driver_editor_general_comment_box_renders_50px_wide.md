# BUG — the General tab's Comment box renders 50px wide in a 740px panel

## Symptom

On the driver editor's General tab the Comment field is a tall narrow slot: a column of text
about four characters wide, with the whole right-hand half of the panel empty beside it, and
dead space under it down to the bottom of the dialog.

Measured in the running app (`packages/ui/test/ui/driver-editor-layout.browser.spec.ts`):

| measurement | value |
|---|---|
| panel content width | 740px |
| comment textarea | **50 × 220px** |
| space left under the last row | 255px |
| gap below the box | 35px |

## Cause

Two declarations of equal specificity, and the loser is the one that was meant to win.

```css
.de-comment { width: 100% !important; flex: 1 1 auto !important; }   /* line ~997 */
...
.de-fld     { width: fit-content !important; display: grid !important; }  /* line ~1058 */
```

`.de-comment` and `.de-fld` are both one class — same specificity, both `!important`, so the
CASCADE ORDER decides, and `.de-fld` is declared ~60 lines later. The comment field is a
`.de-fld`, so it takes `width: fit-content`, and fit-content on a `<textarea>` wrapper collapses
to the intrinsic width of a grid item with a 50px content box.

The height is the same story from the other end: `height: 100%` on the textarea resolves against
a parent whose own height is only its content, so the box stops at its `min-height: 220px` and
leaves the remaining 35px of panel empty.

## Fix

Make the comment field's own rule outrank the generic one — `.de-general .de-fld.de-comment` —
and give it `width: 100%` plus `flex: 1 1 auto` in a `.de-general` column that actually has a
height to share out. The Comment box is the tab's filler: it takes the leftover width AND the
leftover height, because it is the only field on the tab with no natural size.

## Verification

`packages/ui/test/ui/driver-editor-layout.browser.spec.ts`,
`General: the Comment box fills the bottom of the panel` — four measurements in a real browser:
the box spans the panel's content width, its bottom reaches the panel's bottom, it is wider than
it is tall, and the tab does not scroll in either axis.
