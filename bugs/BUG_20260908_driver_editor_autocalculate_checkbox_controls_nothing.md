# The driver editor's "auto-calculate" checkbox controls nothing

Status: RESOLVED — option 2, the checkbox now gates the solver on the editor's own draft driver.

## Symptom

The driver editor (Parameters tab) shows an "auto-calculate" checkbox. The setting it bound to no
longer exists in the domain, so ticking or clearing it changes nothing: the consistency solver
derives values either way. The control is inert while still presenting itself as a choice.

## Evidence

`packages/ui/src/ui/components/DriverEditorModal.vue:1065` binds the checkbox:

```html
<input type="checkbox" v-model="autoCalculate" />
```

`DriverEditorModal.vue:373` reads and writes a property that is not on the driver:

```ts
const autoCalculate = computed({
  get: () => draftDriver.value.autoCalculate,
  set: (val: boolean) => {
    draftDriver.value.autoCalculate = val;
```

Typecheck reports it absent on both lines:

```
DriverEditorModal.vue(374,32): Property 'autoCalculate' does not exist on type 'Raw<OpenISDDriver>'.
DriverEditorModal.vue(376,23): Property 'autoCalculate' does not exist on type 'Raw<OpenISDDriver>'.
```

Nothing under `packages/design` declares it:

```
$ command grep -rn "autoCalculate" packages/design/domain packages/design/engine
(no output)
```

## Cause

`packages/model`'s `OpenISDDriver` carried an `autoCalculate` flag that gated whether derived
values were computed. `packages/design`'s consistency solver always derives — deriving is what it
is for — so the flag had no counterpart and was not carried across in the migration. The
component kept the binding, so the control survived the setting it controlled.

## Fix

Option 2 (John, 2026-09-24): the checkbox stops the driver editor's own solver, retaining every
current value — OFF, clearing a field no longer pulls another back in behind it; turning ON
re-derives immediately. Scoped to the driver editor's detached draft only, never the project's
embedded driver.

`OpenISDDriverStandalone` (`packages/design/domain/openisdDomain.ts`) gets `#autoCalculate`
(default `true`), `autoCalculate` getter, `setAutoCalculate(enabled)`, and an overridden
`resolve()`: ON derives as before; OFF returns the cached `issues()` untouched.
`setAutoCalculate(true)` resolves immediately, catching up on everything written while OFF.
`OpenISDDriverEmbedded` is untouched — the flag does not exist there, by design.

`DriverDraft` (`packages/ui/src/logic/driverDraft.ts`) exposes `autoCalculate`/`setAutoCalculate`,
reached from the wider `OpenISDDriver`-typed `current` via an `instanceof
OpenISDDriverStandalone` guard (never a cast — every seed the editor holds is standalone, so the
`true`/no-op fallback is dead code by construction, not a live default).

`DriverEditorModal.vue`'s checkbox now binds to a `computed` wrapping `draft.autoCalculate`/
`draft.setAutoCalculate`, replacing the dead local `ref` and its `FIXME`.

## Verification

- `npx vitest run packages/design/test/domain.test.ts` — 216/216, including the new
  `OpenISDDriverStandalone.setAutoCalculate` describe block (default-on, freeze-on-clear,
  catch-up-on-resume, writes still accepted while off).
- `npx vitest run packages/ui/test/ui/driver-editor-units.test.ts` — 40/40, including a static
  check that the checkbox reads/writes `draft.autoCalculate`/`draft.setAutoCalculate` and the
  stale FIXME is gone.
- `npm run typecheck` — design/persistence/ui all `ok`.
- `npx vitest run packages/design packages/persistence packages/ui` — 155 files / 2417 tests
  passing.
