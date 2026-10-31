# BUG 2026-10-30 — OpenISD labels a known scraper refusal as an unknown reason

## Symptom

The exact regenerated Visaton record
`/home/john/work/winisd/winisd_drivers/db/datasheets/visaton/sl-70-ndv-4-ohm/driver.json`
retains the source text `63/60 mm (Installation front/rear)` with `rejected: multiple-values`
and no numeric value. The Stage 6 DQ check succeeds, but writes this misleading warning:

`woofer.Basket_m: unrecognised rejection reason on manufacturer_product_page: "multiple-values" (reading kept as written)`

Reproduction is tools run
`/home/john/work/winisd/winisd_tools/../winisd_drivers/db/runs/2026-10-30T04-43-38Z-2244886`.
The source page distinguishes front and rear installations:
https://www.visaton.de/en/products/drivers/fullrange-systems/sl-70-ndv-4-ohm

## Cause

`packages/design/domain/openisdSchema.ts` defines `UNPARSED_REJECTION_REASONS` as only
`no-numeric-value` and `unit-not-recognised`; `isKnownRejectionReason()` therefore classifies the
scraper's `multiple-values` reason as unknown. `packages/design/domain/driverRecordConverter.ts`
then emits a warning at its unrecognized-reason branch, despite the reading being a valid,
intentional refusal whose raw text is preserved.

## Fix

Add `multiple-values` to the canonical unparsed-rejection vocabulary and preserve its existing
reading text and absence of a number. Do not infer either front or rear measurement and do not
remove the DQ warning mechanism for genuinely unknown reason strings.

## Regression and verification

The converter regression uses a valid driver record whose `Basket_m` reading is
`63/60 mm (Installation front/rear)` with `rejected: multiple-values`. It asserts that the raw
reading and reason survive projection, no number is invented, and no `unrecognised rejection
reason` warning is emitted. A second regression exercises the DQ-only embedded-V8 bridge on the
same refusal.

Verified on 2026-10-30: the focused converter, reading-schema and bridge-bundle tests pass; the
bridge test builds and runs the current embedded-V8 artifact. The selected-bundle browser suite
also passes all 8 cases. The generated Python schema model was refreshed from the updated schema.
