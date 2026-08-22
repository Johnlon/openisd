# No parity golden for `solve-from-mms-cms` — WinISD crashes capturing it

## Status
OPEN — blocked by a WinISD-side crash under wine, not by a harness gap.

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

`scripts/qo8_parity_generator.py` opens the Driver Editor as the first step of its capture
procedure. On this scenario the driver still has unresolved T/S fields at that point, which is
`BUG-004`'s exact trigger (`winisd_research/DISCOVERIES.md:41`). The result is an unrecoverable
crash:

    WinISDDied: winisd exited rc=40; log tail:
      err:seh:dispatch_user_callback ignoring exception c000008e
      err:seh:NtRaiseException Exception frame is not in stack limits => unable to dispatch exception.

Wine cannot unwind an exception raised inside a nested callback stack, so the process is gone.
`BUG-004`'s own recovery note (`DISCOVERIES.md:47`) records that OK does not recover. There is no
dialog to dismiss and no harness change that can make this clickable.

The driver is still unresolved when the editor opens because WinISD's own recalc does not finish
deriving the reverse-solve fields — it reaches `Vas` and traps before `Fs` and everything
downstream of it.

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
