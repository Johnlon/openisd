# BUG_20260922_new-project-sealed-volume-unrounded-input

Status: RESOLVED (re-verified 2026-09-26) — confirmed against `OgNewProject.vue`'s current sealed-volume input.

## Symptom
On the New Project wizard's sealed-box step, the "Box volume" input field shows the
raw computed litres figure with no decimal-place limit — full floating-point precision
instead of a clean 2dp number.

## Evidence
[OgNewProject.vue:186](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue#L186):
```
<input type="number" step="0.1" v-limits="{ min: 0.1, max: 100000 }" v-model.number="sealedVolume_L">
```
`v-model.number` binds directly to `sealedVolume_L`, which is set from
[OgNewProject-hooks.ts:227](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L227):
```
if (calculated_m3 != null) sealedVolume_L.value = calculated_m3 * 1000;
```
— an unrounded `Vb` from the alignment solver, no `toFixed`/rounding applied anywhere
on this path. By contrast the vented readout on the same wizard (step 4,
[OgNewProject.vue:209](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue#L209))
already rounds display to 1dp via `.toFixed(1)`.

## Cause
`recomputeSealedVolume()` writes the raw calculated litres straight into the input's
bound ref; nothing rounds/limits it to a display precision.

## Fix
`recomputeSealedVolume()` ([OgNewProject-hooks.ts:227](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts?html#L227))
now rounds to 2dp before writing `sealedVolume_L`:
```
if (calculated_m3 != null) sealedVolume_L.value = Math.round(calculated_m3 * 1000 * 100) / 100;
```

## Verification
TDD, RED→GREEN: new test in
[OgNewProject-hooks.test.ts:210](http://localhost:8000/winisd/openisd/packages/ui/test/hooks/OgNewProject-hooks.test.ts?html#L210)
— "rounds the derived sealed volume to 2dp instead of showing the raw calculation" — failed
pre-fix (`20.09276437847866` ≠ `20.09`), passed after. Full file:
`npx vitest run packages/ui/test/hooks/OgNewProject-hooks.test.ts` — 14/14 passed.
`npm run typecheck` — `ui` clean.
