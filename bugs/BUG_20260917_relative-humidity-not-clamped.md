---
id: 20260917-relative-humidity-not-clamped
title: Relative humidity accepts negative entry beyond schema min — RULED: flag, not clamp
status: closed
tags: [app-bug, schema-enforcement, original-skin]
---

## What the bug is

`original-skin.browser.spec.ts` "field constraints: negative/out-of-range entry is
rejected or clamped everywhere (schema-enforced)" asserted the Relative-humidity
field clamps an entered `-20` back to its schema minimum (`0`). Observed:

- Locator: `.tab-section.active .field` filter `hasText: 'Relative humidity'` → `input`
- Expected: `"0"` (clamped to min)
- Received: `"-20.00"` (stored raw)

## Verdict

NOT an app bug — a deliberate, documented design divergence (accept-and-flag). Air fields
are bound with `:allow-out-of-range="true"` (OriginalShell.vue:615): the out-of-range value
stays entered and carries a `dq-flag` + "outside the sane range" tooltip (dq powered by
`airFieldDataQuality` over `AIR_FIELD_LIMITS`, OriginalShell-hooks.ts:63-67). Raw-entry
fields (Box Volume etc.) DO reject on the NumInput schema path — the app has both policies,
by design.

## Reproduction

1. `npx playwright test packages/ui/test/ui/original-skin.browser.spec.ts --g "field constraints" --workers=1 --retries=0`
2. Used to receive `"-20.00"` and fail; now asserts the flag contract instead.

## Status
Closed — human ruling 2026-09-17 (see BUG_20260917_humidity-clamp-vs-flag.md): **flag is
correct**. The field-constraints test now asserts the flag contract instead of a clamp.