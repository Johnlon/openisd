---
id: 20260917-original-skin-stale-selectors
title: original-skin.browser.spec.ts stale selectors — titlebar chip and 7-tab count
status: fixed
tags: [ui-test, original-skin, test-side, stale-selector]
---

## What the bug is

Two tests in `packages/ui/test/ui/original-skin.browser.spec.ts` wait on markup the
app no longer ships, so they fail after every default 6s `expect` timeout with
**zero** console/page/network errors (empty diagnostics — the app is fine).

## Facts (verified, not assumed)

1. "the titlebar displays the build datetime"
   - Test waited on `.titlebar .tb-center`, which does not exist in the app.
   - The real widget is `.version-chip` (OriginalShell.vue:108), populated by
     `fetchVersion()` (OriginalShell-hooks.ts:435-444) from `build-info.json`,
     which `scripts/version-info.mjs` stamps with an ISO timestamp: the chip
     renders `(v20260916T232955Z)`.
   - The test's `\d{4}-\d{2}-\d{2} …` pattern implied a "datetime" string, but the
     app formats it `v<YYYYMMDD>T<HHMMSS>Z`.
   - Fix: assert `.version-chip` visible, text matches `/v\d{8}T\d{6}Z/`. GREEN (4.7s).

2. "all seven project tabs render their ported content"
   - Test asserted `.project-nav li` count === 7. The app ships 6 tabs for a
     sealed box; the 7th (Enclosure) is hidden when `selectedBox === 'sealed'`
     (OriginalShell-hooks.ts:195 `showEnclosureTab`).
   - The sample project (sample-project.owpr) starts sealed, so 6 tabs show.
   - The app behavior is correct and by design; a sibling test already verifies the
     sealed-hidden case.
   - Fix: click Box tab, `selectOption('vented')` (creed: test constructs its own
     state), then assert 7. GREEN (5.8s).

## Root pattern for the remaining cluster

All ~28 failures in this spec share a class: the test waits on a selector or a
label the current ported shell does not render, and dies at the 6s `expect`
timeout with empty diagnostics. Each fix is a stale-test-contract repair, not an
app change.