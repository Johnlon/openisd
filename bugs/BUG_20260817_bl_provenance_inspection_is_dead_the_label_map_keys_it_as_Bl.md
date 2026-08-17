# BL's provenance inspection is dead — the label map keys it as `Bl`

## Symptom

In the driver editor with "Inspect Provenance" on, clicking BL explains nothing: no outline on
BL, no path colour on the fields its formula names. Every other Thiele/Small field responds.

## Evidence

`driver-editor-provenance-and-units.browser.spec.ts` sweeps every field on every tab and lists
the calculated ones the inspector cannot explain:

    calculated values the inspector cannot explain
    + "Parameters/BL (BL)"
    + …

The key in brackets is what the click resolves to: `BL`, which no `PROVENANCE_MAP` entry uses.

## Cause

The editor identifies a clicked field by its rendered label text
(`DriverEditorModal.vue` `handleBodyClickOrFocus` → `LABEL_TO_FIELD_KEY[labelText]`).

The field renders `<label>BL</label>` (`DriverEditorModal.vue`, Thiele/Small group), but the
table has

    Bl: 'Bl',

keyed on `Bl`, a label the editor never renders. So the lookup misses, `inspectedField` falls
back to the raw label `BL`, and `getProvenanceInfo('BL')` returns null because the map's entry
is `Bl` (`packages/ui/src/logic/provenance.ts`, `BL = √(2π × Fs × Mms × Re / Qes)`).

Same class as EBP's missing `getFieldStyle` binding: the paint machinery works, the wiring to
this one field does not.

## Fix

Key the entry on the label the editor actually renders: `BL: 'Bl'`.

## Verification

The sweep test above no longer lists `Parameters/BL`; clicking BL outlines it and colours
Fs, Mms, Re and Qes.
