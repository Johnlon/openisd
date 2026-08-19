# Browser suite is RED: 14 specs wait for a `.skin-picker` that no longer exists

# Status
OPEN

## Symptom

Every browser spec whose `beforeEach` selects a skin times out after 60 s. Observed by
running the narrowest case:

    npx playwright test packages/ui/test/ui/bottom-scroll.browser.spec.ts --workers=1

    Test timeout of 60000ms exceeded while running "beforeEach" hook.
    Error: locator.selectOption: Test timeout of 60000ms exceeded.
    Call log:
      - waiting for locator('.skin-picker select')
    > 11 |   await page.locator('.skin-picker select').selectOption('original');

## Evidence

- `.skin-picker` appears nowhere under `packages/ui/src` — only in `packages/ui/test` and
  `packages/ui/inspect-styles.js`.
- `packages/ui/src/ui/App.vue` renders one shell unconditionally:

      import OriginalShell from './shells/original/OriginalShell.vue';
      ...
      <OriginalShell />

- `packages/ui/src/ui/shells/` contains `original/` and nothing else.
- 14 spec files, 30 call sites:

  `original-layout`, `advanced-environment`, `original-projects`, `original-tuning-target`,
  `bottom-scroll`, `original-loss-mode-selector`, `sealed-fsc-winisd-golden`,
  `original-narrow`, `whatif-auto-cancel-on-export`, `original-skin`, `consistency-dq`,
  `whatif-panel-fields`, `driver-editor-mandatory`, `whatif-panel-shots`.

## Cause

The Classic and Modern shells were deleted and `App.vue` reduced to a single shell, but the
picker control the specs drive was deleted with them. The specs still open the app and wait
for a `<select>` that is never rendered, so they fail in `beforeEach` before reaching a
single assertion.

Selecting `'original'` is now meaningless — there is nothing to select between.

## Second, distinct failure in the same set

Four tests do not merely select a skin, they exercise the deleted Classic shell's inline
what-if panel via `selectOption('classic')` and `.cl-whatif`:

| file | line | test |
|------|------|------|
| `test/logic/consistency-dq.browser.spec.ts` | 119 | `Classic what-if: the mark is the same one, from the same model` |
| `test/logic/consistency-dq.browser.spec.ts` | 184 | `Classic what-if: hovering or clicking the alert icon displays the custom formatted tooltip` |
| `test/logic/whatif-panel-shots.browser.spec.ts` | 54 | `shots: Classic inline what-if panel` |
| `test/logic/whatif-panel-fields.browser.spec.ts` | 216 | `Classic inline What-If panel: Bl/Mms editable, Vb present, Q trio marked, fields narrow` |

They target `DriverWhatIfPanel.vue`, which does not exist. There is no component left for
them to cover.

## Fix

1. Delete the `page.locator('.skin-picker select').selectOption('original')` line from all
   30 call sites. Nothing replaces it: the app boots into the only shell there is, and the
   `.original-root` wait that already follows it is the real readiness check.
2. Delete the four Classic-panel tests outright.

## Verification

The affected specs run to their assertions instead of timing out in `beforeEach`.
