# Phone scroll gesture increments a number spinner

## Symptom

John reports that while scrolling on a touch screen, a spinner can act as though it was tapped. A
vertical drag must scroll without changing a value. The edit-row case was checked separately and
already scrolls without opening the editor in the phone browser.

Concrete controls:

- `/home/john/work/winisd/openisd/packages/ui/src/ui/components/NumInput.vue` bound each stepper
  button's `pointerdown` directly to `startRepeat()`.
- `/home/john/work/winisd/openisd/packages/ui/src/ui/shells/mobile/MobileDriverTab.vue` binds
  `click` on each read-only key figure (Fs, Qts, Vas, Re, Xmax) to `editDriver()`. A browser test
  confirms that a vertical touch drag scrolls this row without synthesizing a click.

## Cause

`startRepeat()` immediately called `stepFrom()` on touch pointer-down, before the browser could
classify the gesture as a vertical scroll. The scroll then moved the page, but the first spinner
step had already happened. The edit row does not share this failure: the browser cancels its click
when the touch becomes a scroll.

## Fix

For touch, defer a spinner step until release and cancel the pending action once the pointer moves
past the drag threshold. A stationary tap still steps once, and a stationary held spinner still
steps and repeats after the hold delay. Mouse spinner behavior remains immediate.

## Verification

Verified with
`~/.claude/bin/heavy.sh bash scripts/test.sh packages/ui/test/ui/number-box-drag-spin.browser.spec.ts packages/ui/test/ui/mobile-num-stepper-focus.browser.spec.ts packages/ui/test/ui/mobile-driver-tab.browser.spec.ts`:
22 passed. This covers vertical spinner scroll without a value change, spinner tap, held repeat,
key-figure tap to edit, and key-figure drag to scroll without opening the editor.

## Closed

Fixed in the touch stepper handling in `packages/ui/src/ui/components/NumInput.vue`. Targeted ESLint and `npm run typecheck:ui` pass. The full `npm run lint` command still reports errors in generated files under `packages/ui/build/gallery-dist-main/`; those generated files are outside this change. The browser suite above passes 22/22.
