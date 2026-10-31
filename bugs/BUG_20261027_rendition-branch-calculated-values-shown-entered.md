# Calculated values are painted as entered on the rendition branch

Status: open; detected in the first same-project production comparison, before claiming the branch ready.

Production v20261025T2233Z paints closed-box Fsc71.95 and Qtc0.707 blue. The local rendition branch at c120b6b11 plus the current working changes paints both green. The underlying inputs correctly carry value-c. The new generic green input rule failed to include the production provenance class in its calculated-value override. The catalogue used fixed bindings, so all44 numeric base forms still passed their paint test.

Evidence: build/ui-contract/rendition-branch/closed-box/{prod,local}-{mobile,desktop}-closed-box.png and JSON records; identical complete-driver project bytes. The local capture identifies its dev source commit and dirty state. No deployment claim.

Required fix: compare actual calculated app fields to the catalogue's calculated overlay, add entered/calculated/defaulted/empty state coverage, and preserve blue calculated values in all shared rows. Red-to-green browser evidence is required before closure.

The same desktop comparison also shows the standard frequency control clipped in the narrow Signal Generator sidebar. This remains open for a general ancestor-clipping regression and a layout that fits the reference controls; a zero-row numeric-contract result on prod/test was not treated as a clean report.


## Remaining focused-cursor defect found by Argon,27 October2026

OPEN: the earlier base-input colour repair does not cover the active inverse cursor's normal
blink phase. Confirmed on normal preview http://lap:4607,374×705,source10fbfcca3 with the
same complete-driver .owpr imported through the ordinary file control. Closed Box Fsc is a
writable calculated field, displayed71.95. Native ArrowLeft then End creates the selected
last-digit marker. Pausing its real Web Animation at phase0 and0.7 gives:

| Surface | Computed foreground | Background |
| --- | --- | --- |
| Actual native input | rgb(0,102,255) | unchanged calculated field |
| Selected digit, inverse phase0 | rgb(255,255,255) | rgb(24,104,201) |
| Selected digit, normal phase0.7 | rgb(7,130,0) | transparent |

The normal digit should retain the input's calculated foreground. The keyframes in
packages/ui/src/ui/field-catalogue.css hardcode entered-green for every provenance.
The selected marker is a separate painted glyph; current tests check animation duration,
text and disappearance, but neither blink-phase provenance nor actual glyph alignment.
No claim about fringes is confirmed by this colour measurement.

Reproducer /tmp/T607-argon-cursor-probe.mjs; structured evidence
build/ui-contract/argon-cursor-probe.json. The first probe tried End without moving the
native caret and did not obtain a marker; explicit ArrowLeft→End, matching the existing
end-caret regression, establishes the required initial condition. No app source changed.
Required closure: failing real calculated-field blink-phase regression, preservation of
normal foreground across provenance states and focused Argon recheck.
