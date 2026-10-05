# BUG_20261005_winisd-vccon-editor-combo

**Status:** RECORDED — WinISD bug (broken link in the Driver editor, not a calculation difference),
probed 2026-10-05. OpenISD does not copy it.

## What it is
WinISD's voice-coil connection combo (`edConMode`) and the file's `VCCon` can disagree:

1. **One coil:** with `numVC=1`, picking Series shows Series, but the saved file has `VCCon=1` and
   reloads as Parallel. Nothing else changes, because the wiring factor is 1.
2. **Coil-count edit:** picking Series rescales `Re` ×numVC² and `BL` ×numVC. Editing `numVC`
   afterwards resets the combo to Parallel without undoing that rescale, so the file says parallel
   beside series-scaled values. Choosing Series again rescales a second time.

Saving and loading are otherwise correct: Series with numVC 2–4 saves `VCCon=2` and reloads as
Series; loading never rescales `Re`/`BL`; ParState slot 46 stays `N` whatever the wiring.

## Evidence
`winisd_research/toys/probe_vccon_save_load.py`, runs in `winisd_research/runs/vccon-probe-20261005/`,
"FINDING 2026-10-05: VCCon save/load" in `winisd_research/PROBE_FINDINGS.md`. The June 2026 file
`drivers/myprobes/per_field_and_misc/s-connection-serial-2vc.wdr` (`VCCon=1`) is case 2.

## OpenISD
Stores `Re`/`BL` per coil and derives the terminal values from the wiring, so a coil-count edit
cannot leave them out of step; writes the wiring the user chose; always marks `VCCon` `E`.
`docs/research/WINISD_PARITY.md` §12.
