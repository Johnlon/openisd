# `#sealedResonance_hz()` never selects WinISD's own air model, even when `envUseWinisdAirModel()` says to

Status: RESOLVED (2026-09-26) — 638ba6dc made the project's air the sole source for every
calculation, so the sealed resonance is now computed in the air the project asks for. The bridge
test's Fr matches WinISD's golden to 6e-14 Hz, against 0.044 Hz before.

## Symptom

For `sealed-small.wpr`'s own Fs/Sd/Cms/Qts/volume/losses (`Fs=37.2`, `Sd=0.0132`,
`Cms=0.00118092600256716`, `Qts=0.371865748278092`, `Vr=0.02`, `Ql=10`, `Qa=100`), OpenISD
computes `resonance_hz = 61.311243219623286`. WinISD's own golden file states
`Fr=61.2670146589858` for the identical inputs — a ~700ppm discrepancy, well outside floating
point noise.

## Cause

`OpenISDProject.#sealedResonance_hz()` (`packages/design/domain/project.ts:727-750`) builds its
`air` argument like this:

```ts
const env = this.#environment();
const air = this.#engine.airFor({
    tempK: env.temperature_K ?? undefined,
    humidityPct: env.humidity_pct ?? undefined,
    pressurePa: env.pressure_Pa ?? undefined,
});
```

It never passes `useWinisdAirModel`. `Engine.airFor()` (`packages/design/engine/air.ts`) only
switches from the CIPM-2007 physical air model to WinISD's own parity air-property formula when
`useWinisdAirModel === true` is explicitly passed — the file's own doc comment states the two
models disagree by ~8ppm on density and ~4ppm on speed of sound at reference conditions, which
compounds into the ~700ppm `Fr` discrepancy observed here.

`OpenISDProject.envUseWinisdAirModel()` (`project.ts:2066-2068`) exists specifically to select
WinISD's own air model, defaults to `true` (QO95 — "so a new project matches WinISD out of the
box"), and is persisted on the record as of commit `611844f`. `#sealedResonance_hz()` does not
read it.

## Scope

Recorded against the sealed path; the vented, bandpass4-rear and passive-radiator calculations
called `airFor(...)` the same way. All of them are covered by the single-source fix — the
bandpass4 rear chamber's resonance now matches its golden to 5.7e-14 Hz, measured the same way as
the sealed case below.

## Fix

Applied in 638ba6dc, and not where this record predicted: the driver's own `c_m_per_s`/
`roo_kg_per_m3` became display-only and every calculation now reads the project's air through one
`OpenISDProject#air(root)`, which passes `useWinisdAirModel`. Patching the single `airFor()` call
this record named would have left every sibling call site with the same omission.

## Verification (2026-09-26)

`packages/design/test/winisd/openIsdProjectToWinIsdProject.test.ts` asserted this within 0.05 Hz
and said in its own comment that the slack tolerance existed to document the gap rather than hide
it. Measured after the fix: `bridgeFr - goldenFr = -6.39e-14` Hz. The tolerance is now 1e-9 Hz,
so the gap cannot reopen without the test failing. 34 passed in that file.
