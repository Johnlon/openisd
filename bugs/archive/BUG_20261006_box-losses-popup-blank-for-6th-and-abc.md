# BUG_20261006_box-losses-popup-blank-for-6th-and-abc

**Status:** RESOLVED 2026-10-07

## Symptom
On a 6th-order bandpass or ABC box, the Box losses popup (Box tab "Advanced->", mobile "Box losses ->")
shows Ql and Qa as empty boxes. Typing in them does nothing, and Reset does nothing.

## Evidence
Checked 2026-10-06:
- `Box.lossesOf` (`packages/design/domain/box/openISDBox.ts`) returns `null` for `bandpass6` and `abc`.
- The popup's `boxQl`/`boxQa`/`boxQp` (`OriginalShell-hooks.ts`, `MobileBoxTab-hooks.ts`) read
  `lossesOf(...)?.Ql.value ?? null`, so they are blank for those types, and the setters write nothing.
- The losses exist in the project: each chamber has its own (`bandpass6.chambers.rear.losses` Ql/Qa/Qp/Qicl,
  `front.losses` Ql/Qa/Qp; the same for `abc`).

## Cause
These two box types have two sets of losses, one per chamber. The popup has room for only one set, so
`lossesOf` answers "none".

## Fix
`Box.lossesOf` is replaced by `Box.lossGroupsOf(type)`, which returns one row set per chamber: one untitled
set for most types, a "Rear chamber" and a "Front chamber" set for `bandpass6` and `abc`.
`resetLossesOf` resets every set. `createBoxLosses` (`packages/ui/src/hooks/boxFields.ts`) serves both shells,
and both popups loop over the sets. Qicl (the leak between chambers) has no row: no WinISD screen has
shown one. WinISD's own dialog contents for these types were not probed under wine.

## Verification
- `packages/design/test/domain/box-volume-of.test.ts`, `retired-loss-mode.test.ts`
- `packages/ui/test/hooks/boxFields.test.ts`
- `packages/ui/test/ui/box-losses-popup.browser.spec.ts`, `mobile-box-losses-popup.browser.spec.ts`: on
  `bandpass6` and `abc` the popup shows both chamber sets, an edit reaches that chamber, Reset restores
  the defaults in both.
Passed 2026-10-07.
