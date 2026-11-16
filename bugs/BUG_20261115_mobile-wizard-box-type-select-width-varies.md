# BUG_20261115_mobile-wizard-box-type-select-width-varies

**Status:** FIXED in T795

## Symptom
Visual screen `mobile-wizard-vented-step3` (New project wizard, step 3, phone, Dayton Audio CX120-8, Vented) is drawn two ways on an
unchanged tree: the "Box type" dropdown either starts just after its label (committed baseline) or is narrower and starts about
60 px further right. `bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts -g "visual mobile wizard-vented-step3$"`
passed 2 of 3 runs on 15 Nov 2026 (T794 worktree, main add89977); a full `scripts/visual/update.sh` run produced the narrow form.

## Cause
`PhoneClassicPage.vue` (and `PhoneDialogPage.vue`) bind `:style` to an object holding the design's default `--mob-col-label` (123 px).
Vue rewrites every key of that object on each render of the page. `createPhoneLabelColumn` sets the measured value (62 px for
"Box type") on the same element, but measures again only on childList, characterData and class mutations, so a render that
changed no child node (choosing a box type changes only the select's `value`) put 123 px back and nothing measured again.
Whether the measure ran before or after that render was a race of a few milliseconds. Probe timeline of a bad run: 29 ms
step 3 drawn, col 123 px; 40 ms measured, 62 px; 47 ms select value render, style attribute rewritten, col 123 px, no measure after.
The select then starts at 16 + 123 = 139 px instead of 16 + 62 = 78 px.

## Fix
`phoneLabelColumn.ts` also watches its root's `style` attribute and measures again when it changes, so the measured column
returns after any rewrite (all pages and popups that use it).

Test first: `packages/ui/test/ui/phone-wizard-label-column.browser.spec.ts` visits step 3 twenty times and changes the box type after
the page has settled; it failed 20 of 20 before the fix and passes after.

## Verification
`visual mobile wizard-vented-step3` passes `--repeat-each 20`; the full visual spec passes with no baseline changed;
`field-layout-rules.browser.spec.ts` passes; typecheck and lint are green.

## Follow-up (T798): one writer
Two writers set `--mob-col-label` on the page root: the style bindings (the design's default, rewritten on every render) and the measure.
Now `PhoneRowColumns.cssVarsWithoutLabelColumn()` is what PhoneClassicPage, PhoneDialogPage, the driver editor and MobileSheet bind, and
`createPhoneLabelColumn` is the only writer (it writes the default itself when no label qualifies). The style-attribute observer of T795
is gone. Test first: `packages/ui/test/ui/phone-label-column-one-writer.browser.spec.ts` records the root's column across box-type changes
(failed before with `123px, 62px, 123px, 62px, ...`, passes after). Step-3 sweep: 60 of 60 on this tree, also with 16 busy loops on 12 cores.
