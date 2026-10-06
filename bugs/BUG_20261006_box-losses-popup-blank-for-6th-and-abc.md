# BUG_20261006_box-losses-popup-blank-for-6th-and-abc

**Status:** OPEN

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
Show the popup per chamber for these types: a Rear row set and a Front row set (Qicl too if WinISD's dialog
has it). Which fields WinISD's own dialog shows for these types is ⚠ unverified; check under wine before
building. Part of the "Box types not yet implemented" work in BACKLOG.md.

## Verification
Browser spec: on a 6th-order bandpass and on ABC, the popup shows each chamber's stored losses, an edit
reaches that chamber, and Reset restores WinISD's defaults in both.
