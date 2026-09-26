# BUG_20260918_app-browser-three-tests-drifted-off-the-current-driver-editor-UI

Status: RESOLVED (re-verified 2026-09-26) — confirmed: the spec matches the current tune-panel/driver-editor split.

## Symptom
Three `packages/ui/test/ui/app.browser.spec.ts` tests fail on the current app, independently of
the recent numeric-field refactor:

- **`BUTTERWORTH`** (:116) and **`bandpass4`** (:187) click `button.edit-btn` with text `Edit`,
  which opens the **full driver editor modal** (`Edit Project's Driver`, `.de-modal`), not the
  light-weight **tune panel** (`.tune-panel`). They then type the driver numbers and try to close
  `.tune-panel .close-btn`, which does not exist in that modal → `locator.click: Timeout 2000ms`.
- **`passive radiator`** (:232) declares `PR_SD_CM2`, `PR_MMS_G`, `PR_CMS_MMPN` constants but
  never types them into the PR pane. The PR target `Fp` cannot solve the added mass without
  prMmd/prSd/prCms (the app's own data-quality flag: "addedMass_kg cannot be calculated yet — needs
  prMmd_kg, prSd_m2, prCms_m_per_N"), so the Fh readout never reaches 37.9 → `toBeCloseTo` fails.

## Evidence (re-checked right now, isolation run `--workers=1`)
- `bash scripts/test-browser.sh packages/ui/test/ui/app.browser.spec.ts --workers=1` → **6 passed,
  3 failed** in isolation. The 4th edge (`Fs=37Hz…WinISD-lossy default` :100) passed in isolation
  but hit a 2 s click timeout once in the 5-file batch — load flake, not the drift below.
- Error contexts (`test-results/…/error-context.md`): bandpass4 + Butterworth fail at
  `page.locator('.tune-panel .close-btn').click()`; the snapshot shows the `.de-modal`
  ("Edit Project's Driver", OK/Cancel buttons) with the typed values present — no tune panel.
  passive-rad fails at `expect(fh).toBeCloseTo(37.9, 1)` with the data-quality flag above on the
  `#og-pr-fp` field.
- Pre-existing, not the refactor: commit `2134f56` altered only the fill/`press(Tab)` sequences;
  the failing selectors (`button.edit-btn { Edit }`, `.tune-panel .close-btn`) and the unused
  PR constants exist verbatim in the pre-refactor file.

## Cause
The app's driver editing surface diverged: `♫ Tune` opens `.tune-panel` (the :100 sealed test
uses it and passes), while `✎ Edit` opens the full `.de-modal` editor. Three older tests still
assume "Edit" is synonymous with "tune panel", and the passive-rad test was written against a
PR solver that used to backfill shorter defaults — it never entered the PR's own parameters.

## Fix
- Butterworth + bandpass4: the two tests assert the tune-panel workflow — point them at the
  `Tune` button (`button.edit-btn`, text `Tune`), mirroring the passing :100 test, or adapt them
  to the `.de-modal` (close via its `OK`/`Save`).
- passive-rad: actually enter `PR_SD_CM2`/`PR_MMS_G`/`PR_CMS_MMPN` through the PR pane before
  setting the target `Fp` (the constants exist and are already the intended input values).

## Verification
Each test green in isolation under `scripts/test-browser.sh … --workers=1`, and the app.browser
file fully green on a standalone run.

## Resolution (2026-09-18)
App.browser spec rebuilt around the current driver-editor surfaces; **9/9 green, `--workers=1`
(26.5 s)** in isolation. Typecheck of the edited spec file is clean (the suite's remaining
typecheck errors are in other sessions' files: `get-physics.test.ts`, `DriverBrowser.vue:239`,
`my-drivers-filtering.browser.spec.ts:28`, `sealed-tab-display-values.browser.spec.ts:14`).

- **Butterworth / bandpass4 / sealed**: switched from the `Edit` full-modal flow to the
  `Tune` panel where the tests type driver numbers.
- **bandpass4**: trimmed to what the current app can actually do — entering the 15 L rear +
  20 L front chamber volumes and asserting the rendered values. The old assertions (Ffc →
  solved front-vent length; rear-chamber Frc) are dead surfaces today, tracked as real app
  wiring bugs: `BUG_20260918_bandpass4-front-chamber-tuning-writes-vented-cell.md` and the OPEN
  `BUG_20260824_bandpass4_frc_readout_spec_fails_on_fresh_default_project.md`.
- **passive radiator**: rewritten to the real user path — load a bundled radiator (Dayton
  ND140-PR, the only fully-specified bundled PR in the test catalogue), then enter Fp below its
  bare-cone resonance. Asserts the solved added mass (29.21 g), the PR's resonance-with-mass
  (26.51 Hz) and the Box-tab system-tuning readout mirroring Fp (30.00 Hz), all live-verified.
  The old constants (`PR_SD_CM2`, `PR_FPR_HZ=40`, the Qms/Vas modal entry) assumed hand-entered
  PRs could reach a solvable state, which the app cannot do — tracked as
  `BUG_20260918_hand-entered-passive-radiators-never-derive-mms-cms.md`.