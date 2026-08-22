# Reactivity without a delegate layer

Unblocks objective 2 of [`PLAN_QO60_LAYERING_REMEDIATION.md`](../plans/PLAN_QO60_LAYERING_REMEDIATION.md):
deleting `state.P`'s 19 accessor properties removes what currently makes box, vent and PR fields
reactive to templates, so the replacement has to exist before they go.

## The constraint that rules out the obvious answers

Four standing rules bear on this at once, and each kills a different candidate:

| rule | what it kills |
|---|---|
| Callers talk DIRECT to the domain object; the 37 delegates are deleted | a per-field reactive wrapper — that IS the delegate layer under another name |
| `@openisd/model` may not depend on the UI framework | making `_OpenISDProjectJson` a Vue `reactive()` inside the model |
| The UI must never talk to a JSON shape | a reactive copy of the record handed to templates |
| No module-level mutable state outside the approved stores | a free-floating `ref` per field |

So the answer cannot be "wrap each value", "make the model reactive", or "expose the data".

## The mechanism already exists and the UI does not use it

`ManagedOpenISDProject` carries `#listeners`, `subscribe(fn): () => void` and a private `#notify()`
called, unconditionally, at the end of every public mutator — the four driver methods
(`enter`/`clear`/`enterMeta`/`clearMeta`), `mutate()` (box/vent/PR/environment/signal/sim-option/
sweep/filter writes), and the what-if lifecycle methods when they actually change which layer is
effective. `OpenISDDriver` itself carries no channel of its own (QO71, 2026-08-21: its `subscribe`/
`#listeners`/`#notify` had zero consumers and were deleted) — a driver-field edit reaches
`ManagedOpenISDProject`'s `#notify()` directly, by call, not by subscription, precisely so
re-materialising the effective layer's `OpenISDDriver` on every `mutate()` can never orphan a
bridge subscribed to the old instance.

That is a complete change-notification channel, framework-free, owned by the domain. `logic/
liveProject.ts`'s `createLiveRef()` is what actually subscribes to it, turning each notification
into a Vue invalidation — see `Subscribable`/`createLiveRef()` below.

## The design: ONE adapter, not one wrapper per field

`logic/` adapts the domain's own channel to Vue. The model publishes; the UI layer subscribes.

```ts
// packages/ui/src/logic/liveProject.ts

/**
 * The focused project, as a value whose IDENTITY changes whenever the project changes.
 *
 * The domain object is framework-free and stays that way: this subscribes to the change
 * channel `ManagedOpenISDProject` already publishes and turns each notification into a Vue
 * invalidation. Anything that reads `liveProject` — a template, a computed — re-evaluates on
 * the next change, so a caller can invoke the domain object's methods DIRECTLY and still be
 * reactive. That is what makes the 19 `state.P` accessors and the five `_version` delegates
 * unnecessary rather than merely relocated.
 */
const version = shallowRef(0);
managedProject.subscribe(() => { version.value++; });

export const liveProject = computed(() => {
  void version.value;          // the dependency; the value is the domain object itself
  return managedProject;
});
```

A template then calls the domain directly, which is the ruling:

```vue
<input :value="liveProject.boxVolume_m3()"
       @change="e => liveProject.setBoxVolume_m3(Number(e.target.value))">
```

`state.P.Vb` becomes `liveProject.boxVolume_m3()`. No wrapper is written for `Vb`, or for any of
the other eighteen: one binding covers every method the object has, including ones added later.

## Why this satisfies each rule

- **No delegates.** Nothing forwards a call. `liveProject` returns the object; the caller invokes
  the method. Deleting `liveProject` would not just change a stack trace — it would remove the
  reactivity, so it is a real adapter, not a zero-value forward.
- **Model stays framework-free.** `subscribe()` is plain JS the model already exports. `shallowRef`
  and `computed` are imported in `logic/`, where Vue is allowed.
- **No JSON crosses.** The value handed to the UI is the domain object, never a record.
- **Inversion of control.** The adapter takes the subscribable as an argument, so a test drives it
  with a fake and no component needs mounting:

  ```ts
  export function createLiveRef<T extends { subscribe(fn: () => void): () => void }>(obj: T) {
    const version = shallowRef(0);
    const stop = obj.subscribe(() => { version.value++; });
    return { live: computed(() => { void version.value; return obj; }), dispose: stop };
  }
  ```

## The honest cost

**Invalidation is COARSE.** Any change to the project re-evaluates everything reading
`liveProject`, because one counter stands for the whole object. Editing the vent diameter
re-evaluates a computed that only reads `Ql`.

This is not a regression: `state.P` is one `reactive()` object today and the five `_version`
delegates already invalidate on any change, so the current granularity is the same. It is a
deliberate trade — one adapter and direct domain calls, against per-field dependency tracking that
would require exactly the wrapper layer the ruling deletes.

If a hot path is ever measured to suffer, the fix is a second counter for that sub-object
(`liveBox`, `liveDriver`) fed by the same channel — not a return to per-field accessors.

## What must be true before objective 2 lands

1. `ManagedOpenISDProject.subscribe` is public and exported on the public surface rather than
   used only internally.
2. Every mutating method on `ManagedOpenISDProject` calls `#notify()`. The ones that change which
   LAYER is effective (`beginWhatIf`/`cancelWhatIf`) already do. A mutator that forgets is a
   silently stale UI, and it is the one failure mode this design has — worth an architecture gate
   asserting that every public mutator notifies.
3. The subscription is disposed when the project is replaced, or a closed project's listener keeps
   a dead object alive.

## What this does NOT settle

`BUG_20260820_syncedp_filters_deep_copy_is_a_reactivity_workaround.md` is a separate instance of
the same subject and is not fixed by this. `syncedP` deep-copies `state.P.filters` on every
recompute purely to touch each nested field so Vue registers a dependency. Once `filters` is read
through the domain object and invalidation comes from the change channel, that copy has no job —
but the fix belongs with that bug, not here.
