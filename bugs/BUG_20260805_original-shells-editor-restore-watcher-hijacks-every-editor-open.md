# BUG_20260805 — the Original shell's editor-restore watcher hijacks every editor open

**Status:** FIXED in the working tree this session. The fix was applied before this file was
written — reporting should have come first; see "Order of work" below.

## Symptom

In the **Original** skin, every route that opens the driver editor on something OTHER than the
project's driver is silently redirected at the project's driver.

What the user sees:

- **Add new Driver** (driver picker footer) opens an editor headed **"Edit My Driver"**. They
  fill in a brand, a model and the T/S parameters and press **OK**. Nothing is added to My
  Drivers. Instead **the project's own driver is replaced** by what they just typed — the
  design they had open is gone, with no prompt and no undo.
- **The ✎ on a My Drivers row** opens an editor headed **"Edit My Driver"** showing that saved
  driver. **OK** does not update the saved driver. It overwrites the project's driver with it.

In both cases the dialog TITLE says one thing and OK does another, which is the exact
ambiguity the title was added to remove.

The Modern skin is unaffected: only `OriginalShell.vue` writes `state.ui.originalEditorOpen`.

## Reproduction

1. Launch the app, skin = **original** (`localStorage['openisd.state'] = {"ui":{"skin":"original"}}`).
2. Note the project's driver in the read-only Brand/Model pair,
   `/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:955-957`.
3. Open the driver picker → **Add new Driver**.
4. Fill Brand `Bench`, Model `Hand Built`, and on the Parameters tab Fs / Vas / Re / Sd.
5. Press **OK**.

**Expected:** `localStorage['openisd_my_drivers']` gains a `Bench/Hand Built` entry; the
project's Brand/Model pair is unchanged.
**Actual:** `openisd_my_drivers` is unchanged; the project's Brand/Model pair now reads
`Bench` / `Hand Built`.

The same sequence with the ✎ on a My Drivers row instead of step 3 reproduces the second half.

## The code

The hijack — two watchers, one feeding the other:

`/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:672`

    watch(() => state.editDriverInfo, (open) => { state.ui.originalEditorOpen = open; });

`/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:673` (as it
stood before the fix)

    watch(() => state.ui.originalEditorOpen, (open) => { if (open) editProjectDriver(); }, { immediate: true });

What it hijacks — the editor's subject, a module-level variable in the selection composable:

- `/home/john/work/winisd/openisd/packages/ui/src/composables/useDriverSelection.ts:182` —
  `let subject: EditorSubject = { kind: 'project' };`
- `:185` `editMyDriver()` and `:206` `openNewDriver()` both set `subject` to
  `{ kind: 'myDriver', … }` and then set `state.editDriverInfo = true`.
- `:192` `editProjectDriver()` resets `subject` to `{ kind: 'project' }` and clears
  `editorDraft`.
- `:229` `acceptDriverEdit()` branches on `subject.kind`: `myDriver` saves into My Drivers,
  anything else calls `setDriverFromSerialized(json)` — the project.

And the title, which is read once at setup and therefore keeps saying the truth about how the
editor was OPENED while the subject underneath it has already changed:

- `/home/john/work/winisd/openisd/packages/ui/src/components/DriverEditorModal.vue:34,40`

## Root cause

`state.ui.originalEditorOpen` exists only so a refresh can REOPEN the editor. Line 672 mirrors
`state.editDriverInfo` into it on every ordinary open, so line 673's restore handler fires on
those opens too — and its action, `editProjectDriver()`, is a subject reset.

The component's `setup()` runs before that watcher's callback, so the title captured
`myDriver`; the subject was then swapped to `project` before the user reached OK. Title and
behaviour disagree because they are read at different moments.

The correct pattern is two watchers above, for the Tune panel
(`OriginalShell.vue:654-660`): its restore handler guards with
`!isDriverWhatIfActive.value`, so it only acts when the panel is NOT already open. The editor
watcher had no equivalent guard.

## Fix

Guard the restore handler on the editor not already being open —
`/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:678-680`:

    watch(() => state.ui.originalEditorOpen, (open) => {
      if (open && !state.editDriverInfo) editProjectDriver();
    }, { immediate: true });

On an ordinary open, `state.editDriverInfo` is already `true` when the mirrored flag lands, so
the handler stands aside and the subject survives. On a restore, the persisted flag arrives
while `state.editDriverInfo` is still `false`, so the handler runs and reopens the editor on
the project's driver exactly as before.

## Order of work

The fix was applied at the moment the cause was identified, and this report written
afterwards. That is the wrong order: had the session ended in between, the defect would have
been lost. Recorded here rather than quietly corrected.

## **Evidence (artifact checked this session):**

- **The failing test, run before the fix.** `npx playwright test
  packages/ui/test/my-drivers.browser.spec.ts` — `Add new Driver saves the new driver into My
  Drivers and leaves the project alone` failed with the saved list containing only the seeded
  `Spec/Fixture` and not `Bench/Hand Built`, verbatim:

      - Expected  - 1
      + Received  + 0
        Array [
      -   "Bench/Hand Built",
          "Spec/Fixture",
        ]

  The sibling test in the same run — asserting the editor opens titled "Edit My Driver" with
  OK disabled — PASSED, which is what places the swap after `setup()` and before OK.
- **The two watchers**, read directly at
  `packages/ui/src/shells/original/OriginalShell.vue:669-673` before editing.
- **`grep -rn "editDriverInfo" packages/ui/src`**, which established that
  `OriginalShell.vue:672` is the only writer of `state.ui.originalEditorOpen`, hence that
  Modern and Classic cannot reproduce this.
- **`useDriverSelection.ts` read in full**, giving the `subject` lifecycle at lines 182, 185,
  192, 206, 229.
- **The same Playwright test re-run after the fix** — see the session report for the result.
