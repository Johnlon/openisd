Status: RESOLVED

# Six components subscribe to `managedProject` per instance and never unsubscribe

## Symptom

Every mount of any of these components adds a listener to `ManagedOpenISDProject`'s `#listeners`
set that is never removed:

- `packages/ui/src/ui/App.vue:30`
- `packages/ui/src/ui/OriginalShell.vue:43` (`ui/shells/original/`)
- `packages/ui/src/ui/shells/original/OgTune.vue:22`
- `packages/ui/src/ui/shells/original/OgFilters.vue:28`
- `packages/ui/src/ui/components/AdvancedOptions.vue:23`
- `packages/ui/src/ui/components/PREditModal.vue:21`

each `const { live } = createLiveRef(managedProject);` — the returned `dispose` is destructured
away and discarded.

For a component behind a `v-if` that a user opens and closes repeatedly (`PREditModal`,
`AdvancedOptions`), the listener count grows without bound for the app's lifetime, and every
project mutation then calls `triggerRef` once per dead subscription as well as the live ones.

## Evidence

`grep -rn "dispose" packages/ui/src --include="*.vue"` returns nothing — no component calls it.
`grep -rn "onScopeDispose" packages/ui/src` returns nothing.
`createLiveRef` (`packages/ui/src/logic/liveProject.ts:39`) subscribes at construction:
`const stop = obj.subscribe(() => { triggerRef(live); });`
`ManagedOpenISDProject.subscribe` (`packages/ui/src/logic/managedProject.ts:657`) adds each
distinct closure to a `Set` and only removes it via the returned unsubscribe function.

## Cause

`createLiveRef`'s own contract puts disposal on the CALLER: "call it when the owner of `obj` is
discarded". That wording assumes the subscribable is the short-lived party. Here the reverse is
true — `managedProject` is the app-lifetime singleton and the SUBSCRIBER (the component) is the
ephemeral one — so the documented trigger for disposal ("the owner of `obj` is discarded") never
occurs, and no component developer is prompted by the contract to call it.

`docs/design/REACTIVITY.md` §"What must be true before objective 2 lands", item 3, states this
requirement — "The subscription is disposed when the project is replaced, or a closed project's
listener keeps a dead object alive" — and it is unmet in the direction that actually bites.

## Fix

Make disposal automatic instead of a caller obligation: call `onScopeDispose(stop)` inside
`createLiveRef` when an effect scope is active (a component `setup`), so a component instance's
subscription dies with the instance and a non-component caller (the store, a test) is unaffected
and keeps the explicit `dispose`.

## Verification

`packages/ui/src/logic/liveProject.ts`'s `createLiveRef` now calls `onScopeDispose(stop)` when
`getCurrentScope()` is truthy, right after subscribing.

`packages/ui/test/logic/liveProject.test.ts` adds two tests: "called inside an active effect
scope, disposes automatically when the scope stops" runs `createLiveRef` inside `effectScope()`
with `dispose` discarded (matching the six `.vue` call sites), stops the scope, and asserts the
fake's `unsubscribeCount()` is 1 and `listenerCount()` is back to 0. "called with no active
scope, does NOT auto-dispose" asserts a bare `createLiveRef` call (`store.ts`'s module-level
`live`) still only unsubscribes via its own returned `dispose()`, unchanged. Both pass; the six
`.vue` call sites (`App.vue`, `OriginalShell.vue`, `OgTune.vue`, `OgFilters.vue`,
`AdvancedOptions.vue`, `PREditModal.vue`) need no code change — each already runs inside its
component's `setup()` scope.
