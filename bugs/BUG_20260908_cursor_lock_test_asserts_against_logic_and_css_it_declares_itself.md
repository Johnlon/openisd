# cursor-lock.test.ts asserts against logic and CSS it declares itself, so 7 of its 8 tests prove nothing

Status: OPEN

## Symptom

`packages/ui/test/logic/cursor-lock.test.ts` reports 8 passing tests. Seven of them import nothing
from the app and exercise no app code: they copy the logic under test into the test body, or search
string literals the test itself just wrote, then assert on the copy.

They pass whatever the application does. Deleting the cursor-lock feature, the frequency nudge
buttons, the SKU-over-model rule, and both CSS rules would leave all seven green.

Three of them are the only tests naming cursor lock at all, so the click→lock→unlock behaviour has
no coverage while appearing to have three tests' worth.

## Evidence

The CSS pair (lines 109-118, 125-131) builds the rule strings, then searches those same strings:

```ts
const cssRules = [
  '.de-comment { display: flex !important; ... width: 100% !important; }'
];
const rule = cssRules.find(r => r.includes('.de-comment') && r.includes('width: 100% !important'));
assert.ok(rule, 'CSS rule for .de-comment must constrain width to 100% !important');
```

No stylesheet is read. The array is the test's own literal.

The three cursor-lock tests (lines 13-70) paste the component's `if/else` chain into the test and
then assert on the variables that chain just set:

```ts
if (presentationState.cursorLocked && presentationState.pinnedF !== null && Math.abs(...) < 0.02) {
  presentationState.cursorLocked = false;
} else if (presentationState.cursorLocked) {
  ...
}
assert.equal(presentationState.pinnedF, 100);
assert.equal(presentationState.cursorLocked, true, 'First click on unlocked chart locks cursor');
```

Nothing in `packages/ui/src` is called. Whatever the real click handler does is untested.

Lines 72-107 do the same with two local helper functions, `getEditorModelValue` and `spinHz`,
each described in its own comment as "replicating" or "Helper replicating" the app's logic.

The file's only genuine test is line 120, `rgAtDriverSide` defaults to false, which does call
`requireFocusedProject()`.

Scope check: `command grep -rln "Replicate\|replicating\|Helper replicating" packages/ui/test
packages/design/test` returns this file and `packages/ui/test/ui/driver-editor-units.test.ts`. The
latter is NOT affected — its `withinRegistryBounds` helper reads the real `fieldRegistry` through
`fieldById`/`byLabel` and asserts against real registry values, so it tests app data.

## Cause

Each of the seven was written by copying the behaviour out of the component instead of calling it.
That form always passes on first run, so it never showed the red that would have revealed it tests
nothing — the failure mode `.claude/skills/test-driven-development` names as "tautological": the
assertion recomputes the expected value the way the code does, so it can never disagree with the
code.

Two further reasons it stayed invisible: the file passes, so nothing draws attention to it; and its
name suggests cursor-lock coverage exists, so nobody wrote the real tests.

## Fix

Per test:

- **Three cursor-lock tests** — drive the real handler. The click logic lives in the chart
  component; the test must call it (or the composable it delegates to) and assert on
  `presentationState` afterwards. Cursor lock is user-visible, so per the project's functional-test
  rule this also needs a `*.browser.spec.ts` clicking a real chart.
- **`editorModelValue` / `spinHz`** — import the real implementations and delete the local copies.
  If neither is exported, that is the change to make: a behaviour worth testing is worth exporting.
- **Two CSS tests** — delete them. A string literal search proves nothing, and layout is a
  browser-test concern (`test/ui/visual.browser.spec.ts` already screenshots real rendering).
  Replace with a browser assertion on the computed style if the constraint matters.

Not applied here: it is new test authoring against components mid-migration, not a repair of
existing coverage, and the three cursor-lock tests need the real seam identified first.

## Verification

When applied: each replacement test must be watched FAILING first — break the behaviour it
covers, confirm red, restore. That step is what these seven never had.
