# BUG — the provenance popup's "Live:" line never substitutes a real value

# Status
FIXED (superseded 2026-08-19 — the feature was removed)

## Symptom

Inspect Provenance → click any field with a formula (e.g. Fs). The popup shows:

```
PRIMARY FORMULA (BLUE)
Fs = 1 / (2π × √(Cms × Mms))
Live: Fs = 1 / (2π × √(? × ?))
```

Cms and Mms are visibly populated in the Parameters tab at the same time. This is not specific
to Fs — every field's "Live:" line shows `?` for every input, always, regardless of what is
entered.

## Cause

`DriverEditorModal.vue:140` calls:

```ts
return getProvenanceInfo(inspectedField.value, driverRaw.value as unknown as Record<string, number | null>);
```

`driverRaw` (`DriverEditorModal.vue:58`) is a narrow DISPLAY VIEW built for exactly eight
metadata fields:

```ts
const driverRaw = computed(() => ({
  brand: ..., model: ..., manufacturer: ..., providedBy: ..., comment: ..., added: ...,
  sku: ..., VCCon: ...,
}));
```

None of the T/S parameters (`Fs`, `Mms`, `Cms`, `Vas`, `Bl`, …) are on it. `provenance.ts`'s
substitution loop does `currentValues[inputKey]`, gets `undefined` for every key, and the
`typeof val === 'number'` guard falls through to `'?'` on every single lookup — the feature has
never had real data to substitute, for any field, since `driverRaw`'s shape was narrowed to
metadata-only.

## Fix

Read the numeric values through the same accessor the rest of the modal already uses —
`cellVal(field)`, which resolves through `draftDriver.cell()` and is correctly reactive to
`trigger` — instead of the metadata-only `driverRaw`. A `Proxy` that calls `cellVal(key)` on
any property access covers every `PROVENANCE_MAP` input without hand-listing them.

## Verification

No existing test exercises the substituted (`Live:`) text — `driver-editor-provenance-and-units.browser.spec.ts`
and `driver-editor-provenance.browser.spec.ts` check the popup's highlight/coloring but not the
`Live:` line's content. Adding a check that opens Inspect Provenance on a field with a
known-populated input and asserts the `Live:` line contains that input's actual entered value,
not `?`.

Re-verified 2026-08-19: the "Live:" line no longer exists at all —
`driver-editor-provenance-and-units.browser.spec.ts:333-340`, `'the equation-inspector popup no
longer shows a "Live:" substitution line'`, opens Inspect Provenance on Fs and asserts
`.eq-inspector-card`'s "Live:" text has ZERO count. Rather than fixing the substitution, the
feature was removed outright — this bug's symptom cannot recur since its cause (the
substitution mechanism) no longer exists. Test passes.
