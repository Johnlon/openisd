# The box model has one loss triple; WinISD's bandpass4 has one per chamber

## Status
OPEN — model gap, folded into Lane P's box-model work (docs/design/PROJECT_DOMAIN_SYMMETRY.md).

## Symptom

A WinISD `.wpr` states a loss triple PER CHAMBER: `Qlf`/`Qaf`/`Qpf` for the front chamber and
`Qlr`/`Qar`/`Qpr` for the rear. `OpenISDBox` carries exactly one triple (`Ql`/`Qa`/`Qp`), so for
a bandpass4 box — the one alignment OpenISD models with two real chambers — a file whose front
and rear losses differ cannot be represented. Import keeps the rear triple and loses the front;
export writes the one triple into both chambers.

## Evidence

`packages/model/src/openisdProject.ts` — `OpenISDBox` declares `Ql: number; Qa: number;
Qp: number` once, with the comment "Shared by every alignment". `fromWinISDProject` reads
`Qlr`/`Qar`/`Qpr` only; `toWinISDProject` writes the single triple into both `Qlf…` and `Qlr…`.

Ruling (main-exec adversarial review of 27f48bd, G2, logged for John): generic domain narrowing
is accepted — the `.wpr` export is a projection of the model, and an opaque foreign-key bucket
through `OpenISDProject` would be a tolerance mechanism. But front-chamber losses are NOT
foreign keys: OpenISD's bandpass4 HAS a front chamber, so this is a gap in the box model, not
acceptable narrowing.

## Fix

Not applied — belongs to Lane P's box-model reshaping (the same pass that turns `vent` into
`vents[]`), where the loss triple becomes per-chamber for the alignments that have two.

`packages/model/test/openisdProjectWinIsdMapping.test.ts`'s "chamber losses round-trip" test
pins the PRESENT single-triple behaviour and names this record, so nobody reads it as the
contract.

## Verification

Once fixed: a `.wpr` with `Qlf=5/Qlr=10` imports both, and re-export writes `Qlf=5`/`Qlr=10`,
not one value into both chambers.
