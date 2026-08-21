Status: OPEN

# `toWpr` emits a phantom vent in `[VentFront]`/`[VentRear]` for a passive-radiator project

## Symptom

For a PR (passive-radiator) project — no vent of any kind — `toWpr` writes a fully-populated
vent into both `[VentFront]` and `[VentRear]`. Real WinISD writes an empty one.

| key | WinISD wrote | openisd writes |
|---|---|---|
| `Num` | `0` | `1` |
| `dia1` | `0` | `0.102` |
| `dia2` | `0` | `0.102` |
| `endcorrection` | `0.6` | `0.732` |

`Shape=1`, `Fb=0`, `Vb=0`, `carea=0`, `len=0`, `crosscalc=1` agree.

## Evidence

Golden: `packages/winisd/test/fixtures/winisd-parity/goldens/passive-radiator.wpr`, written by
WinISD Pro 0.7.0.0 itself under the wine harness
(`fixtures/winisd-parity/provenance.json`: exe sha256
`a7dab23388a2ed4ab3111b59725dd6337532a0fc03cd28f9f5eb01ef6df386ae`, harness commit
`78fed4904b00a1178e8c1a81ee3883fd6cb6aa75`, captured 2026-08-13T18:27:03+0200,
golden sha256 `5f28ccc110ed7d9a2197e854b511832a6dbf96948088f884f57e9a0e328fc757`). Its
`[VentFront]` reads `Num=0 / dia1=0 / dia2=0 / endcorrection=0.6`.

openisd's own output for the same box/PR inputs was captured by calling `toWpr` directly with
`{bType: 4, Vr: 0.04, Fr: 31.7490157327751, npr: 1}` and the golden's PR values, 2026-08-20:
`Num=1 / dia1=0.102 / dia2=0.102 / endcorrection=0.732`, in BOTH vent sections.

## Cause

Not established. `toWpr` (`packages/winisd/src/classic/wpr.ts`) appears to emit a fixed vent
default regardless of box type, rather than an empty vent when the box has no vent. Whether
`0.102`/`0.732` are hardcoded literals or a shared default object is not yet traced.

Note `endcorrection=0.6` vs `0.732` is a separate question from the phantom vent: `0.732` is
WinISD's one-flanged default and `0.6` is what this golden carries, so the correct value may
depend on box type or on WinISD writing its own unset default for a vent that does not exist.
Do not assume `0.6` is universally right without checking the vented goldens.

## Fix

Not fixed.

## Verification

N/A — open.

## How it was found, and the test failure it was hiding

`packages/winisd/test/classic/wpr.test.ts`'s golden-comparison test previously read the Epique
sample `.wpr` and asserted `dia1=0.102`/`dia2=0.102`/`endcorrection=0.732` as WinISD invariants
— they are that project's own values, not invariants, and the Epique sample agrees with openisd
here by coincidence of that project having a real vent. Repointing the test at the
harness-generated PR golden (John's ruling 2026-08-20: only WinISD-generated samples are
admissible oracles) surfaced the divergence. Those four assertions were then DELETED from the
test rather than investigated — a weakening of the test that hid this defect for the length of
one turn, corrected on John challenging it in the same session.
