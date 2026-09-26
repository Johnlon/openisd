# Two solver tests assume a blank driver and fail against a real one

Status: RESOLVED (re-verified 2026-09-26) — both tests run against the complete-driver fixture and pass.

## Symptom

With the startup path repaired
(`BUG_20260909_a_first_visit_opens_with_no_project_so_thirty_browser_tests_time_out.md`),
`driver-editor-solver.browser.spec.ts` runs 27 tests: **25 pass, 2 fail.**

Both failures are the same shape — a field expected to be empty holds a real value:

```
Error: expect(locator).toHaveValue(expected) failed
  - waiting for locator('.de-fld:has-text("Fs") input')
    locator resolved to <input … value="26.93" class="de-input-mandatory value-c" />
       - unexpected value "26.93"
```

Failing tests:

- `:251` — "UI un-calculates downstream derived fields back to state N when an anchor is cleared"
- `:408` — "UI rejects non-numeric literal text (\"banana\", \"<script>\") and clears field to
  state N (empty/Not Available) without crashing JS execution"

## Example

```ts
// packages/ui/test/logic/driver-editor-solver.browser.spec.ts:411
await fsf.evaluate((el: HTMLInputElement) => {
  el.value = 'banana';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await fsf.blur();

await expect(fsf).toHaveValue('');
await expect(fsf).toHaveClass(/value-n/);
```

`26.93` is the Fs of the driver the project actually holds (Accuton AS168-9-470, the first row
of the picker). The field did not clear — it kept the driver's own value, and its class is
`value-c` (calculated), not `value-n`.

## Impact

The editor's behaviour on invalid input is unproven either way. Two readings, and the tests
cannot distinguish them because they were written against a project whose driver had no values:

1. **The editor is right.** Rejecting "banana" and reverting to the field's real value is
   correct — an unparseable keystroke should not destroy a driver's Fs. Then these two tests
   encode the wrong expectation.
2. **The editor is wrong.** Invalid input should clear the field to Not-Available, as the test
   names say. Then this is a live defect in the driver editor's input handling.

Until it is ruled, "what happens when a user types nonsense into a driver field" has no
trustworthy test.

## Cause

The tests predate the no-seed-project ruling. They were written when a fresh load produced a
project whose driver was blank, so "the field is empty afterwards" was indistinguishable from
"the field reverted to its (empty) prior value". Now that a project can only exist with a
driver chosen from the picker, every field starts populated and the two readings separate.

The startup repair did not cause this — it revealed it.

## Fix

John's call, because it is a behaviour question, not a repair:

- If reverting is correct, the two tests assert the revert (field keeps the driver's value,
  class stays `value-c`) and are renamed to say so.
- If clearing is correct, `DriverEditorModal.vue`'s input handling is the defect and these
  tests stay as the specification of it.

Not guessing: changing the assertions to match observed behaviour would be writing the value
the gate wants while the thing it guards may be broken.

## Verification

```
npx playwright test packages/ui/test/logic/driver-editor-solver.browser.spec.ts --workers=1
25 passed, 2 failed (3.0m)
```
