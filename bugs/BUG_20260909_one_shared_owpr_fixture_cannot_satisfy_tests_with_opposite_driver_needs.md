# One shared `.owpr` fixture cannot satisfy tests with opposite driver needs

Status: OPEN

## Symptom

15 of 59 tests in `packages/ui/test/logic` fail, in four specs, all against the single shared
fixture `packages/ui/test/fixtures/sample-project.owpr`:

```
packages/ui/test/logic/consistency-dq.browser.spec.ts        3 failed
packages/ui/test/logic/driver-editor-mandatory.browser.spec.ts  6 failed
packages/ui/test/logic/tune-panel-fields.browser.spec.ts     5 failed
packages/ui/test/logic/tune-panel-shots.browser.spec.ts      1 failed
```

The consistency-dq three fail identically — the DQ mark never appears:

```
Error: expect(locator).toHaveCount(expected) failed
Expected: 1
Received: 0
  - waiting for locator('.tune-panel .tune-fld')
      .filter({ has: locator('label').filter({ hasText: /^Fs$/ }) }).locator('.de-dq')
    14 × locator resolved to 0 elements
> 116 |   await expect(tuneField(page, 'Fs').locator('.de-dq')).toHaveCount(1);
```

## Cause

The fixture's driver carries five spec fields and no more:

```
$ python3 -c "import json; ..." packages/ui/test/fixtures/sample-project.owpr
Fs 37, Qts 0.38, Vas 0.03, Re 6.6, Sd 0.0212
```

Each failing spec needs a driver in a DIFFERENT starting state, and one record cannot hold
them all at once:

| Spec | Needs the driver to be |
|---|---|
| `consistency-dq` | complete enough that Fs/Mms/Cms reconcile, so overriding Mms BREAKS a group that was previously whole |
| `driver-editor-mandatory` | deliberately INCOMPLETE, so the "what is missing" strip renders |
| `tune-panel-fields` | carrying Qts/Qes/Qms so a blank Q can autocalculate from the other two |

`consistency-dq` gets no mark because with no Qes/Qms and no derivable Cms there is no
reconciled group to break: the group never formed, so nothing disagrees. The app is behaving
correctly — the mark is absent because the precondition the test states in its own comment
("Fs stays entered at 37 Hz, Cms stays computed from Vas and Sd") is not actually established
by the fixture it loads.

## Impact

15 red tests that report nothing about the code. Worse than merely useless: `consistency-dq`
is the gate for the QP18/QO12 ruling ("show a dq next to any field in a group that has lost
consistency"), and it is currently red for a reason unrelated to that mechanism — so a genuine
regression in the DQ mark would be indistinguishable from today's noise.

It also violates the project's own test rule: `AGENTS.md` and `.claude/skills/
test-driven-development` both require that each test construct the data it depends on. A single
module-level fixture shared by specs with contradictory needs is the shape that rule forbids.

## Fix

Each spec gets a fixture matching its own precondition, rather than all four sharing one:

- `consistency-dq` — a COMPLETE driver (Fs, Qts, Qes, Qms, Vas, Sd, Re, Le, Mms, BL, Xmax, Pe)
  whose consistency group reconciles before the test breaks it.
- `driver-editor-mandatory` — a deliberately incomplete driver, missing exactly the fields each
  test asserts are reported missing.
- `tune-panel-fields` — a driver carrying all three of Qts/Qes/Qms.

A fixture file on disk is explicitly permitted to be shared ("Fine to share: a fixture file on
disk"); what is not permitted is one file standing in for three different domain preconditions.
So: several named `.owpr` files under `packages/ui/test/fixtures/`, each named for the state it
encodes, and each spec loading the one whose precondition it asserts.

`tune-panel-fields` additionally calls removed APIs — tracked separately in
`BUG_20260909_tune_panel_tests_call_appState_APIs_that_no_longer_exist.md`; that is a distinct
defect in the same spec and does not go away with a better fixture.

## Verification

```
$ npx playwright test packages/ui/test/logic --workers=1
  15 failed
  44 passed (11.7m)
$ grep -c ERR_CONNECTION_REFUSED <run output>
0
```

The zero connection-refused count is what makes this total trustworthy — see
`BUG_20260909_the_playwright_vite_server_dies_mid_run_and_fakes_hundreds_of_failures.md`.
