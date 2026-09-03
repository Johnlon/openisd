# `.wdr` load and save logic

Which values cross between `.wdr` INI text and an OpenISD record, and what provenance they carry.
The format itself is `WINISD_SCHEMA.md`.

OpenISD never stores a calculated value.

## Background — `VCCon` and `numVC`

The solver READS both and never produces either — they are `NotAQuantity` in
`packages/design/engine/solverQuantities.ts` — so nothing derives one from the others. `numVC`
still has a calculated value: a record stating no coil count gets 1, supplied by OpenISD.
`VCCon` has no such default in the record; the engine applies parallel where it is used.

A record stating neither leaves both absent. The engine then simulates with WinISD's own screen
defaults, parallel and one coil, applied where they are used (`circuit.ts`, and
`terminalRe_ohm`/`terminalBL_Tm` in `solver.ts`) and never written back into the record.

WinISD has no calculated state for either. No instruction in its code writes ParState slot 46, so
`VCCon` is `N` in every file WinISD authors from a blank driver and keeps whatever mark a loaded
file supplied; `numVC` is `E` from a hardcoded store in the blank-driver init.

## Loading `.wdr` INI text into OpenISD

Decision table — `ParState mark × value in file`:

| ParState mark  | Value = 0                                                    | Value = nonzero                           | Key absent from file |
| -------------- | ------------------------------------------------------------ | ----------------------------------------- | -------------------- |
| `E`            | entered, value 0 _(warn on export — may be a failed scrape)_ | entered, value                            | — nothing            |
| `C`            | — nothing                                                    | — nothing _(derived value, never stored)_ | — nothing            |
| `N`            | — nothing                                                    | **entered, value**                        | — nothing            |
| _(row absent)_ | `C` if calculable by WinISD, else nothing                    | entered, value                            | — nothing            |

`N` + nonzero is treated as entered. Third-party writers copy WinISD's blank-driver `FillChar`
discipline (N for un-touched fields) but do not track edits — real values sit under N marks
because the tool never promoted them. Trusting the mark silently drops the measurement.

`C` + nonzero is still nothing. A C-marked value is WinISD's own derivation, not a measurement.
OpenISD re-derives from whatever entered fields do cross.

"Calculable by WinISD" is the "Calculated by" column of
[WINISD_SCHEMA.md §3 Field reference](WINISD_SCHEMA.md#3-field-reference): a field with a formula
there is calculable, a field reading "never — entered or absent" is not.

### `VCCon` exception — read on presence, not mark

WinISD writes no instruction to slot 46, so `VCCon` is `N` in 520 of the 524 corpus files while
the `VCCon=` row still states a wiring. Reading it on its mark loses every series wiring.

| `VCCon=` value | Result                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| `1` or `2`     | entered, value                                                                            |
| anything else  | entered, value `1`, original kept as `actual_reading`, `vccon-coerced` in `dq_calculated` |
| key absent     | — nothing                                                                                 |

### `numVC` — read on mark, value checked

`numVC` is read on its ParState mark (E/C/N) like every other row. Its value is then validated:

| `numVC=` value | Result                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| integer 1..4   | entered, value                                                                            |
| anything else  | entered, value `1`, original kept as `actual_reading`, `numvc-coerced` in `dq_calculated` |

## Converting OpenISD to `.wdr` INI text

All 55 fields are written every time, in WinISD's order, plus the ParState row. The 55 fields
split two ways: 48 ParState fields and 7 non-ParState fields.

### ParState fields — decision table

| OID cell state | Solver derives it? | WDR value            | WDR ParState mark |
| -------------- | ------------------ | -------------------- | ----------------- |
| entered        | —                  | stated value         | `E`               |
| calculated     | —                  | cell's derived value | `C`               |
| not-available  | yes                | solver's value       | `C`               |
| not-available  | no                 | `0`                  | `N`               |

### ParState field exceptions

| Field      | OID state          | WDR value          | WDR ParState mark   |
| ---------- | ------------------ | ------------------ | ------------------- |
| `VCCon`    | entered — parallel | `1`                | `E`                 |
| `VCCon`    | entered — series   | `2`                | `E`                 |
| `VCCon`    | not-available      | `1`                | `N`                 |
| `numVC`    | entered            | stated count       | `E`                 |
| `numVC`    | not-available      | `1`                | `C`                 |
| `Xlim`     | entered            | _(no key written)_ | `E` on slot 10 only |
| `Xlim`     | not-available      | _(no key written)_ | `N` on slot 10 only |
| `c`, `roo` | —                  | air model value    | `C`                 |

`VCCon` not-stated is `N` rather than the `E` WinISD itself would write, because the loading rules
above keep only `E` cells — an `N` would drop a stated Series on re-import, and the wiring would
be lost. WinISD preserves whatever mark a file carries, so the `E` survives a WinISD save.

`numVC` not-stated is `C` because the `1` is OpenISD's default, not the record's. WinISD's own
New → Save writes `E` here from a hardcoded store in its blank-driver init, claiming a reading
nobody supplied; ParState slot 23 is the one slot where this writer parts company with the oracle.

`Xlim` has no key. Even though Xlim cannot be written into a `.wdr` file, ParState slot 10 tracks
the E/N value in OpenISD. Writing OpenISD to `.wdr` (and classic WinISD itself) discards its
value on save.

### Non-ParState fields

All strings. A value present in OpenISD is written to the `.wdr` as is. A cell missing from
OpenISD is written as an empty value.

