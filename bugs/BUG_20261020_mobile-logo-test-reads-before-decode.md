# Mobile logo test reads the image size before the image has decoded

- Status: fixed (T485)
- Found: 20 Oct 2026, T485 candidate run https://github.com/Johnlon/openisd/actions/runs/39362161501
- Spec: `packages/ui/test/ui/mobile-shell.browser.spec.ts` — "the empty state shows the app logo and name above the New/Open buttons"

## What happened

The test failed with `naturalWidth` 0 on a change that touched no UI.

## Cause

The logo `img` has a fixed CSS size (40 × 40), so Playwright sees it as visible as soon as it is laid
out. The test then read `naturalWidth` once, and the browser had not yet decoded the image. Under CI
load the decode sometimes comes later than the read.

## Fix

The test waits for the decode itself (`img.complete` and `naturalWidth > 0`) with `expect.poll`,
instead of reading the size once straight after the visibility check. The app is unchanged: the logo
does load; only the moment the test looked was wrong.
