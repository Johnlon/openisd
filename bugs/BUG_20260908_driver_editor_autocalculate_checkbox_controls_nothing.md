# The driver editor's "auto-calculate" checkbox controls nothing

Status: OPEN

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

Not yet applied. Two honest options, and it is a product decision:

1. **Delete the checkbox.** The solver always derives, so the choice it offers does not exist.
   Smallest change, and it stops the UI claiming a capability the app lacks.
2. **Make it mean something.** If a user genuinely wants to stop the solver filling fields in —
   to enter a datasheet's numbers verbatim and see exactly which are stated versus derived — that
   is a real feature, and it needs a domain setting to hang on.

Recommend 1 unless John wants 2: the app already distinguishes stated from derived values through
cell state, which is most of what 2 would buy.

## Interim

The migration binds the checkbox to a local `ref` so the component compiles and the box still
toggles, WITHOUT pretending to drive the solver. A `FIXME` at the binding names this file. This is
a holding position, not the fix — the control remains inert either way, and the interim only stops
it being a typecheck error.

## Verification

Not yet verified — no fix applied.
