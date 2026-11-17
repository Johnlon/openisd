# BUG_20261108_trailing-zeros-past-two-decimals

**Status:** RESOLVED

## Symptom
Edit Driver, BL shows `14.70000`. John, 8 Nov 2026 04:33, chat: "BL precision on the driver editor
is still wrong 14.70000".

## Ruling (QO454, 8 Nov 2026)
Number boxes show at least 2 decimals; more only for non-zero digits the value is known to (up to
the field's precision); no trailing zeros past 2. BL 14.7 shows 14.70, BL 7.17 shows 7.17, BL 7.1734
shows 7.1734, Rms 2.28816 stays 2.28816, Qes 0.57 shows 0.57 (not 0.570). A field whose precision
is under 2 decimals keeps its own precision.

## Cause
`NumberField.format` printed every value at the field's full precision (`toFixed`).

## Fix
`formatTrimmed` in `packages/design/fields/format.ts`, used by `NumberField.format`. Test:
`packages/design/test/fields/format.test.ts`.
