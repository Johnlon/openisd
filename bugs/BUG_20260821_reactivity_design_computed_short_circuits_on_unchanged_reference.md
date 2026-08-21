Status: OPEN

# `docs/design/REACTIVITY.md`'s `createLiveRef` code sample never invalidates a real consumer

## Symptom

The design's own code sample —

```ts
export function createLiveRef<T extends { subscribe(fn: () => void): () => void }>(obj: T) {
  const version = shallowRef(0);
  const stop = obj.subscribe(() => { version.value++; });
  return { live: computed(() => { void version.value; return obj; }), dispose: stop };
}
```

— produces a `live` that never re-triggers anything downstream, no matter how many times the
subscribable notifies. `version` does increment and `live`'s getter does re-run, but nothing
that reads `live.value` (a template render effect, a `watchEffect`, another `computed`) ever
re-runs after the first read.

## Evidence

Reproduced directly against the project's own Vue 3.5.38 (`node_modules/vue`), inside
`packages/ui`'s vitest `node` environment — no jsdom, no component, isolating the reactivity
engine itself:

```ts
import { shallowRef, computed, effect } from 'vue';

const obj = { subscribe(fn: () => void) { /* store fn, return unsub */ } };
const version = shallowRef(0);
let notify: () => void;
obj.subscribe(() => { version.value++; }); // captures notify
const live = computed(() => { void version.value; return obj; });
let runs = 0;
effect(() => { runs++; void live.value; }); // render-effect stand-in
console.log(runs);   // 1
notify();
console.log(runs);   // still 1 — the effect never re-ran
```

Isolated further: the same construction with `live`'s getter returning a FRESH literal each call
(`return {y: 2}`) instead of the fixed `obj` reference makes the effect re-run correctly (`runs`
becomes 2). The variable is exactly and only whether the computed's returned value is
reference-identical across evaluations.

## Cause

Vue 3's `computed()` short-circuits propagation: when a computed re-evaluates because one of its
own dependencies changed, it still compares the new return value against the cached one via
`hasChanged` (`Object.is`), and — if they are equal — does NOT bump the version that its own
dependents track. A `watchEffect`, a render effect, or an outer `computed` reading `live.value`
is one of `live`'s dependents; if `live`'s return value is unchanged, that dependent is never
marked dirty and never re-runs. This is documented Vue behaviour (a computed's own re-evaluation
does not imply its consumers re-run unless the *value* differs), not a bug in Vue.

`createLiveRef`'s entire contract is "return the SAME object every time" (`REACTIVITY.md`:
"`.live` returns the object, never a copy"). That is precisely the case Vue's short-circuit
defeats: the returned reference is invariant by design, so `hasChanged` is always `false`, so no
consumer downstream of `live` is ever invalidated after its first read — the described mechanism
cannot work as written.

## Fix

`shallowRef` + `triggerRef` deliver the same intent (identity-based invalidation on a
notification, no value comparison) without the short-circuit: `triggerRef` unconditionally
notifies a ref's subscribers regardless of whether `.value` changed by reference or equality —
the documented Vue idiom for exactly this "mutated in place, identity unchanged" case.
`packages/ui/src/logic/liveProject.ts` implements `createLiveRef` this way; its `live` is a
`shallowRef<T>` set once to `obj` and never reassigned, invalidated via `triggerRef(live)` inside
the subscribe callback, exposed to callers typed `Readonly<ShallowRef<T>>` — the design's
read-only guarantee enforced by the type itself, not by convention.

## Verification

`packages/ui/test/logic/liveProject.test.ts` — `'a Vue effect reading .live re-evaluates on
every notification, and not otherwise'` — uses `effect()` from `vue` directly (not a nested
`computed`, which would mask the exact failure mode above only weakly) against a fake
subscribable, and asserts run counts before/after `dispose()`. Green after the `triggerRef` fix;
red (`1 !== 2`) against the design doc's literal `computed`-based sample, reproduced three
independent ways during diagnosis (see Evidence).
