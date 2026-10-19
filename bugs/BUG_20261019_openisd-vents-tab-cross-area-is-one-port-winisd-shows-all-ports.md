# BUG_20261019_openisd-vents-tab-cross-area-is-one-port-winisd-shows-all-ports

**Status:** OPEN

## Symptom
Type 2 into the Vents tab "Number of vents". WinISD's cross area box then reads the area of both ports together. OpenISD's Vents tab cross area box (Original shell and Mobile, `NumberField.VENT_CROSSAREA_M2` bound to `vent.area_m2`) reads one port. A control OpenISD shares with WinISD must read as WinISD does, so this is an OpenISD difference, not a WinISD bug.

Seen on W5-1138SMF (vented, 38 Hz, 50 mm round port, 10 L): WinISD 0.0039 m2, OpenISD 0.00196 m2. Same on E150HE-44 (36 Hz, 50 mm, 10 L): WinISD 0.0039, OpenISD 0.00196. Vent length readouts and all seven charts match to 1e-9.

## Evidence
- Run records sweep-t429-w5-vented-edit-ventnum and sweep-t429-e150-vented-edit-ventnum (winisd_research). On W5 the file WinISD saves afterwards states carea 0.00196349540849362 (one port) and Sdrport 0.00392699081698724 (both): WinISD stores one port, shows the total.
- Design: `Vent.area_m2` is one port; `Vent.totalArea_m2()` is `count` ports.
- Tests, both pinned `it.fails`: packages/design/test/domain/driver-edit-parity-w5.test.ts ("Vents tab: cross area") and packages/design/test/domain/driver-edit-parity-e150he-44.test.ts ("Vents tab: cross area after Num edit"). Both compare WinISD's printed value with what OpenISD's Vents tab shows (`area_m2`).

## Cause
Kind: a different display convention, copied by default under the WinISD rule. The OpenISD box shows the per-port area. ⚠ Only the one-port to two-port edit is captured; whether WinISD's box takes a typed total is not verified.

## Fix
Separate fix task. The Vents tab cross-area box shows the total of all ports by default (WinISD's way), with the per-port figure behind a WinISD-style option whose tooltip names the case. No stored-field change. Needs John's word on any layout or option change.

## Verification
Remove both `it.fails` markers; both tests pass.
