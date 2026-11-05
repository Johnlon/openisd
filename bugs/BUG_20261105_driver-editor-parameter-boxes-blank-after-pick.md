# BUG_20261105_driver-editor-parameter-boxes-blank-after-pick

**Status:** RECORDED — found by the T687 journey spec (QO326: "every box on screen must fill"). Not fixed. Open question for John: which of these boxes may legitimately stay empty.

## Symptom
Pick a bundled driver in the New project wizard, make the project, open the Driver tab > Edit > Parameters (desktop). Some number boxes are empty
after the pick, with nothing calculated into them. Seen on the 8 bundled test records (E150HE-44, E180HE-44, W5-1138SMF, 10FE200-4, 12PR300-8,
Sigma Pro 18A, CX120-8):
- `fLe_hz` and `KLe_H_sqrtHz` (the Le model boxes): blank on every driver.
- `Xlim_m`, `Hg_m`, `Hc_m`: blank on 5 of the 8 (the record states none).
- `power_peak_W`: blank on 3; `Pe_W`: blank on 1 (the record states none).

The phone Driver tab and the passive radiator page (both skins) show no blank box after the same picks.

## Expected
Each box shows the record's figure, or a value the app calculates from the others, or the screen does not offer the box. A box the screen
shows must not be empty.

## Test
`packages/ui/test/ui/new-project-pick-fills-journey.browser.spec.ts`, "desktop ... every box holds a value": `test.fail` naming this bug,
one per case. When the boxes fill (or are hidden) the test starts passing and Playwright reports the `test.fail` as an error; delete the
`test.fail` then.
