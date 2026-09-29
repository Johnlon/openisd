# BUG_20260928_isobarik-loading-not-simulated

**Status:** RESOLVED

## Symptom
Setting a project's loading to iso-barik changes nothing in OpenISD's charts. WinISD's charts
change: for the W5-1138SMF in its 4.48 L sealed box, impedance differs by up to 8.5 Ω and SPL
by up to 6.5 dB.

## Evidence
winisd_research runs/sealed-w5-isobarik (`[Box] Isobarik=1`, 2026-09-28) against OpenISD with
`project.loading.set('isobaric')`: worst differences are SPL 6.45 dB at 103 Hz, impedance 8.52 Ω
at 53.8 Hz (WinISD 19.37, OpenISD 10.85), TF 2.52 dB, and excursion 0.98 mm at 1 Hz.
`loading` appears only in `domain/openisdSchema.ts` and `domain/project/openISDProject.ts`.
No engine file reads it.

## Cause
The engine has no iso-barik model: `loading` is stored and never passed to the sweep.
WinISD's iso-barik form is not decoded yet (⚠ unverified: textbook iso-barik is two drivers in
series acoustically, Mms×2, Vas/2, BL/Re per its wiring).

## Fix
Fitted from runs/sealed-w5-isobarik: WinISD's pair is Mms×2, Cms/2, Rms×2, Vas/2 with the circuit's
terminal BL ×√2 (Fs and Q's unchanged; the typed BL stays one driver's), and its impedance is
Ze + 2 × the pair's motional term. `isobarikPair` (engine/solvers/driverQuantities.ts) applies the
transform in `SimulationEngine.sweep` when `loading` is `isobaric`; `circuit.ts` doubles the
motional term. ⚠ unverified: with voice-coil inductance on, and in ported boxes.

## Verification
`test/domain/isobarik-loading-winisd.test.ts` against `test/fixtures/winisdIsobarikCapture.ts`
(131 points per chart): SPL, TF and impedance ≤ 1e-12 relative, excursion ≤ 1e-11. Red before
(SPL −2.32 vs −6.90 dB at 1 Hz), green after; design suite 2375/2375.
