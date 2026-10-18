# BUG_20261018_dual-coil-wpr-re-halved

**Status:** FIXED (T401)

Recorded 18 Oct 2026 by maryu (T393 captures).

## Symptom
A WinISD project whose driver has two voice coils wired in parallel (Dayton E150HE-44 from the driver
db: `numVC=2`, `VCCon=1`, `Re=6.6`, `BL=9.8`) simulates as a different driver in OpenISD: the
impedance at 20 kHz is 3.3 Ω where WinISD shows 6.6 Ω, SPL is 6 dB off at 28 Hz and excursion doubles.
The same driver with `numVC=1` matches WinISD to 1e-13.

## Evidence
- WinISD capture vs OpenISD sweep, same `.wpr`, sealed box: winisd_research `runs/e150-sealed-nv2`,
  record `runs/sweep-t393a-sealed-e150he44-numvc2.json`. Worst: Z 3.3 Ω, Z phase 17.4° at 168 Hz,
  SPL 6.02 dB at 28 Hz, excursion ×2 (2.95 mm at 1 Hz), max power ×0.5, max SPL 3.01 dB. TF mag/phase and GD match.
- With `numVC=1` (`runs/e150-sealed-1`, `-2`): Z ≤ 4.3e-14 Ω.
- The documented rule (`docs/research/WINISD_PARITY.md` §11b): a `.wdr`/`.wpr` `Re` and `BL` are
  terminal values; OpenISD divides by the wiring factor to store per-coil values, so the terminal
  values it simulates equal the file's. The capture shows OpenISD's terminal Re is half the file's.

## Cause
Verified. The `.wdr` and `.wpr` imports share one path (`winISDDriverToOpenISDDeviceJson`), so they
agree, and both were wrong in the same way:
- Import stored the file's `Re`/`BL` (terminal values) straight into the per-coil `Re_ohm`/`BL_Tm`
  with no division by the wiring factor; the simulation then applied the wiring a second time
  (parallel, 2 coils: terminal Re 3.3 instead of 6.6).
- Export wrote the per-coil values back as if they were terminal.
- The driver solver's relations (Qes, Rme, Mpow, and the routes that solve Fs, Mms, Re, BL from
  them) and `withAddedMass` ran on the per-coil Re and BL. The file's Qes/Rme/Mpow are consistent
  with the terminal values, so fixing the import alone made a dual-coil file report false
  inconsistencies.

## Fix
- Import converts `Re`/`BL` to per-coil with the file's `numVC` and `VCCon`
  (parallel: Re x N, BL same; series: Re / N, BL / N). Printed text and E mark are kept.
- Export writes the terminal Re and BL.
- `DriverEngine.solveValues` converts Re and BL to terminal values, solves, and converts back to
  per coil (a stated value is returned exactly as stated); the consistency check runs on terminal
  values too. `withAddedMass` computes Qes from terminal Re and BL.
- The drive voltage (power to voltage), the Rg-loaded Qts and the impedance-peak reader use the terminal Re too (the drive voltage was still on the per-coil Re: SPL +3.01 dB, excursion x1.414 after the import fix).
- Znom follows the terminal Re, as WinISD stores only the terminal Re.
- No schema or stored-field change.

## Verification
- Unit test: import the E150HE-44 `.wpr` (numVC 2, parallel); terminal Re 6.6 Ω, terminal BL 9.8 T·m.
- Sweep vs the `e150-sealed-nv2` WinISD capture: Z, SPL, excursion within 1e-12.

## Captures after the fix (T401)
All six boxes with E150HE-44 as filed (numVC 2, parallel) match WinISD: sealed ≤ 4e-14, vented ≤ 1e-12,
bp4 ≤ 2e-12, PR (ND140-PR) ≤ 6e-13, bp6 ≤ 1e-11, abc ≤ 4e-13 (winisd_research `runs/sweep-t393a-*-numvc2.json`).
bp6 group delay differs by 0.12 ms at 2.7 kHz, the same as with 1 coil, so not this bug.
