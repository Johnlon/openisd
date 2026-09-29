# BUG_20260929_wpr_writer_end_correction_default_is_not_winisd

**Status:** RESOLVED

## Symptom
OpenISD's `.wpr` export writes `endcorrection=0.6` for a vent section. WinISD never writes 0.6; every
WinISD-saved `.wpr` carries `endcorrection=0.732` in all three vent sections.

## Evidence
Checked 2026-09-29 (engine session findings, re-read here):
- `winisd_research/lib/wdr.py:60`: the harness's own `.wpr` writer hard-codes `endcorrection=0.6`.
- `packages/design/test/winisd/fixtures/winisd-parity/goldens/vented-small.wpr` and `bandpass4.wpr`:
  `Creator=winisd_research overnight harness` — our writer, not WinISD.
- `winisd_research/runs/env_sample5.wpr` (Creator blank) and `closed_align_4.wpr` (Creator=john),
  both WinISD-saved: `endcorrection=0.732` ×3.
- `packages/design/winisd/winisdProject.ts:36` TEMPLATE: `['endcorrection', '0.6']`.
- Engine: no WinISD-saved file has 0.6 (371 harness files carry it).

## Cause
BUG_20260820 grepped goldens our own writer produced and concluded 0.6 was WinISD's default, then
set the exporter's default to 0.6. Circular. The address 0x5dac48 (once cited for a 0.6 constant) is
unverified either way.

## Fix
Change the TEMPLATE and any exporter default to 0.732. Regenerate fixtures and goldens whose 0.6
came from the harness writer, and fix the writer at `wdr.py:60`. Re-check which tests assert 0.6.

## Verification
A WinISD-saved `.wpr` round-trips with `endcorrection=0.732` unchanged; no test asserts 0.6 as
WinISD's value.

## Resolution (2026-09-29)
- `TEMPLATE` in `packages/design/winisd/winisdProject.ts` now defaults `endcorrection` to 0.732.
- The four goldens that `winisdProject.test.ts` compares the writer against (`passive-radiator`,
  `vented-small`, `bandpass4`, `vented-b4`) had their three `endcorrection=0.6` lines changed to
  0.732 (red first: the four comparisons failed, then passed with the template change).
- Left alone: `winisd_research/lib/wdr.py`, `runs/`, and the other 11 goldens (inputs to WinISD).
- `packages/design/test/winisd` 1118/1118.
