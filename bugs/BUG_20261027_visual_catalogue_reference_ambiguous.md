# The visual catalogue made an old production reference look like the current preview

Status: document corrected and shared DOM-test gap closed; no app-layout change was needed for the reported live wizard field.

John's screenshot 1000071772.jpg came from the visual catalogue supplied by this session.
It shows the closed-box wizard's Calculated Qtc with the model-difference cue inside its
readout. This matches the production capture, not the current-preview capture:

- Production reference: https://openisd.app, build v20261025T2233Z, captured 27 October
  2026 at16:53:14Z; captures/production/wizard-sealed-4.json.
- Preview reference: port4607, build v20261027T1419Z, captured at16:49:41Z;
  captures/preview/wizard-sealed-4.json.
- Fresh verification against the actual http://lap:4607 hostname at17:18:54Z: input right258,
  cue left260, outside=true, no page errors; verification/live-preview.json and.png.

All paths above are under build/ui-manifest/mobile-visual-draft/. The images were traceable,
but the presentation was misleading: production came first, its caption scrolled out of sight,
and the persistent toolbar did not identify which build's image remained visible. Images from
production were consequently presented as though they proved the current preview. That claim
was not justified by the document's usability.

The test gap is separate. The field-content detector measured text overlap/clearance, which
accepts a cue inside an otherwise empty part of an input. The explicit outside-cue assertion
ran on catalogue specimens; the actual wizard was absent from that geometry coverage. The
manifest visit test checks a visible root/mobile skin, not cue conformance. Popup font/shape
checks also do not establish cue placement.

Required corrections: default the visual catalogue to preview-only; make production explicitly
selectable; retain a source/build label while each image is scrolled; preserve both captures and
legacy evidence aliases. Add real-wizard coverage and a mutation proving the shared detector
rejects a model cue inside the control group even when the digits remain clear. This does not
certify all existing screenshots or approve every visual difference.

Verification: default-order red172037, publication green172256; real-wizard mutation red172040,
then baseline/mutation2pass172201; existing shared mobile/desktop matrix73pass172348. Final UI
typecheck172523 and strict test lint172520 pass. Broader all-view approval remains unclaimed.
