# EBP never gets the provenance highlight

## Symptom

In the driver editor with "Inspect Provenance" ticked, clicking EBP highlights nothing — the
field itself does not get the inspected-field outline, while every other calculated field
(Qts, Qes, Mms, Bl, …) does.

## Evidence

Live probe (chromium, `localhost:4100`): editor → Advanced parameters → tick Inspect
Provenance → click the EBP label, then count `.de-fld` elements carrying an inline style:

    EBP inspect -> {"styledCount":0,"styledLabels":[]}

The same probe on the Parameters tab clicking Qts returns three styled fields — Qts with the
inspected outline (`outline: rgb(56,189,248) solid 2px`) and its two inputs Qes/Qms with the
path border (`border-color: rgb(59,130,246)`).

## Cause

`packages/ui/src/ui/components/DriverEditorModal.vue:741` renders the EBP field as

    <div class="de-fld st-c" title="Derived: EBP = Fs / Qes — …">

with no `:style="getFieldStyle('EBP')"`. Every other simulated field binds that style
(e.g. `:style="getFieldStyle('Qts')"` at line 524). `getFieldStyle` is the only thing that
paints the inspect highlight, so a field that does not bind it can never light up.

EBP is otherwise fully wired: `PROVENANCE_MAP.EBP` exists (`packages/ui/src/logic/provenance.ts:124`,
`EBP = Fs / Qes`, inputs `['Fs','Qes']`) and `LABEL_TO_KEY_MAP` maps the label `EBP` → key `EBP`
(`DriverEditorModal.vue:141`), so the click already sets `inspectedField` correctly. Only the
paint is missing.

`c` (line 758) and `roo` (line 762) also omit the binding; both are engine constants with no
`PROVENANCE_MAP` entry, so nothing would paint for them either way.

## Fix

Bind `:style="getFieldStyle('EBP')"` on the EBP field.

## Verification

`packages/ui/test/ui/driver-editor-provenance-and-units.browser.spec.ts` asserts that every
field whose key is in `PROVENANCE_MAP` takes the inspected-field outline when clicked — red for
EBP before the change, green after.
