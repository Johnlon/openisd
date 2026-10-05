# No parity golden for `solve-from-mms-cms` — WinISD crashes capturing it

## Status
FIXED 2026-10-05 — the golden exists (`goldens/solve-from-mms-cms.wpr`, captured by WinISD itself through
the standalone Driver editor) and the parity tests compare it. WinISD's crash on loading such a
driver is its own bug: `bugs/BUG_20261005_winisd-driver-without-fs-vas-crashes-on-load.md`.

## Symptom

`packages/winisd/test/winisd-parity.test.ts` has 15 goldens for 16 scenarios. The missing one is
`solve-from-mms-cms`. 29 scenario rows stay red, plus the two guard tests that count goldens and
provenance rows.

Those two guard tests are doing their job — they exist so a missing measurement is loud rather
than silently skipped. Neither is loosened.

## What is distinctive about this scenario

`packages/winisd/test/fixtures/winisd-parity/scenarios.json`, scenario `solve-from-mms-cms`, runs
the consistency solver in REVERSE: `Fs`, `Qes`, `Qts`, `Rms` and `Vas` are all omitted and must be
derived from `Mms`, `Cms`, `BL`, `Re`, `Qms` and `Sd`. It is the only scenario that leaves `Fs`
absent.

Its forward twin `solve-from-q-pair` captures cleanly in ~15 s on the same wine prefix and the same
`winisd.exe` (0.7.0.0, sha256 `a7dab233…6df386ae`).

## Cause
Not the Driver editor. WinISD dies when it LOADS a project whose driver has Fs and Vas at 0, at the
first chart draw, because nothing derives the missing fields on load (rc=40, c000008e; the capture
script's generated input crashes the same way with nothing typed). The editor route works: load a
`.wdr` holding only the scenario's entered values into the toolbar's blank standalone Driver editor
(it draws no chart), retype `Le` as itself, and WinISD's solver fills in Fs, Qes, Qts, Rms, Vas and
the advanced fields without faulting. Evidence: `winisd_research/runs/mms_cms_golden/`,
`runs/sweep-mms-cms-load-crash.json`, `runs/sweep-mms-cms-golden-editor-route.json`, and
`PROBE_FINDINGS.md` "FINDING 2026-10-05: solve-from-mms-cms".

## Two things that must not be done

**No hand-captured substitute.** A file captured by pressing through the fault at
`/mnt/c/tmp/solve-from-mms-cms1.wpr` is an interrupted recalc, not a golden: only
`Vas=0.0291887297703274` is genuinely computed (verified against `roo·c²·Sd²·Cms` with
`roo=1.20095217714682`, `c=343.684120962153`, `Sd=0.0132`, `Cms=0.00118092600256716`, matching to
12 significant digits), while `Fs`, `Qts`, `Qes`, `Rms`, `no`, `Dd`, `EBP`, `SPLmax`, `SPLmaxLF`,
`USPL`, `gamma`, `Rme`, `Mpow` and `Gloss` are all `0`, and `ParState` reads uniformly `E` across
all 49 positions including those zeros. Using it would teach the parity suite to expect zeros
where a healthy computation has real values — worse than no golden, because it would look like a
real one. It is kept at that path as evidence of the crash mechanism only.

**No substituted or synthesised golden.** A golden is WinISD's own output. A missing measurement
is reported missing.

## Fix

The capture procedure must reach a fully-computed state without opening the Driver Editor on an
unresolved driver — either by resolving the driver first, or by a capture path that does not open
the editor at all.

A second scenario is worth adding alongside this one, not instead of it: an input shape WinISD
will open that still exercises the reverse routes (for example omitting `Vas` and `Rms` only,
keeping `Fs` present).

## Verification

A clean golden for `solve-from-mms-cms`: every "Computed by WinISD" field genuinely non-zero and
consistent in shape with the other 15 goldens, `ParState` showing a real mix of `E`/`C`/`N`. The
29 scenario rows and both guard tests then pass.
