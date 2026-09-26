# Tune-panel independence test targets `#boxtype`, an id that is not in the app

Status: RESOLVED

## Symptom

`packages/ui/test/ui/tune-panel-independent-of-box-view.browser.spec.ts:26` —
"the Tune panel stays open when the box type changes underneath it" — times out at 60 s on
both the run and the retry. Server-clean (0 `ERR_CONNECTION_REFUSED`, empty console/page/
network capture).

```
Error: locator.selectOption: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#boxtype')
  38 |   await page.locator('#boxtype').selectOption('vented');
```

The panel itself opens (`await expect(page.locator('.tune-panel')).toBeVisible()` on line 34
passes). The sibling test `:45` ("stays open across project tab changes") passes.

## Cause

The box-type `<select>` is `id="og-box-type"` (`OriginalShell.vue:971`). There is no element
with `id="boxtype"` anywhere in `packages/ui/src`. The test string was never a real selector.

`#og-box-type` sits inside `<section v-show="activeTab === 'box'">` — `v-show`, so it is in the
DOM regardless of the active tab, and `selectOption` reaches it without a tab switch.

## Fix

`packages/ui/test/ui/tune-panel-independent-of-box-view.browser.spec.ts`: `#boxtype` →
`#og-box-type` (both call sites, lines 38 and 41). No app change — the QO134 hoist that renders
`<OgTune>` from `App.vue` is what this test verifies, and that code is in place.

## Verification

```
npx playwright test packages/ui/test/ui/tune-panel-independent-of-box-view.browser.spec.ts --workers=1
  :26  → PASS
  :45  → PASS
```
