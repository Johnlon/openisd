# BUG_20261019_winisd-vent-end-correction-edit-not-taken

**Status:** RECORDED — WinISD trigger/linkage bug, no switch, not copied.

## Symptom
In WinISD's Vents tab the End correction combo ("Two free ends", "One flanged end", "Two flanged ends", also freely typeable) does not take an edit. Typing 0.85, or picking an item by keyboard or mouse, with or without Tab: the vent length, the saved `endcorrection` and every chart stay as loaded, and the project stays clean (Save refuses: not dirty). On load the box shows 0.732 even where the file says `endcorrection=0.6`.

## Evidence (winisd_research)
- `runs/t429-e150-vented-edit-ventendcorr` (E150HE-44, 36 Hz, 50 mm, 10 L) and `runs/t429-w5-vented-edit-ventendcorr`: typed 0.85; saved `endcorrection` stays 0.732 and all charts match the unedited base. The e150 run's vents-tab length read 0.417 against the loaded 0.4157 (saved `len` 0.41670 vs 0.41569), a 1 mm move that is not explained by the unchanged end correction and was NOT reproduced.
- Batch 4 pick run: winisd_research `runs/t429b4-dump4-vented` (commit 1449058). Loaded endcorrection 0.6, mouse pick of "Two flanged ends": after.wpr still says 0.6 in all three vent sections. Two other pick runs (one flanged end from 0.732; a pick that left Save refusing "not dirty") were not kept.
- Settling capture: batch 5 (`t429-w5-vented-load-endcorr06`, `-0732`, `-085`), the same project loaded with each value, no edit.
- A loaded value IS used: a project with `endcorrection=0.6` (the combo showing 0.732) has WinISD solve vent lengths against 0.6, not 0.732 — Vb 20 L, Fb 40 Hz, d=5 cm gives 0.154 m (k=0.6 fits to -0.3 %, k=0.732 to -4.6 %); d=7.6 cm saved `len=0.37856`. Source: `PROBE_FINDINGS.md` (vent geometry probe, saved file), `parity/GAPS.md` table; `runs/ventshape-*` readbacks.

## Cause
Class: trigger/linkage bug. The same value entered by hand (no effect) and loaded from a file (used) gives different results. Not a calculation difference, not an ignored input. The control also fails to show a loaded value (0.732 shown, 0.6 used).

## Settled (batch 5, 19 Oct 2026)
The same W5 vented project (Fb 38 Hz, 10 L, 5 cm vent) loaded with rear `endcorrection` 0.6, 0.732 and 0.85, nothing typed: saved vent length 0.376838, 0.370238, 0.364338 m. Each step equals the end-correction change x the 5 cm diameter (0.132 x 0.05 = 0.0066; 0.118 x 0.05 = 0.0059). Charts are identical across the three (Fb is fixed; only the length moves). So WinISD uses a loaded value and ignores a typed or picked one: the linkage class stands. Runs: winisd_research `runs/t429-w5-vented-load-endcorr06`, `-0732`, `-085`.

## Fix
OpenISD honours the value: `endCorrection_m` is an input to the solved vent length (L = tuning length - k x d). No switch. Pinned by `packages/design/test/domain/project-vent-length.test.ts` "a bigger end correction shortens the pipe for the same tuning by dk x diameter". A linkage bug gets no switch and no Difference cue: OpenISD does the correct thing.

## Verification
`bash scripts/test.sh packages/design/test/domain/project-vent-length.test.ts` passes. The earlier claim "WinISD's length moves the wrong way after an end-correction edit" (bug deleted in ae75c39c) was a mis-read: WinISD did not take the edit.
