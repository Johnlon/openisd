# `sample_project_Epique15_-_pr.wpr` is not WinISD-generated but is treated as if it were

# Status
OPEN

## Symptom

`docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr`'s `[PassiveRadiator]` block states
`Xmax=19` — a real 19mm excursion written as a bare millimetre number, where every genuine
WinISD-written `.wpr` states this field in metres (`Xmax=0.019`), confirmed against the
harness-generated, sha256-pinned golden at
`packages/winisd/test/fixtures/winisd-parity/goldens/passive-radiator.wpr`. Every other field in
the same block (`Vas`, `Qms`, `Fs`, `Sd`, `Me`) is correctly SI. `packages/winisd/test/classic/
wpr.test.ts` had been asserting this file's `Xmax=19` as WinISD-correct.

## Cause

Investigated in `winisd_tools` (2026-08-21,
`BUG_20260820_epique15_sample_wpr_carries_xmax_in_mm_not_metres.md`): `grep -rl
"PassiveRadiator" scrapers/` there returns zero hits — winisd_tools has no code path that emits
`.wpr`/`[PassiveRadiator]` output at all, ruling out "a winisd_tools emitter wrote it wrong." By
elimination, this sample file was hand-authored or hand-edited, not WinISD-written, and does not
meet this project's own oracle rule (SPEC_ENGINE §4.7: "the ONLY oracle is one WinISD ITSELF
wrote").

## Fix

Not applied. Mark the file as non-authoritative wherever it is referenced — any test asserting a
value from this file as "what WinISD does" needs re-pointing at the real harness-generated
golden (`passive-radiator.wpr`) instead, the same fix already applied to
`packages/winisd/test/classic/wpr.test.ts` per this bug's own discovery trail (per the
winisd_tools bug file: "repointing that test at the harness-generated golden surfaced the
discrepancy" — confirm whether that repointing is complete or partial).

## Verification

Not yet — no fix applied.
