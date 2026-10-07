# BUG_20261007_4th-order-bandpass-merges-per-chamber-losses

**Status:** RESOLVED 2026-10-07

## Symptom
WinISD's 4th-order bandpass keeps losses per chamber. OpenISD's Box losses popup showed one merged set, so the two
chambers could not be edited separately (the model already stores them per chamber).

## Evidence
Reported 2026-10-07 by the coordinator session while fixing
`BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md`. Not yet probed under wine.

## Fix
`lossGroupsOf('bandpass4')` returns a Rear chamber set (Ql, Qa, Qicl; no Qp) and a Front chamber set (Ql, Qa, Qp,
Qicl). `BoxLossGroup.Qicl` is new: for bandpass4, bandpass6 and abc both sets carry the rear chamber's Qicl (the
value the sweep reads as `Qiclfr`); one-cabinet types have none. Reset also puts Qicl back to 100. Both popups show
an "Interchamber Qicl" row (`NumberField.LOSS_QICL`). The `abcBox.ts` comment saying no WinISD screen shows these
losses is corrected. The front chamber's own stored Qicl is not shown or read: see
`BUG_20261007_front-chamber-qicl-stored-but-never-read.md`.

## Ruling (John, 2026-10-07, bug walk: "decide that is best quality solution")
Popup only: storage, converter and sweep already keep losses per chamber (`bandpass4.chambers.rear/front.losses`);
`lossGroupsOf('bandpass4')` returned one merged group. Probe (winisd_research e7c754c, PROBE_FINDINGS.md): rear
(sealed) lists Ql, Qa, Qicl, no Qp; front lists Ql, Qa, Qp, Qicl; Qicl is one shared value (`Qiclfr`). Fix as
maryu has it: Rear and Front sets, one Qicl row bound to the single stored value in bp4, bp6 and abc.

## Verification
- `packages/design/test/domain/box-volume-of.test.ts`: bp4 sets and Qp, one shared Qicl field in bp4/bp6/abc, Reset.
- `packages/ui/test/hooks/boxFields.test.ts`: bp4 sets, Qicl shared, none for sealed.
- `box-losses-popup.browser.spec.ts`, `mobile-box-losses-popup.browser.spec.ts`: bp4, bp6 and abc show a Rear and a Front
  set, the Port Qp row count (1 for bp4, 2 for bp6/abc), an edit of Qicl in one set shows in the other, Reset gives 100.
Passed 2026-10-07.
