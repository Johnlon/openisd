# The provenance highlight box stops short of the unit on 25 editor fields

## Symptom

With "Inspect Provenance" on, the coloured box drawn around a field does not surround the
field: the unit label sits outside it on the right, so the box reads as shifted left of the
control it is marking.

## Evidence

Live probe (chromium, `localhost:4100`) measuring, for every `.de-fld` that has a unit span,
the gap between the unit's right edge and the field box's right edge:

| tab | fields with a unit | unit outside the box |
|---|---|---|
| Parameters | 22 | 12 (Cms +20 px, Rms +16, BL +4, Dd +7, Le +6, fLe +8, KLe +21, Xmax +36, Hc +7, Hg +7, Xlim +7, Znom +11, USPL +2) |
| Advanced parameters | 13 | 11 (AlfaVC +25, R(t) +10, C(t) +5, SPLmaxLF +2, SPLmax +2, Rme +16, Mpow +18, Mcost +10, EBP +2, c +7, roo +19) |
| Dimensions | 8 | 0 |

Worst case: Xmax, whose unit `mm peak` ends 36 px to the right of the box that is supposed to
enclose it.

Every overflowing field measures **exactly 165 px wide**. Every field that does NOT overflow
measures more than 165 px.

## Cause

`packages/ui/src/ui/components/DriverEditorModal.vue:1107-1111`:

    .de-cols {
      display: grid !important;
      grid-template-columns: 165px 165px 165px 1fr !important;
      gap: 10px 14px !important;
    }

and `:1056-1068`:

    .de-fld { display:flex; ... width: fit-content !important; padding: 2px 4px; }

`width: fit-content` on a grid item resolves against the item's grid area, so in a fixed 165 px
track it can never exceed 165 px. A field whose label (62 px) + input (75 px) + gaps (12 px) +
padding (8 px) + unit exceeds that budget has its unit painted outside the box's right edge.
The highlight is drawn on `.de-fld` (`getFieldStyle`, lines 156-183), so the highlight clips at
the same 165 px.

The fields in the fourth (`1fr`) column are unclipped, which is why the same field type shows
the fault in one column and not another, and why the Dimensions tab — a plain 200 px block list
(`.de-dimlist`, line 1045), not a `.de-cols` grid — is clean.

## Fix

Size the three fixed tracks to their content instead of a 165 px guess, so the item's
`fit-content` can reach its natural width and the box encloses label + input + unit.

## Verification

`packages/ui/test/ui/driver-editor-provenance-and-units.browser.spec.ts` asserts, for EVERY
field on every editor tab, that the label, the input and the unit span all lie within the
field box's rectangle — red on 25 fields before the change, green after.
