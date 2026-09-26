# BUG_20260922_new-project-driver-use-does-not-advance-wizard

Status: RESOLVED (re-verified 2026-09-26) — confirmed: `embedLibrary`'s callback drives the wizard's own `selectDriver` step advance.

## Symptom
On the New Project wizard's driver-picker step, clicking "Use" on a driver row picks
the driver but leaves the wizard on the same tab/step — it should move on to the next
wizard step automatically.

## Evidence
Driver picker "Use" click, when embedded in the wizard, resolves through
`embedLibrary`'s callback
([driverBrowsingState.ts:433-436](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L433-L436))
into the wizard's `selectDriver`:
```
function selectDriver(driver: OpenISDDriver): void {
  selectedDriver.value = driver;
  recomputeSealedVolume(driver, targetQtc.value);
}
```
([OgNewProject-hooks.ts:230-233](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts#L230-L233))
— this only stores the driver and recomputes the sealed volume. Nothing here (or in
its caller, `driverBrowsing.embedLibrary(driver => selectDriver(driver))` at
[OgNewProject.vue:80](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue#L80))
advances the wizard's `step` ref.

## Cause
`selectDriver` has no call to whatever advances `step` (e.g. a `nextStep()`/`step++`
the wizard uses elsewhere); picking a driver just leaves the picker closed on the
current step.

## Fix
[OgNewProject-hooks.ts:230-236](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts?html#L230-L236)
— `selectDriver` now advances the wizard when picking a driver is step 1's whole job:
```
function selectDriver(driver: OpenISDDriver): void {
  selectedDriver.value = driver;
  recomputeSealedVolume(driver, targetQtc.value);
  if (step.value === 1) next();
}
```

## Verification
TDD, RED→GREEN: new test in
[OgNewProject-hooks.test.ts:220](http://localhost:8000/winisd/openisd/packages/ui/test/hooks/OgNewProject-hooks.test.ts?html#L220)
— "picking a driver on step 1 moves the wizard on to step 2" — failed pre-fix (`step` stayed
`1`), passed after. Checked every existing test calling `selectDriver` still passes (none
asserted `step` stays at 1 after picking). Full file:
`npx vitest run packages/ui/test/hooks/OgNewProject-hooks.test.ts` — 14/14 passed.
`npm run typecheck` — `ui` clean.
