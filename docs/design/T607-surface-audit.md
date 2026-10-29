# Box losses popup correction — wider audit cancelled

What to do: FYI; review comparison pictures as they are published.

Historical request (cancelled by John: “forget my comments about broard context”): every screen, tab, overlay and
popup for every box type, on phone and desktop. Fix covered labels by allocating more
label space and narrower fields on the affected surface. Preserve the selected joined
appearance, outside warnings and independent behaviour fixes. No case is marked audited
merely because a related screen passed.

- done — The Box losses popup MUST show its complete labels beside narrower fields when any chamber of any box type is opened. Evidence required: production/before/after pictures, failing layout check and all applicable chamber/skin/width cases green.
- cancelled by John — The project tabs MUST keep every label, value and control visible when each box type is selected on either skin. Evidence required: explicit box × tab × viewport matrix and DOM reports.
- cancelled by John — The overlays and popups MUST keep complete controls visible when opened from every applicable box type. Evidence required: source-reconciled surface inventory, explicit applicability and per-surface DOM reports.
- cancelled by John — The Driver Editor and Options tabs MUST keep their labels and controls visible when every tab opens from each box type. Evidence required: tab matrix and reports, with modal children audited separately.
- cancelled by John — The wizard MUST keep complete controls visible when every valid step and box type is selected. Evidence required: complete step/box matrix including passive-radiator selection.
- cancelled by John — The comparison page MUST show justified changes against production when each defect family is repaired. Evidence required: same-project pairs, personal comparison, per-picture text composers and Gemini criticism.

## Initial finding

The previous screen list never opened Box losses. Its existing functional specs assert
that Interchamber Qicl exists and that its value can be edited, without measuring label
visibility or the complete control against clipping ancestors. New box-losses layout
checks explicitly cover all six box types, each applicable chamber, phone360/374 and
desktop1024/1280. Red114955 reproduces wrapped Absorption Qa and Interchamber Qicl. Green115046:
36 layout contexts (9 box/chamber combinations ×4 skin/width choices) plus19 retained
functional popup cases =55 passing. Unit bindings/defaults28 pass115914; typecheck115909
and changed-source/spec lint115915 pass. Only the four phone popup value boxes are made
narrower; labels retain their text, size and position, beside the fields.

At374px the boxes change from167px atx101 to121px atx147. Their right edge stays268px;
spinners remain in position. Every label is one line. Production has stacked labels on
this popup; the requested correction keeps the side-by-side form. Desktop already fits
and is unchanged. Comparison: http://lap:8000/winisd/openisd-t607/build/ui-contract/surface-audit-v1/qicl/.

John's follow-up: “no just make the text boxes narrower” and “the image you showed has
wrapped texts”. The wrapped picture was BEFORE; the updated page presents CORRECTED
first and explicitly labels the old version. The current fix is intentionally local.
The broader audit was explicitly cancelled by John; only the narrower popup inputs remain in scope.


Final scope ruling: John said “forget my comments about broard context”. No wider audit
will be continued. The local popup repair remains, with its completed regression checks.
