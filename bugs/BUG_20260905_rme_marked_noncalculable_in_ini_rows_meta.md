# `Rme` marked `calculable: false` in `INI_ROWS_META` — every derived `Rme` exports as `E`, never `C`

**Status:** OPEN.

## Symptom

`test/winisd/winisd-parity.test.ts`'s `ParState` check fails on slot 34 (`Rme`) for every one
of the 15 parity scenarios: WinISD's own goldens mark the slot `C` (computed), openisd writes
`E` (entered) instead, for a field the scenario driver never states.

## Evidence

`packages/design/winisd/winisdDriver.ts:104`: `{key: 'Rme', calculable: false}`.

`driverYmlToOpenisdAndWdr.ts:550-559` marks a solver-derived value `calculated` only when its
`.wdr` key is in `WINISD_CALCULABLE` (built by filtering `INI_ROWS_META` on `calculable`);
otherwise it marks the derived value `entered`, which is the E/C mismatch observed.

`docs/spec/SPEC_ENGINE.md:426-433` ("every calculatable field is CALCULATED, not left at its
default") lists `Rme` among the fields the projection derives via the full consistency-group
pass — the same class as `gamma`, `Mpow`, `Mcost`, all three of which ARE marked
`calculable: true` in the same table (`winisdDriver.ts:103,105,106`).

## Cause

`Rme`'s `calculable` flag is `false` while every other member of its own field family
(`gamma`/`Mpow`/`Mcost` — "ordinarily derived, but WinISD lets a human type any of them",
`domain/project.ts:798`) is `true`. Nothing distinguishes `Rme` from its siblings in the spec
or in WinISD's own observed behavior (the parity goldens compute it whenever the driver states
neither route: `Rme = Bl²/Re` or `Rme = 2π·Fs·Mms/Qes`, `consistency.ts:83-87`) — the flag
appears to be a data-entry slip in the 48-row table, not a deliberate exception.

## Impact

Every `.wdr` openisd writes for a driver that does not state `Rme` directly marks that slot `E`
instead of `C`, for every driver in the corpus, silently. WinISD reading such a file would see a
claim that a human typed `Rme`, when in fact openisd derived it.

## Not fixed here

Flip `calculable: false` → `true` at `winisdDriver.ts:104`, matching `gamma`/`Mpow`/`Mcost`.
Needs a second pass through the parity goldens confirming no OTHER scenario relies on `Rme`
reading `E` for a reason not yet found (none of the 15 current scenarios' `divergences.json`
entries reference slot 34, and none should if this is the actual defect).

## Verification when fixed

`test/winisd/winisd-parity.test.ts`'s `ParState` check passes for all 15 scenarios with slot 34
untouched by any `divergences.json` entry.
