# BUG_20261003_winisd-pr-sd-edit-ignored

Status: WinISD bug (broken internal link, NOT a calculation difference), probed 2026-10-03. OpenISD
does not copy it: a typed PR Sd takes effect.

## What it is
WinISD's PR Sd edit box is not linked to the model. Its excursion calculation does use Sd: the same
project saved with Sd 0.019 instead of 0.0095 and loaded draws a different Cone excursion (PR)
chart. But typing 0.019 into the Sd box changes nothing: the box reads back 0.019, WinISD recomputes
no chart points, and the chart is pixel-identical, also after a forced redraw (another chart, then
back). The formula is not the difference. The edit never reaches it.

## Evidence
`winisd_research/toys/probe_pr_sd_edit.py`, headless; W5 + PR, Vas 0.0048, Qms 3.3, Fs 30.
- `runs/pr-sd-edit-1`, `-2`: Sd 0.0095 loaded, 0.019 typed: chart unchanged.
- `runs/pr-sd-load-1`: Sd 0.019 loaded: chart differs from Sd 0.0095 loaded
  (`runs/pr-sd-edit-1/before.png`).
Finding: `winisd_research/PROBE_FINDINGS.md`.

## OpenISD
A PR Sd edit takes effect. With Fs, Qms and Vas fixed the PR's mass, compliance and loss do not
change, so Transfer function and SPL stay put; Cone excursion (PR) and the PR air velocity chart
scale as 1/Sd.

## Other fields (probe `winisd_research/toys/probe_pr_sd_edit.py field=...`)
- Fs: LINKED. Typing 30 → 20 changes Transfer function (PR) at once and both PR charts after a
  redraw (`runs/pr-Fs-edit-1`).
- Qms: LINKED. Typing 3.3 → 1.5 changes Transfer function (PR) at once (5864 px) and both PR charts
  after a redraw (`runs/pr-Qms-edit-1`).
- Vas: edit route NOT probed, harness cannot type into the Vas box (three failure modes in
  `PROBE_FINDINGS.md`). Load route: Vas in the file moves both PR charts (`runs/pr-Vas-load-1`).
  Whether the Vas edit is linked in WinISD is unknown.

## Not probed
- The edit was typed character by character; PARITY §18 documents a recalculation-trigger lag for
  typed edits and the cut-and-paste trigger was not tried.
- The Vas edit route, and the file-load route for Fs and Qms (an edit that moves the chart on its own
  shows the field is linked, so the load run was not needed).
