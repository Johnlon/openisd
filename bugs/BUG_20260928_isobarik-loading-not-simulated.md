# BUG_20260928_isobarik-loading-not-simulated

**Status:** OPEN

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
Decode WinISD's iso-barik driver transform, fit runs/sealed-w5-isobarik exactly, then apply it
in the engine when `loading` is `isobaric`.

## Verification
Fixture from runs/sealed-w5-isobarik; engine test ≤ 1e-12 relative on impedance, TF, SPL,
excursion.
