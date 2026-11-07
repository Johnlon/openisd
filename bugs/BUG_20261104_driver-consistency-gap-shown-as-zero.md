# BUG_20261104_driver-consistency-gap-shown-as-zero

**Status:** FIXED (T662)

## Symptom
- B&C 18NW100-4: BL stated 24.7 Tm, the other figures imply 26.748 Tm (about 7.7% apart). The warning read
  "... disagree by 0.0%".
- The Driver tab (desktop and phone) did not list the driver's consistency checks; only the Driver Editor did.
- A project's driver showed no checks at all: its issues come from a short-lived window that has lost them.

## Cause
- `ConsistencyCheck.check` passes `inconsistentInputs` the gap left after rounding uncertainty and tolerance
  (`relative`, 0.0004 here). `inconsistentInputs` printed that as "disagree by".
- `OpenISDDriver.issues()` read the window's own cache; an embedded driver is rebuilt on every access, so the
  cache was empty. The project's durable cache (`durableIssues`) was used only for per-field marks.

## Fix
- `engine/consistency.ts`: the sentence states |expected - actual| / max(|expected|, |actual|). `relative` keeps
  its meaning (decides whether to warn).
- `domain/driver/openISDDriver.ts`: `issues()` reads `durableIssues` when the driver has one.
- New `DriverConsistencyList.vue`, shown on the desktop and phone Driver tabs from
  `driver.inconsistentInputReasons()`.
- New 18NW100-4 BL text: "force factor (BL), coil resistance (Re), resonance (Fs), Qes, compliance (Cms)
  disagree by 7.7%: Bl = √(Re/(2π·Fs·Qes·Cms)). Every field in the group is marked - correct one of them, or
  clear one to let it be calculated."

## Tests
- `packages/design/test/engine/dq-issue-text.test.ts` > "B&C 18NW100-4 BL states the real stated-vs-implied gap"
- `packages/design/test/domain/driver-dq-reasons.test.ts` > "reads the issues from a project's embedded driver"
- `packages/ui/test/ui/mobile-driver-tab.browser.spec.ts` > "the Driver tab lists the driver's consistency checks"
- `packages/ui/test/ui/driver-tab-consistency.browser.spec.ts`
- `packages/design/test/fixtures/driverSolverGolden.ts` texts updated to the real gap.
