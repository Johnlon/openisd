# BUG_20261118_vented-picker-ignores-driver-count

**Status:** FIXED (T921)

## Symptom
One sentence: the vented alignment picker (the Alignment popup on the Box tab, the phone's "Choose alignment" sheet, and the vented step of New Project) proposes one driver's volume whatever the number of drivers or Iso-barik, where WinISD proposes N times that volume (halved for Iso-barik) at the same tuning.

## Evidence
- OBSERVED, WinISD 0.7.0 under wine, 18 Nov 2026, Tang Band W5-1138SMF, saved .wpr `[Box] Vr` and `Fr` (winisd_research/runs/vented-picker-ndrivers-20261118/RESULT.md, results.jsonl, winisd_research commit d310c22):
  - C4/SC4: Vb 10.6966 L (1 driver), 21.3932 L (2), 42.7864 L (4), 5.3483 L (1 Iso-barik), 10.6966 L (2 Iso-barik); Fb 35.9002461074499 Hz in every case.
  - QB3: Vb 10.6943, 21.3885, 42.7770, 5.3471, 10.6943 L; Fb 36.1337961937311 Hz in every case.
- Same family as the sealed picker (bugs/BUG_20261118_winisd-sealed-picker-ignores-driver-count.md, T907).
- WinISD scales the proposed volume and does not change Fb, so matching it is correct: no WinISD-bug switch, no difference cue.

## Cause
`OpenISDDriver.ventedDesign` passed one driver's Vas to `VentedEngine.alignment`.

## Fix
`ventedDesign(alignment, load, Ql)` takes the project's drive load instead of the bare source resistance and passes the engine's rule `SealedEngine.arrayVas(Vas, load.nDrivers, load.loading)` (N times Vas, halved for Iso-barik), the rule the sealed readout and sealed picker use. No second copy. The starting-volume copy in the Box (the same body as `resetVentedAlignment`) is now one call to `resetVentedAlignment`, so its dupscan baseline entry is marked resolved (QO949 procedure). Callers pass the project's load: the Box tab's starting and reset volume, the project builder, the Alignment popup (desktop and phone) and New Project's vented step (its drivers asked for). Tuning is unchanged, as in WinISD.

## Tests
- packages/design/test/domain/winisd-vented-picker-counts-drivers.test.ts: the 10 WinISD cases (C4 and QB3, Nd 1/2/4, Nd 1 and 2 Iso-barik), Vb and Fb to relative 1e-9, the tolerance of the sealed picker test.
- packages/ui/test/ui/vented-alignment-driver-count-journey.browser.spec.ts: 2 drivers on the Driver tab, then the vented Alignment on the Box tab proposes 10.70 L with one driver and 21.39 L with two, WinISD's figures (desktop and phone). It picks the catalogue W5-1138SMF, not a My Drivers copy.

## Separate finding: a spec's seeded driver outlives its test
`packages/ui/test/ui/new-project-wizard.browser.spec.ts` imports a "Tang Band W5-1138SMF" (different specs: Qts 0.49 but other Qes/Qms) through the wizard's file input (`importDrivers`). That driver goes to My Drivers in the shared worker page and is not removed by `resetApp` (which removes only what the fixtures' `TestAdditions` made). It persists across tests and across spec files on the same worker: a later spec on that worker that takes the first "W5-1138SMF" in the New Project list got it (Vb 10.60 L, Fb 36.0028 Hz, not the catalogue's 10.70 L, 35.9002 Hz). Seen when this journey ran after that spec on one worker. This journey avoids it by choosing `.ditem:not(.my-ditem)`. The isolation fix (the import cleaned up, or tracked in `TestAdditions`) is not done here.
