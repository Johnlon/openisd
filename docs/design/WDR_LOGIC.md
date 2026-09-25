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
| ParState absent| entered, value 0 _(warn on export — may be a failed scrape)_ | entered, value                            | — nothing            |

ParState row absent causes a conservative view during parsing such that all values are entered. This is evidenced by WinISD itself: loading a `.wdr` with no ParState and resaving it recreates the ParState string with `E` marks for present values.

`N` + nonzero is treated as entered. Third-party writers copy WinISD's blank-driver `FillChar`
discipline (N for un-touched fields) but do not track edits — real values sit under N marks
because the tool never promoted them. Trusting the mark silently drops the measurement.

`C` + nonzero is still nothing. A C-marked value is WinISD's own derivation, not a measurement.
OpenISD re-derives from whatever entered fields do cross.

"Calculable by WinISD" is the "Calculated by" column of
[WINISD_SCHEMA.md §3 Field reference](WINISD_SCHEMA.md#3-field-reference): a field with a formula
there is calculable, a field reading "never — entered or absent" is not.

### `VCCon` exception — read on presence, not mark

We have no concrete evidence that WinISD assigns a ParState slot to `VCCon` (slot 46 is unproven, and no probing causes it to change). Because its ParState is unreliable, reading it on its mark loses every series wiring (since WinISD just leaves it `N`). 

| `VCCon=` value | Result                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| `1` or `2`     | entered, value                                                                            |
| anything else  | entered, value `1`, original kept as `actual_reading`, `vccon-coerced` in `dq_calculated` |
| key absent     | — nothing                                                                                 |

Because a reader trusts the value over the mark, when an unstated wiring (`not-available`) is saved to `.wdr` as a default `1`, reading that `.wdr` back promotes it to `entered`. This is a documented, one-time gain of certainty on round-trip.

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

| WinISD can calculate? | OID state / Engine       | WDR value            | WDR ParState mark |
| --------------------- | ------------------------ | -------------------- | ----------------- |
| yes / no              | entered (non-0)          | stated value         | `E`               |
| yes / no              | entered (0)              | `0` _(warn)_         | `E`               |
| yes                   | OpenISD derived it       | derived value        | `C`               |
| no                    | OpenISD derived it       | derived value        | `E`               |
| yes / no              | not present              | `0`                  | `N`               |

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
above keep only `E` cells. 

`numVC` not-stated is `C` because the `1` is OpenISD's default, not the record's. WinISD's own
New → Save writes `E` here from a hardcoded store in its blank-driver init, claiming a reading
nobody supplied; ParState slot 23 is the one slot where this writer parts company with the oracle.

Parstate slot 10 reflects the N/E state of Xlim in memory, however because there is no Xlim key in the WDR files (winisd bug) then this value is immaterial. Writing OpenISD to `.wdr` (and classic WinISD itself) discards its value on save.

### Non-ParState fields

All strings. A value present in OpenISD is written to the `.wdr` as is. A cell missing from
OpenISD is written as an empty value.

