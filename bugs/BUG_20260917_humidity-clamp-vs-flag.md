---
id: 20260917-humidity-clamp-vs-flag
title: RULED — humidity out-of-range: app flags, test now asserts the flag
status: closed
tags: [ruling, product-decision, schema-enforcement]
---

## The conflict

`original-skin.browser.spec.ts` "field constraints: negative/out-of-range entry is
rejected or clamped everywhere" asserts the Relative-humidity field clamps:

- `fill('-20')` → `toHaveValue('0')`
- `fill('250')` → `toHaveValue('100')`

The app's design for THIS field is different — `OriginalShell.vue:615`:

```
<NumInput v-model="advHumidity" :allow-out-of-range="true" :dq="envHumidityDq" dq-state="entered" @blur="commitAirHumidity" />
```

- `allow-out-of-range="true"` → NumInput.valid() becomes just `isFinite` (NumInput.vue:162 → no clamp, no inp-bad).
- `envHumidityDq` (OriginalShell-hooks.ts:757) wraps `airFieldDataQuality('humidity', …)` which prints `"Relative humidity is outside the sane range (0–100)"` — the app's chosen signal for out-of-range air values is a **dq-flag**, not a clamp.
- The same file commits the value on blur via `commitAirHumidity` (hooks:777) unchanged — no clamp there either.

Other fields DO enforce: Box Volume with `-5` → `inp-bad`, rejects, blur reverts (NumInput default path `valid()` gated on effMin/effMax). So the app has BOTH policies: schema-clamp for entry fields, accept-and-flag for air fields.

## The question for the human

Is the humidity accept-and-flag contract (current app) the intended design, or should
humidity also clamp the way the test expects?

- If **flag is correct** → fix the test to assert: `-20` types, stays (or reverts on blur), and the field gains the `dq-flag` class + the "outside the sane range" tooltip.
- If **clamp is correct** → drop `:allow-out-of-range="true"` on the humidity NumInput (and likely temperature/pressure too — all three air fields share the same binding pattern), leaving NumInput's default schema-enforcing `valid()`; test stays as-is.

## Status
Closed — human ruled 2026-09-17: **flag is correct; fix the test**. The field-constraints
test now asserts the `dq-flag` class + "outside the sane range" tooltip for `-20` and `250`
instead of claiming a clamp. Nothing app-side changed.