# BUG_20261120_sensitivity-at-2p83v-stored-as-1w-spl

**Status:** FIXED in code (T940); the catalogue's openisd.json files are not yet regenerated.

## Symptom
A sensitivity the maker prints at 2.83 V / 1 m is shown as the 1 W / 1 m SPL. SB Acoustics SB23NRXS45-4 prints 92 dB at
2.83 V / 1 m, Re 3.3: the app shows SPL 92 (entered) and USPL 95.85 (calculated); the 1 W figure is 88.15 dB, so SPL,
USPL and SPLmax are 3.85 dB high. About 1000 catalogue records print their sensitivity at 2.83 V; on a 2 ohm driver
(Dayton Audio RSS265HO-44, Re 1.6) the error is 6.99 dB, on a 16 ohm one it is negative.

## Cause
The scraper records the reading with its condition (`note: 2.83V/1m`). The bridge's projection
(`domain/driverRecordConverter.ts`) copied every sensitivity reading into `SPL_dB` whatever its note, and nothing compared a
stated sensitivity with the one the T/S efficiency implies.

## Ruling
QO962 (John, 20 Nov 2026): "B: keep the printed 2.83 V figure; the engine works out the 1 W one (changes how drivers are
stored)".

## Fix (T940)
- `domain/driverRecordConverter.ts`: a sensitivity whose winning reading is noted 2.83V/1m goes into `USPL_dB`, entered as
  printed. A 1 W / 1 m figure stays `SPL_dB`; one printed with no condition stays `SPL_dB` (a separate open question).
- `engine/driver/routes/efficiencyRoutes.ts`: `SPL_dB = USPL_dB − 10·log₁₀(2.83²/Re)` runs ahead of the SPL from the
  efficiency, so SPL, SPLmax and the efficiency follow the stated USPL. WinISD has no such site.
- `engine/driver/routes/relations.ts`: a stated SPL or USPL is checked against the one the efficiency implies, within 2 % of
  the predicted dB plus every figure's printed rounding.
- winisd_tools `tools/catalogue_health_scan.py`: `sensitivity-condition` findings, allowed count zero.

## Tests
`packages/design/test/winisd/driverRecordConverter.sensitivityCondition.test.ts` (real records SB23NRXS45-4,
RSS265HO-44, B&C 12NDL88-8, Faital Pro 12PR300-8), `test/engine/driver-solve.test.ts`,
`test/engine/driver-consistency-check.test.ts`.
