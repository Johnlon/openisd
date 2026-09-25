# advTemp/advHumidity/advPressure silently overwrote a loaded project's environment on mount

Status: RESOLVED

## Symptom

Opening a project whose stored environment (temperature/humidity/pressure) differed from the
app-level Options → General → Environment defaults had its environment silently replaced by
those defaults the instant `OriginalShell.vue` mounted — before the user touched the Advanced
tab, and with no signal that anything changed. A user who set humidity to 80% on a project,
saved it, and reopened it would find it silently reset to whatever the current Options default
said (30% out of the box), with the sweep recomputed against the wrong air.

## Evidence

`OriginalShell.vue`'s Advanced-tab environment inputs were three local `ref`s, each seeded from
`presentationState.ui.envDefaults` (the app-level Options default, editable in `OptionsModal.vue`
— not the project's own stored value) and pushed into the project via an `immediate: true` watch:

```ts
const advTemp = ref(presentationState.ui.envDefaults.tempK);
watch(advTemp, (v) => { managedProject.setEnvTempK(v); }, { immediate: true });
const advHumidity = ref(presentationState.ui.envDefaults.humidityPct);
watch(advHumidity, (v) => { managedProject.setEnvHumidityPct(v); }, { immediate: true });
const advPressure = ref(presentationState.ui.envDefaults.pressurePa);
watch(advPressure, (v) => { managedProject.setEnvPressurePa(v); }, { immediate: true });
```

`{ immediate: true }` fires each watcher once on setup, on every mount, unconditionally writing
the app-level default into `managedProject` via `setEnvTempK`/`setEnvHumidityPct`/
`setEnvPressurePa` — regardless of what the just-loaded project's own `advTemp`/`advHumidity`/
`advPressure` cells already held. Nothing read the project's stored value into the ref first, so
the write on mount always clobbered it with the default.

## Cause

The three refs were a SHADOW of `managedProject`'s own environment cells rather than a live view
of them: seeded once from an unrelated app-level default, then pushed one-way into the project on
every change (including the synthetic "change" `immediate: true` manufactures on mount). The
correct pattern — read AND write through the same accessor, as `driveV` (`OriginalShell.vue`)
already did for drive voltage — was not used here.

## Fix

`OriginalShell.vue`'s `advTemp`/`advHumidity`/`advPressure` are now `computed` with paired
get/set bound straight to `managedProject.envTempK()`/`envHumidityPct()`/`envPressurePa()` and
`setEnvTempK()`/`setEnvHumidityPct()`/`setEnvPressurePa()` — the same live-read-through-
`managedProject` shape as `driveV`. There is no seed value and no mount-time write: the input
always displays and edits the project's actual stored environment, and the app-level Options
default only ever applies where it already correctly did — new-project creation via
`appState.ts`'s `newProject()` — never to a project already carrying its own values. Landed in
commit `a55b3ba` (2026-08-23), alongside the item-18/20/21/etc D14 cleanup pass — filed
retroactively per the record-before-fix rule (opus2's review of that commit, 2026-08-23,
flagged the fix as landed without a bug record).

## Relation to bugs/archive/BUG_20260805_humidity-and-pressure-inputs-are-collected-persisted-and-then-ignored.md

**Distinct second defect in the same three-field family — not a resurfacing of BUG_20260805.**
That bug's claim was the values never reached the engine at all (`Params` missing the fields,
dangling local refs). Re-checked live against current code (2026-08-23): `managedProject.
toUiParams()` still feeds `envHumidityPct()`/`envPressurePa()` into the `UiParams` the sweep
consumes, and `air.ts`'s moist-air formulas still consume both — that fix holds. This bug is a
different mechanism: the pipeline into the engine was intact, but the UI inputs were one-way
shadow refs that clobbered a loaded project's own values with an app-level default on mount —
an edit-binding bug, not a wiring gap.

## Verification

opus2's review of commit `a55b3ba` confirmed the mechanism above and the correctness of the
computed-based fix. `npx vue-tsc -p packages/ui --noEmit` clean; no dedicated regression test
was added for the mount-time overwrite specifically — closure would benefit from one asserting
that loading a project with a non-default humidity/pressure/temperature leaves those values
unchanged after mount.
