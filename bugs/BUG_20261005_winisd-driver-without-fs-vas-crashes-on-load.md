# BUG_20261005_winisd-driver-without-fs-vas-crashes-on-load

**Status:** RECORDED — WinISD bug, found 2026-10-05. Not copied. A crash is a trigger bug: never copied, no switch.

## Symptom
WinISD dies about 1.5 s after loading a project whose driver has `Fs` and `Vas` at 0 (the scenario
`solve-from-mms-cms`: Mms, Cms, BL, Re, Qms and Sd entered, the rest to be derived). Nothing is
typed. Under Wine the process exits (rc=40, `err:seh:dispatch_user_callback ignoring exception
c000008e`, FLT_DIVIDE_BY_ZERO). Real Windows was not tested.

## Cause
The fault is a divide at `0x462636` in the box-Fsc routine `0x462480`, called from the sealed-box
chart routine `0x4618f0` on the first paint. It computes `Cat = 1/(1/Cab + 1/Cas)` with Cas = 0.
The simulation's copy of the driver holds Fs, Vas, Qes, Qts and Rms at 0 (Mms, Cms, BL, Re, Qms and Sd
present). `fr_45e090` builds Cas from Vas only when Fs > 0 and Vas > 0, and nothing derives the
missing fields on load. Wine cannot unwind an exception raised inside a paint callback.

## Workaround
Enter the fields in the standalone Driver editor (it draws no chart): WinISD's solver then derives
Fs 37.2, Qes, Qts, Rms, Vas and the advanced fields without faulting.

## Rule
OpenISD derives the missing fields from the entered ones and never crashes.

## Evidence
`winisd_research`: `runs/sweep-mms-cms-load-crash.json`, `PROBE_FINDINGS.md` "FINDING 2026-10-05:
solve-from-mms-cms". Golden: `packages/design/test/winisd/fixtures/winisd-parity/goldens/solve-from-mms-cms.wpr`.
