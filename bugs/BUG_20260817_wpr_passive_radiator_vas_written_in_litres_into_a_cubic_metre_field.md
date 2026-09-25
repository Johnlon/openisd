# Driver-editor fields and project values are silently dropped on file write

## Status
OPEN — two findings, both tracked in `BACKLOG.md` as F2 and F3.

## Symptom

**F2 — eleven driver-editor fields are silently discarded on `.wdr` save.** `Vd`, `Dd`, `no`,
`SPL`, `USPL`, `SPLmax`, `SPLmaxLF`, `Rme`, `gamma`, `Mpow` and `Mcost` are editable in the driver
editor and do not reach the file.

**F3 — `.wpr` writes three project values as literals.** `Rg`, `alfaVC` and `dTVC` are emitted as
fixed constants, so the project's real values never reach the file. A design exported and reopened
comes back with someone else's numbers in those three fields.

Both are silent: nothing is logged, no DQ mark is raised, and the written file is well-formed, so
the loss is invisible until the file is read back and compared.

## Cause

Both are write-side gaps in the mapping layer rather than serialiser faults. The serialisers emit
what they are handed; the mapping never hands them these values.

## Fix

F2: give each of the eleven fields a write path from the editor's record to the `.wdr` key it
belongs to.

F3: read `Rg`, `alfaVC` and `dTVC` from the project rather than emitting constants.

## Verification

A round trip through each format returns every field the editor accepted, asserted field by field
rather than on a sampled subset — a partial assertion is what let these through.
