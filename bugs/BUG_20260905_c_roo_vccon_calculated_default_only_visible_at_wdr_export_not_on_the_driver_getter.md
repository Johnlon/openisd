# c/roo/VCCon read as `not-available` on the driver itself; their calculated default only shows up at `.wdr` export

**Found:** 2026-09-05, reviewing `packages/design/domain/project.ts`'s spec-field `clear()`
(session fixing `wdr-model-coverage.test.ts` onto the current API).

## Symptom

`driver.spec[section].c_m_per_s.get()`, `.roo_kg_per_m3.get()` and `.VCCon.get()`, called
directly on the domain object with no value entered (or after `.clear()`), all return
`{value: null, state: 'not-available'}` — indistinguishable from an ordinary derivable field
like `Fs_hz` that the engine genuinely cannot compute.

`c` and `roo` DO have a real always-available answer: `engine.airFor({})` at the reference
environment. `VCCon` DOES have a real documented default: WinISD's own default is 1 (parallel)
— `docs/spec/SPEC_ENGINE.md:424`, `"Defaults are 0, except numVC=1, VCCon=1, ..."`. Neither
default is invented; both are already implemented — but only inside
`openIsdDriverToWinIsdDriver` (`driverYmlToOpenisdAndWdr.ts:497-499` for c/roo,
`wdrVCCon()`/`431-440` for VCCon), which runs at `.wdr` export time.

Any caller reading the driver directly — the UI, a test, `solveConsistencyGroup`'s own inputs —
never sees the calculated default; only a caller that goes through `.toWdrIni()`/
`openIsdDriverToWinIsdDriver` does.

## Evidence

`packages/design/test/winisd/wdr-model-coverage.test.ts` (this session, all passing) —
`'c and roo, left unentered, come back live-computed at the reference environment'` and
`'entering then clearing c/roo...'` both assert the calculated value ONLY on
`openIsdDriverToWinIsdDriver(...).cell('c')`, never on `driver.spec[section].c_m_per_s.get()`
directly, because the latter does not carry it:

```ts
section.c_m_per_s.clear();
assert.deepEqual(section.c_m_per_s.get(), { value: null, state: 'not-available' }); // passes today
```

If `c`/`roo`/`VCCon` had their calculated defaults on the getter itself, that assertion would be
wrong — it currently passes only because the getter has no such behavior.

## Cause

`packages/design/domain/project.ts`'s field builders (`f()` at ~1177, the `wiring()` builder at
~1154) read only `record.get().specs[section]?.[key]` and report `not-available` when absent.
Neither consults the engine. The live-default computation lives entirely in
`driverYmlToOpenisdAndWdr.ts`'s `openIsdDriverToWinIsdDriver`, which is export-only code, not
reachable from `driver.spec[section].c_m_per_s.get()`.

## Impact

Any code path that reads `c`/`roo`/`VCCon` off a driver without going through `.wdr` export sees
a hole instead of the real, always-defined value — e.g. the UI showing "not available" for air
conditions or coil wiring on a driver that has never been exported, when WinISD itself always
shows a value for both.

## Not fixed here

Needs a decision on where the calculated default is computed (the field's own getter needs an
`Engine` reference it does not currently hold — every other derivable field's `not-available`
state is legitimate because nothing else could supply a number; c/roo/VCCon are different in
having one always). Flagged rather than fixed pending that design call.

## Verification when fixed

A test asserting `driver.spec[section].c_m_per_s.get()` (no export step) returns
`{value: <engine.airFor({}).c>, state: 'calculated'}` on a fresh, unentered driver, and the same
for `roo_kg_per_m3` and `VCCon` (`{value: 'parallel', state: 'calculated'}`).
