Status: RESOLVED

# `ManagedOpenISDProject.enter/clear/enterMeta/clearMeta` never reach `#notify()`

## Symptom

`docs/design/REACTIVITY.md` states, as a precondition for objective 2 of
`PLAN_QO60_LAYERING_REMEDIATION.md`: "Every mutating method on `ManagedOpenISDProject` calls
`#notify()`... A mutator that forgets is a silently stale UI, and it is the one failure mode
this design has — worth an architecture gate asserting that every public mutator notifies."

`packages/ui/test/ui/architecture-notify.test.ts` implements that gate (AST call-graph
reachability to `#notify()` via ts-morph) and is RED against the current tree:

```
these public mutators never reach #notify() through any same-class call: enter, clear, enterMeta, clearMeta
```

## Evidence

`packages/ui/src/logic/managedProject.ts:190-201`:

```ts
enter(field: SpecField, value: number): void {
  this.#effective().openIsdDriver?.enter(field, value);
}
clear(field: SpecField): void {
  this.#effective().openIsdDriver?.clear(field);
}
enterMeta(field: MetaField, value: string): void {
  this.#effective().openIsdDriver?.enterMeta(field, value);
}
clearMeta(field: MetaField): void {
  this.#effective().openIsdDriver?.clearMeta(field);
}
```

None of the four calls `this.mutate(...)` or `this.#notify()`. Each delegates straight to
`OpenISDDriver`'s own `enter`/`clear`/`enterMeta`/`clearMeta`, which notify the DRIVER's own
`#listeners` — a channel `ManagedOpenISDProject` only bridges into its own `#listeners` from
inside `#openWhatIfOver()` (`managedProject.ts:401-407`, `layer.openIsdDriver?.subscribe(() =>
this.#notify())`), i.e. only while a what-if is open. Editing a driver field while no what-if
is open — `enterDriverField`/`clearDriverField` in `store.ts:382-387`, called with `#overlay ===
null` whenever `state.editDriver` is false — reaches zero `ManagedOpenISDProject` subscribers by
construction: not "sometimes doesn't fire", but no code path in the class connects these four
methods to `#notify()` at all.

Contrast with the box/vent/PR setters (`setBoxVolume_m3`, `setActiveVentField`, `setPrField`,
...): every one of them calls `this.mutate(...)`, and `mutate()`'s own body
(`managedProject.ts:349-356`) contains a `this.#notify()` call site — reachable by the AST gate
even though it is itself guarded by `if (this.#overlay?.kind === 'whatif')`. `enter`/`clear`/
`enterMeta`/`clearMeta` have no such call site anywhere in their reachable graph — the gate
distinguishes "reaches a notify call site, conditionally guarded" (passes) from "never reaches
one" (fails), and these four are the second kind.

## Cause

`enter`/`clear`/`enterMeta`/`clearMeta` were written to forward straight to the effective
layer's `OpenISDDriver`, relying on the driver's own notification channel — which
`ManagedOpenISDProject` only subscribes to for the DURATION of an open what-if
(`#openWhatIfOver`). Outside a what-if there is no subscription in either direction, so a
driver-field edit on committed state is invisible to anything that reads `ManagedOpenISDProject`
through its own `subscribe()` — including the `liveProject.ts` adapter this task builds, and the
existing `_version` bridge in `store.ts:98`.

## Fix

Human ruling: `docs/design/REACTIVITY.md` is the human-ruled authority and its "every public
mutator notifies" requirement supersedes `managedProject.test.ts`'s prior header treating
notify-only-during-what-if as the specification for these four methods.

`packages/ui/src/logic/managedProject.ts` — `enter`/`clear`/`enterMeta`/`clearMeta` each now
call `this.#notify()` directly, guarded to fire on exactly the complement of the existing
what-if bridge:

```ts
enter(field: SpecField, value: number): void {
  this.#effective().openIsdDriver?.enter(field, value);
  if (this.#overlay?.kind !== 'whatif') this.#notify();
}
```

(`clear`/`enterMeta`/`clearMeta` follow the identical shape.) While a what-if is open,
`#openWhatIfOver`'s bridge (`layer.openIsdDriver?.subscribe(() => this.#notify())`) already
delivers one notification from the driver's own `#notify()` inside `enter`/`clear`/`enterMeta`/
`clearMeta`; the explicit call above is skipped in that case (`this.#overlay?.kind !== 'whatif'`
is `false`) so exactly one notification reaches subscribers per mutation, in both modes — the
same complementary-guard idiom `loadDriverRecord` already used (`mutate()`'s own conditional
notify during what-if, paired with `if (this.#overlay?.kind !== 'whatif') this.#notify();`
outside it).

## Verification

`packages/ui/test/ui/architecture-notify.test.ts` — `'every public mutator's call graph reaches
#notify()'` — GREEN, unweakened.

`packages/ui/test/logic/managedProject.test.ts` — new describe block `'ManagedOpenISDProject —
every public mutator notifies exactly once (docs/design/REACTIVITY.md)'`:
- `'enter/clear/enterMeta/clearMeta notify on COMMITTED state — no what-if open'` — asserts a
  notification count of 1 after each of the four calls in sequence (previously untested; the
  prior header only implied silence).
- `'enter/clear/enterMeta/clearMeta notify EXACTLY ONCE during a live what-if — the driver
  bridge must not double-fire alongside an explicit notify'` — asserts the count still advances
  by exactly 1 per call, proving the bridge and the explicit call never both fire.

Both green; `npx vue-tsc -p packages/ui --noEmit` clean.
