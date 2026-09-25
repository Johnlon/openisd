# BUG_20260924_model-field-cannot-be-emptied-when-sku-present

**Status:** RESOLVED — the Model input reads and writes `model`; its empty mark reads the same cell (`DriverEditorModal.vue`).

## Symptom

In the driver editor, clearing the Model field does nothing visible when the driver has a
`sku`. The box immediately re-fills with the sku (e.g. "W5-1138SMF") and never takes the
red empty-mandatory border, so the human cannot tell the Model is unset and cannot clear it.

## Evidence

- `packages/ui/src/ui/components/DriverEditorModal.vue:144-148` — `editorModelValue` returns
  `r.sku.toUpperCase()` whenever a sku exists, ignoring `r.model` entirely.
- `packages/ui/src/ui/components/DriverEditorModal.vue:624-625` — the input binds its `:value`
  AND its `de-input-empty` class to that same computed, so both the text and the "is it empty"
  mark come from the sku, not from what was typed.
- `packages/ui/test/logic/driver-editor-mandatory.browser.spec.ts` — the test `brand and model
  fields are mandatory, have bold borders, and turn red when empty without losing focus`
  FAILS on this. Confirmed 2026-09-24: 11 passed, 1 failed in that spec, failing in isolation.
  Pre-existing; unrelated to the strip split done the same day.

## Cause

The Model input reads a display value (sku preferred) but writes the `model` field. Read and
write are not the same cell, so a write of `''` is immediately masked by the sku on read.

## Fix

Decide which the Model cell is, then make read and write agree:

- If Model is the editable identity field, `editorModelValue` returns `r.model` and the sku is
  only a placeholder/default applied once when Model is unset — not a live fallback on read.
- If Model is derived from sku, the input is read-only and the mandatory-empty mark belongs on
  sku instead.

Either way the `de-input-empty` class must read the same cell the input writes.

## Verification

The existing browser assertion in `driver-editor-mandatory.browser.spec.ts` passes: clearing
Model leaves it empty and red-bordered, focus is retained.
