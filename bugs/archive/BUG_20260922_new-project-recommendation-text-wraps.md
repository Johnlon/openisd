# BUG_20260922_new-project-recommendation-text-wraps

Status: RESOLVED (re-verified 2026-09-26) — confirmed against `OgNewProject.vue`'s current readout markup.

## Symptom
On the New Project wizard's sealed-box and vented-box readout panels, the
"Recommendation:" row (e.g. value "Either sealed or vented") wraps onto a second
line instead of staying on one line.

## Evidence
[OgNewProject.vue:194](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue#L194) and
[:212](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue#L212):
```
<div class="readout-item"><span>Recommendation:</span> <strong>{{ ebpSuitabilityLabel }}</strong></div>
```
CSS at [OgNewProject.vue:277](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue#L277):
```
.readout-item { display: flex; justify-content: space-between; width: 240px; }
```
Fixed `width: 240px` on a flex row holding both the label and the value, with no
`white-space: nowrap` on the value and no `flex-shrink`/`min-width` control — the
longest label value, `"Either sealed or vented"` (from
[OgNewProject-hooks.ts:199](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L199)),
plus the "Recommendation:" label, does not fit in 240px and wraps.

## Cause
`.readout-item`'s fixed 240px width is too narrow for the longest recommendation
string; nothing prevents the `<strong>` value from wrapping.

## Fix
[OgNewProject.vue:277](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue?html#L277)
— dropped the fixed `width: 240px`/`justify-content: space-between`, sized to content instead:
```
.readout-item { display: flex; gap: 12px; white-space: nowrap; }
```

## Verification
Pure CSS layout fix — outside this project's logic-focused TDD tiers (unit/hook/mocked-UI all
test logic, not rendered layout; a browser-pixel-layout assertion would be the only tier that
could observe wrapping, and none exists for this panel). Verified by reading the rule directly:
`white-space: nowrap` on the flex row plus dropping the fixed width removes the only two things
that could force a wrap. `npm run typecheck` — `ui` clean (template-only change, no logic
touched).
