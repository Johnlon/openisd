# BUG_20261001_filter-spinners-do-not-update-charts-live

**Status:** RESOLVED

## Symptom
Spinning a filter's Cutoff (or Q, gain, …) in the Filters tab does not redraw the charts while
spinning; the charts move only when the field is left. Live update is the point of a spinner
(John, 2026-10-01).

## Evidence
- `packages/ui/src/ui/shells/original/filters/*Editor.vue`: every number field binds
  `@change="api.edit…"`.
- `NumInput.vue` (left-nav live fields) binds `@input` and emits on every step.

## Cause
There are two events on a number box, `input` and `change`. `input` fires on every spin step
(wheel, arrow keys, typing); `change` fires only on commit (blur, Enter). The filter editors listen
to `change` only.

## Fix
Every filter editor number field binds `@input="liveNum(...)"` beside its `@change`. `liveNum`
(`filters/numericInput.ts`) applies the value on each `input` once the box holds a readable, in-range
number; an emptied or out-of-range entry waits for `@change`, which clamps it as before.

## Verification
`filters-tab.browser.spec.ts`: for each of the 10 filter types, an `input` with no `change` (what
Chromium sends while a spinner arrow is held — headless runs no arrows on a mouse hold) updates the
caption; an emptied Cutoff stays empty and leaves fc unchanged. The held tests fail with `liveNum`
disabled.
