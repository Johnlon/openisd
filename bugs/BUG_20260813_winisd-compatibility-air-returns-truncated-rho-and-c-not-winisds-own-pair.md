# The WinISD-compatibility air mode returns TRUNCATED ρ and c, not WinISD's own pair

# Status
RESOLVED (superseded) — `packages/engine/src/constants.ts` no longer defines `RHO`/`C` literals;
`packages/engine/src/air.ts:135-137` computes `winisdAir()` live via CIPM-2007
(`moistAirDensity`/`moistAirSoundVelocity`), within 8.3 ppm of WinISD's live pair.


**Found** 2026-08-13, bucketing `packages/winisd/test/winisd-parity.test.ts`.
**Severity** wrong number, small but systematic — 1.2e-5 relative on c, and it cubes into
3.6e-5 on η₀.
**Status** ⛔ **NOT FIXED — blocked on the human.** `AGENTS.md` §"Calculation logic — permission
gate" names physical constants explicitly and says a WinISD discrepancy "does not authorise a
fix — document it and stop". This file is that document.

## Symptom

`airFor({ …, ignoreHumidityAndPressure: true })` exists to reproduce WinISD's frozen air exactly
(`packages/engine/src/air.ts:35-42`, §"The WinISD-parity mode"). It does not.

| quantity | WinISD 0.7.0.0 | openisd compat mode | relative |
| --- | --- | --- | --- |
| c | `343.684120962153` | `343.68` | 1.199e-5 |
| ρ | `1.20095217714682` | `1.20095` | 1.813e-6 |

WinISD's values are directly observed, twice over and independently:

- all eight parity goldens (`packages/winisd/test/fixtures/winisd-parity/goldens/*.wpr`)
  carry `c=343.684120962153`, `roo=1.20095217714682` — identical across the humidity legs
  `env-rh-00` (RH 0 %) and `env-rh-30` (RH 30 %), which is also the direct measurement that
  WinISD ignores humidity;
- `drivers/sample/winisd/john-all-defaults.wdr`, a WinISD-authored blank driver, carries
  `c=343.684120962152`, `roo=1.20095217714682` at ParState slots 47/48 = `C` — i.e. WinISD's
  own calculation, not something a human typed.

## The code

`packages/engine/src/constants.ts:13-14`

    export const RHO = 1.20095;  // air density        kg/m³   (20 °C — WinISD)
    export const C   = 343.68;   // speed of sound      m/s     (20 °C — WinISD)

`packages/engine/src/air.ts:125-127`

    function winisdAir(tempK: number): Air {
      return { rho: RHO * (T_REF_K / tempK), c: C * Math.sqrt(tempK / T_REF_K) };
    }

The comment claims these are "WinISD's own derived values". They are those values rounded to
6 significant figures (ρ) and 5 (c).

## What it costs, per parity row

35 of the suite's rows fail on this cause alone, and every one is explained to the last digit:

| row | mechanism | measured |
| --- | --- | --- |
| `c` (×8) | the constant itself | 1.199e-5 |
| `roo` (×8) | the constant itself | 1.813e-6 |
| `air` (×8) | `airFor` in compat mode | same two |
| `no` (×8) | η₀ ∝ 1/c³ — exactly 3 × the c error | 3.597e-5 |
| `SPLmaxLF` (×8) | 20·log₁₀(ρ ratio) = 1.5746e-5 dB | 2.005e-7 |

The `README.md` beside the goldens already names this cause and sizes it at 1.8e-6 — it names
only the ρ half. The c half is seven times larger.

## Why this is not a one-line edit anyone may make

`RHO` and `C` are not confined to the compatibility mode. They are the app's DEFAULT air
wherever no environment is supplied: `driver.ts:32-33,122,172,386-388`, `alignments.ts:87,102,
103,114,127`, `consistency.ts:95`, `formulas.ts:16`. Correcting them moves every sweep, so
`packages/engine/test/golden.test.ts` changes — and
`docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md` §"Definition of done" item 11 requires the engine
golden-master tests to be byte-unchanged apart from the `Hc === Hg` row.

## The two candidate fixes, for the human to choose between

1. **Correct the constants.** `RHO = 1.20095217714682`, `C = 343.684120962153`. One line each.
   Every engine golden must be rebaselined in the same commit, and DoD item 11 amended.
2. **Give the compatibility mode its own pair.** Leave `RHO`/`C` as openisd's defaults and add
   the exact WinISD pair for `winisdAir()` alone. No golden moves; the two are then genuinely
   different quantities (openisd's air vs WinISD's frozen air), not two spellings of one.

Option 2 is the smaller blast radius, but it leaves `driver.ts:32-33`'s `c`/`roo` autofill — the
values written into an exported `.wdr` — still on the truncated pair, so the parity rows `c` and
`roo` would need that autofill pointed at the WinISD pair as well.

## Verification, once a fix is authorised

`npx vitest run --project winisd packages/winisd/test/winisd-parity.test.ts` — the 35 rows above
go green together. Any golden movement in `packages/engine/test/golden.test.ts` is reviewed and
rebaselined explicitly, never regenerated silently.
