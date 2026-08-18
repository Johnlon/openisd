# `sealed-fsc-winisd-golden.browser.spec.ts` locator matches two `Fsc` inputs, strict-mode failure

## Status
OPEN 2026-08-18 — found while verifying an unrelated change (local-alias computed removal);
confirmed pre-existing by re-running against the stashed-out (pre-change) versions of
`OriginalShell.vue`/`DiagnosticsModal.vue` — identical failure, so not caused by that change.

## Symptom

```
Error: locator.inputValue: Error: strict mode violation: locator('.field').filter({ hasText: 'Fsc' }).locator('input') resolved to 2 elements:
    1) <input readonly value="—" id="og-box-resonance" class="calculated greyed"/>
    2) <input readonly value="—" class="calculated greyed" id="og-sealed-enclosure-resonance"/>
```

`packages/ui/test/ui/sealed-fsc-winisd-golden.browser.spec.ts:74` — `page.locator('.field',
{ hasText: 'Fsc' }).locator('input')` — fails because the Box tab and the Tune panel's Advanced
pane both render a `.field` labelled "Fsc" (`#og-box-resonance` and
`#og-sealed-enclosure-resonance`), and Playwright's strict mode refuses to pick one.

## Cause

Not yet investigated — either the test's locator needs to scope to the Box tab specifically (a
test bug), or the app is rendering the same readout twice on one visible screen (an app bug).
Both `.field` elements read `value="—"` at the point of failure, suggesting the test may be
racing the readout before it populates, independent of the locator ambiguity.

## Fix

Not applied.

## Verification

Not yet — no fix applied.
