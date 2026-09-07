# `#sealedResonance_hz()` never selects WinISD's own air model, even when `envUseWinisdAirModel()` says to

**Status:** OPEN — finding, not a fix. `.claude/rules/engine.md` forbids changing calculation
logic without explicit human permission in the current conversation; none given yet.
**Found:** 2026-09-07, building the `.wpr` project bridge
(`packages/design/winisd/projectYmlToOpenisdAndWpr.ts`) and its test
(`packages/design/test/winisd/projectYmlToOpenisdAndWpr.test.ts`), comparing the sealed-box
resonance this bridge produces against `sealed-small.wpr`'s own `Fr`.

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

Checked only the sealed-box path (`#sealedResonance_hz()`). Not checked: whether the vented,
bandpass4-rear, or passive-radiator resonance/tuning calculations that also call
`this.#engine.airFor(...)` have the same omission — a repo-wide grep for other `airFor(` call
sites inside `project.ts` that omit `useWinisdAirModel` would confirm the blast radius.

## Fix (not applied)

Pass `useWinisdAirModel: this.envUseWinisdAirModel()` into the `airFor()` call at
`project.ts:735-739` (and any sibling call site the scope check above finds). Needs a human
ruling before being made — this is calculation logic under `.claude/rules/engine.md`.
