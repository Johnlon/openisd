# BUG_20260924_driver-solve-and-sweep-use-different-air-models

Status: RESOLVED 2026-09-26 — `#airOver` now includes `useWinisdAirModel`, and the driver's own
`c_m_per_s`/`roo_kg_per_m3` feed nothing: every calculation (box, vent, PR, resolve, sweep,
`driverSolverParamsOf`) reads `OpenISDProject#air(root)` directly.

## Symptom

One project uses two different speeds of sound and two different air densities at the same
time. The driver's Vas↔Cms solve uses one pair, the frequency sweep uses another. Nothing in
the UI says so.

## Evidence

Re-checked 2026-09-24. `/tmp/W5 sealed.owpr` has `environment: {temperature_K: null,
humidity_pct: null, pressure_Pa: null, useWinisdAirModel: null}`, and its embedded driver
carries `c_m_per_s = 343.6826980479399`, `roo_kg_per_m3 = 1.2009621215255684`.

`solveEnvironment` at 293.15 K / 30 % / 101325 Pa, run this session:

| air model                   | c (m/s)            | ρ (kg/m³)          |
|-----------------------------|--------------------|--------------------|
| `useWinisdAirModel: false`  | 343.6826980479399  | 1.2009621215255684 |
| `useWinisdAirModel: true`   | 343.68412096215235 | 1.2009521771468228 |

The driver's stored pair is the `false` row.

- `packages/design/domain/openisdDomain.ts:1685-1691` — `OpenISDDriverEmbedded.wrap`'s
  `airProvider` builds `{tempK, humidityPct, pressurePa}` and omits `useWinisdAirModel`.
- `packages/design/domain/openisdDomain.ts:2597-2600` — the fallback air for a driver
  `resolve()` never ran on, same omission.
- `packages/design/domain/openisdDomain.ts:3053-3056` — `#sweepParams` passes
  `useWinisdAirModel: this.#current().environment.useWinisdAirModel ?? true`.

So the driver solve defaults the flag to false and the sweep defaults it to true, from the same
null project setting.

## Cause

The flag has no single owner. Two call sites build an `AirConstantProvider` / `SweepParams` from
the same `environment` record and disagree about what an absent `useWinisdAirModel` means.

## Fix

Resolve the project's air once, in one place, and hand the resolved `{rho, c}` to both the
driver solve and the sweep. The absent-flag default belongs to that one resolver, not to each
caller.

## Impact

For this case 8 ppm in ρ and 4 ppm in c — about 0.00007 dB, invisible. The gap widens away from
the reference conditions, and the inconsistency is independent of its present size.

## Verification

A unit test that sets the project environment away from the defaults with
`useWinisdAirModel` unset, then asserts the ρ/c written onto the driver's `c_m_per_s` /
`roo_kg_per_m3` equals the ρ/c the sweep resolves.

## What the driver's own air field is for (speculation, John, 2026-09-26)

We don't actually know. Two possibilities:

- It just records the condition the driver was measured at. If so, no calculation should ever
  read it — display only.
- It's meant to let a calculation adapt the driver's measured readings to the project's own air.
  If so, some calculation legitimately needs it.

Undecided. Until it's decided, the fix treats it as display only: every calculation (box, vent,
PR, sweep) reads the project's own air; `c_m_per_s`/`roo_kg_per_m3` show on the driver's
properties tab and feed nothing.
