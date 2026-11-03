# BUG_20261103_winisd-dia-duplicates-dd

**Status:** RESOLVED (T660, ruling QO398). Trivial difference from WinISD: no switch, no difference cue.

## Symptom
OpenISD's driver model held both `Dd_m` and `Dia_m`. Both are the diaphragm diameter: one fact twice.

## Cause
WinISD renamed Dia to Dd in 0.50alpha3 (`docs/winisd_helpfiles/versions.txt` line 233: "Tiny driver
parameter window: "dia" replaced by Dd."). Its Dia box is hidden, so nobody can type one, and it
writes `Dia=0`, unmarked, in every file it saves (77 of 78 WinISD-saved probe files; the other,
`s-dia-roundtrip-123.wdr`, was edited by hand). A Dia value already in a file survives a WinISD
load and save. OpenISD copied the slot into its model.

## Fix
`Dia_m` is gone from the driver and passive radiator model. `.wdr` import ignores Dia; `.wdr` export
always writes `Dia=0`, unmarked. A stored record or saved project that still holds `Dia_m` loads
with it dropped (`packages/design/domain/retiredSpecKeys.ts`).

Difference from WinISD: a hand-edited `.wdr` with a Dia value loses it on an OpenISD round trip;
WinISD keeps it. Trivial (QO279 rule), so no cue.

## Verification
`packages/design/test/domain/dia-retired.test.ts`: Dia=123 .wdr imports with no Dia and exports
Dia=0 unmarked; a record and a saved project carrying `Dia_m` load without it.
