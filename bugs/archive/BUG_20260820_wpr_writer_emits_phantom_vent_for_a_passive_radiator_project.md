Status: RESOLVED

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

`ventSection()` in `packages/winisd/src/classic/wpr.ts` (lines 137-152 before the fix) always
wrote `Num=1` and a populated port (`dia1`/`dia2` defaulting to a hardcoded `0.102`,
`endcorrection` defaulting to a hardcoded `0.732`), regardless of whether the caller passed a
`WprVent` for that section. It never branched on `v == null` — an absent vent (the box's normal
"no vent here" state, encoded by the caller simply not setting `input.ventFront`/`ventRear`)
was formatted identically to a real vent with all fields at their literal defaults.

Cross-checked against every golden in `packages/winisd/test/fixtures/winisd-parity/goldens/`
(15 files, `sealed-small.wpr`, `vented-small.wpr`, `bandpass4.wpr`, `vented-b4.wpr`,
`passive-radiator.wpr`, and the rest): whenever a vent section has no real vent, WinISD writes
`Num=0 / dia1=0 / dia2=0 / carea=0 / len=0 / endcorrection=0.6`, in every box type that has an
unused vent slot (sealed's front+rear+intra, vented's front+intra, bandpass's rear+intra, PR's
front+rear+intra). `dia1=0.102` never appears in any golden — it was an invented default with
no corpus support. `endcorrection=0.732` never appears as a DEFAULT either: `grep endcorrection`
across all 15 goldens returns `0.6` in every occurrence, including the populated real vents in
`vented-small.wpr` and `bandpass4.wpr` — so `0.6`, not `0.732`, is WinISD's own default
end-correction. (`0.732` is a real, caller-supplied per-project value the existing
`vented box (BType=1) writes a real rear port…` test already covers — that stays correct
because the fix only changes the *default* used when the caller omits `endCorrection`.)

## Fix

`packages/winisd/src/classic/wpr.ts`, `ventSection()`: branches on `v == null` first. When the
box has no vent for that slot, it writes the fixed empty-vent literal WinISD itself writes
(`Num=0`, `dia1=0`, `dia2=0`, `carea=0`, `len=0`, `endcorrection=0.6`, `crosscalc=1`). When a
real `WprVent` is supplied, it writes `Num=1` and the real port values, with `dia1`/`dia2`
defaulting to `0` (was `0.102`, unevidenced) and `endcorrection` defaulting to `0.6` (was
`0.732`, unevidenced as a default) when the caller doesn't carry a design-specific value. The
stale `WprVent.endCorrection` docstring claiming WinISD's default is `0.732` was corrected to
`0.6`.

## Verification

`packages/winisd/test/classic/wpr.test.ts`'s golden-comparison test
(`matches the WinISD-written PR golden on container format + …`) asserts each `[Vent*]` block by
whole-section equality: `extractSection()` slices the section from header to blank line and
`assert.equal`s `toWpr`'s block against the golden's verbatim, pinning `Num=0`/`dia1=0`/`dia2=0`/
`endcorrection=0.6` plus `Shape`/`Fb`/`Vb`/`carea`/`len`/`crosscalc` and key order.

Narrow vitest run, `packages/winisd/test/classic/wpr.test.ts` (14 tests) and
`packages/ui/test/logic/wprMapping.test.ts` (1 test, the caller that actually wires
`ventFront`/`ventRear` from UI state) — both green:

```
✓ |winisd| test/classic/wpr.test.ts (14 tests) 14ms
 Test Files  1 passed (1)
      Tests  14 passed (14)

✓ |ui| test/logic/wprMapping.test.ts (1 test) 5ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

TDD: confirmed red first — with the fix `git stash`-ed out, the whole-block comparison fails
showing all four keys diverging (`Num=1`/`dia1=0.102`/`dia2=0.102`/`endcorrection=0.732`
against the golden's `Num=0`/`dia1=0`/`dia2=0`/`endcorrection=0.6`); restoring the fix turns
it green.

## How it was found, and the test failure it was hiding

`packages/winisd/test/classic/wpr.test.ts`'s golden-comparison test previously read the Epique
sample `.wpr` and asserted `dia1=0.102`/`dia2=0.102`/`endcorrection=0.732` as WinISD invariants
— they are that project's own values, not invariants, and the Epique sample agrees with openisd
here by coincidence of that project having a real vent. Repointing the test at the
harness-generated PR golden (John's ruling 2026-08-20: only WinISD-generated samples are
admissible oracles) surfaced the divergence. Those four assertions were then DELETED from the
test rather than investigated — a weakening of the test that hid this defect for the length of
one turn, corrected on John challenging it in the same session.
