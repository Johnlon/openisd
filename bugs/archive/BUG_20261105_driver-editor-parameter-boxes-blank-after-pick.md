# BUG_20261105_driver-editor-parameter-boxes-blank-after-pick

**Status:** NOT A DEFECT (QO424, John 5 Nov 2026). A box the datasheet never states may stay empty, unless the engine can calculate it or charting needs it.

## Symptom
Pick a bundled driver in the New project wizard, make the project, open the Driver tab > Edit > Parameters (desktop). Some number boxes are empty
after the pick, with nothing calculated into them. Seen on the 8 bundled test records (E150HE-44, E180HE-44, W5-1138SMF, 10FE200-4, 12PR300-8,
Sigma Pro 18A, CX120-8):
- `fLe_hz` and `KLe_H_sqrtHz` (the Le model boxes): blank on every driver.
- `Xlim_m`, `Hg_m`, `Hc_m`: blank on 5 of the 8 (the record states none).
- `power_peak_W`: blank on 3; `Pe_W`: blank on 1 (the record states none).

The phone Driver tab and the passive radiator page (both skins) show no blank box after the same picks.

## Verdict (QO424)
No field breaks the rule:
- `KLe_H_sqrtHz` = Le*sqrt(2*pi*fLe): needs `fLe_hz`, which no record states. Not calculable.
- `fLe_hz`, `Xlim_m`, `power_peak_W`: no engine route, no chart uses them.
- `Hc_m`, `Hg_m`: calculable only from Xmax plus the other one; the 5 records state neither. Max-cost uses 0 when absent.
- `Pe_W`: absent with Xmax stated still bounds Max SPL; no chart is stopped.

## Test
`packages/ui/test/ui/new-project-pick-fills-journey.browser.spec.ts`, "desktop ... every box holds a value": fails only for a blank box the
record states, the engine calculates, or charting needs (`mustNotBeBlank`). The `test.fail` is removed.
