# BUG_20261019_phone-advanced-winisd-style-heading-cut-short

**Status:** OPEN

Recorded 19 Oct 2026. Seen on prod, Advanced tab, phone 374x705 CSS px (John's Pixel 9).

## Symptom
The group heading reads "Enable WinISD-style ..." and looks cut short with an ellipsis, so the user
cannot read what the group is. The heading is a small plain line, not the grey band the other group
headings are.

## Evidence
- Screenshot: [prod-advanced-compat.png](http://lap:8000/winisd/ui-gallery/screens/prod-advanced-compat.png).
- `packages/design/fields/compatSwitchGroup.ts` line 13: the heading text itself ends in "…"
  (`'Enable WinISD-style …'`). So the ellipsis is not a CSS truncation; the title is unfinished
  text. The tooltip (line 14) repeats it.
- Heading drawn by `packages/ui/src/ui/components/ErrorSwitchGroup.vue` line 13
  (`.error-switch-group-head` beside `CompatGroupHelpLink.vue`).
- Not yet checked: whether the CSS also clips it at narrower widths.

## Cause
The design title string carries a trailing "…" that reads as truncation; the phone layout gives it
no band that would show it as a complete heading.

## Fix
Heading says a complete thing in plain short English (wording is John's call; the `compatSwitchGroup.ts`
string and tooltip change together). Phone layout: group headings as grey bands, as in the classic
phone mock, QO268 Advanced,
[box-combined-live.html?ov=advanced](http://lap:8000/winisd/ui-gallery/QO267/box-combined-live.html?ov=advanced).

## Verification
Phone 374x705: the heading shows in full with no "…", as a grey band like the other groups. Before/after
screenshots. Check any test that asserts the old heading text.
