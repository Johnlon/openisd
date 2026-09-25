# Tune-panel tests call appState APIs that no longer exist

Status: OPEN

## Symptom

```
Error: page.evaluate: TypeError: s.driverCell is not a function
    at eval (eval at evaluate (:303:30), <anonymous>:4:17)
```

`packages/ui/test/logic/tune-panel-fields.browser.spec.ts` reaches into the store from the
browser and calls two things that are gone:

```ts
// :31-38
const s = await import(/* @vite-ignore */ '/src/logic/appState.ts');
const c = s.driverCell(f);          // not a function

// :40-46
return s.state.P.Vb;                // `state` is not exported either
```

Neither survives in the source:

```
$ command grep -rn "driverCell" packages/ui/src/     # no matches
```

`state` is the very export QO121 proposes deleting ("Delete appState.ts state/state.box/
state.project — app is project-or-no-project"), and `no-seed-project.test.ts` already asserts
`'state' in appState === false`.

## Impact

Five tests in this spec are dead. They cover the Tune panel's model-level verdict for a field —
that editing a Tune field writes the driver cell and that clearing returns it to Calculated —
which is the panel's whole contract. The pixel assertions beside them keep passing, so the
suite looks like it covers the panel when the model half of it never runs.

It also means these tests reach past the DOM into the store, which is why they broke: a browser
spec importing `/src/logic/appState.ts` is testing the module, not the app.

## Cause

The model→design migration replaced `driverCell(field)` and the `state` mirror with the
project's own cell API (`project.driver.spec[section].<Field>.get()`), and this spec was not
migrated with the modules it reaches into.

## Fix

Read the value the way the panel itself does, through the focused project rather than a
removed store export — or, better, assert through the DOM the panel renders, since the class
on the field (`value-e` / `value-c` / `value-n`) is exactly the state these tests want and is
already what the neighbouring assertions read.

The second option also removes the `/src/logic/appState.ts` dynamic import, which is the
coupling that let this rot unnoticed.

## Verification

```
npx playwright test packages/ui/test/logic/tune-panel-fields.browser.spec.ts --workers=1
```
currently fails with the TypeError above.
