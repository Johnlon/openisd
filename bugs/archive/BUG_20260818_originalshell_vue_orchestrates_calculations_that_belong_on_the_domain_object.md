# `OriginalShell.vue` orchestrates real calculations in the component instead of reading them off the domain object

# Status
FIXED 2026-08-18. Related to, but broader than, the vent-area/PR-formula duplication bugs found
the same session — this one is about WHERE a calculation is performed, not whether the formula
itself is duplicated.

## Symptom

`ARCHITECTURE.md` §5 (human ruling, 2026-08-18): *"Only the domain objects calculate — the
store never does."* `OriginalShell.vue` — a UI component, not the store, but the same
principle applies — has at least 10 of its 31 `computed()` properties orchestrating a real
calculation (calling an engine formula function, combining multiple driver/box values,
branching on state) directly in the component, instead of reading an already-computed value
off `managedProject`/a domain object.

## Evidence

Representative, not exhaustive (`grep -n "^const .* = computed" OriginalShell.vue` lists all
31; these are the ones that call an engine formula or combine multiple values, not simple
pass-throughs or UI-only state):

```ts
// line 121 — calls sealedResonance()/sourceLoadedQts() (both @openisd/engine), combining
// driver fields, state.P.Rs, state.P.Vb/Ql/Qa, and state.lossMode
const sealedRes = computed<{ Fsc: number; Qtc: number } | null>(() => {
  const d = driver.value;
  if (!d || !(state.P.Vb > 0)) return null;
  const qts = sourceLoadedQts(d.Qms, d.Qes, d.Re, state.P.Rs, d.Qts);
  return sealedResonance(LossMode.parse(state.lossMode),
    { Fs: d.Fs, Vas: d.Vas, Qts: qts, Vb: state.P.Vb, Ql: state.P.Ql, Qa: state.P.Qa });
});
const rearResonance = computed<number | null>(() => sealedRes.value?.Fsc ?? null);
const rearQtc = computed<number | null>(() => sealedRes.value?.Qtc ?? null);

// line 135 — calls prTuning() (@openisd/engine)
const prFh = computed<number | null>(() => {
  if (!(state.P.Vb > 0) || !(state.P.prSd > 0) || !(state.P.prCms > 0)) return null;
  return prTuning(state.P);
});

// line 218 — portPipeResonance, similar shape (not excerpted, same pattern)

// lines 222-225 — calcPrVas/calcPrFs/calcPrFsMass/calcPrQms, each combining 2-3 state.P fields
const prVas = computed(() => calcPrVas(state.P.prCms, state.P.prSd));
const prFs = computed(() => calcPrFs(state.P.prMmd, state.P.prCms));
const prFsMass = computed(() => calcPrFsMass(state.P.prMmd, state.P.prMadd, state.P.prCms));
const prQms = computed(() => calcPrQms(state.P.prMmd, state.P.prCms, state.P.prRms));
```

None of these duplicate a formula (they correctly call `@openisd/engine`/`prWinIsdFields.ts`
functions) — the violation is that the CALL SITE is the component, not a domain-object method,
so the component is deciding when/how a calculation runs rather than reading a value the
domain object already exposes.

## Cause

Same root cause as the `UiParams`/`AppState` findings this session: `state.P` was treated as
if it were the domain object itself (readable/computable-from directly, anywhere), rather than
`ManagedOpenISDProject` being the one place that owns box/PR/driver state and the one place
permitted to expose a calculated value from it.

## Fix

Each of the computed values above is now a method on `ManagedOpenISDProject`
(`sealedResonance()`, `prSystemTuning_hz()`, `portPipeResonance_hz()`, `prVas_l()`, `prFs_hz()`,
`prFsWithMass_hz()`, `prQms()`), matching the `ventArea_m2()`/`ventEffectiveLength_m()` pattern.
`OriginalShell.vue`'s `computed()`s are now one-line reads of those methods.
`Rs`/`Ql`/`Qa`/`lossMode` stay as method parameters — they are `UiParams` fields, not yet part of
`_OpenISDProjectJson`, so the domain object cannot read them internally yet.

The remaining ~21 of the 31 `computed()`s in `OriginalShell.vue` were reviewed and are legitimate
UI-only state (tab selection, layout collapse flags, chart metadata, entered-field E/C/N state
already delegating to `store.ts`) — not calculation orchestration, out of this bug's scope.

## Verification

`npx vue-tsc --noEmit -p packages/ui` — no new errors (same 33 pre-existing, all unrelated).
`npx vitest run packages/ui/test/ui/architecture.test.ts packages/ui/test/logic` — same 5
pre-existing failures (the expected-red global-symbols gate), no regressions.
