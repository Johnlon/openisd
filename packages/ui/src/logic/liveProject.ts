/**
 * The delegate-free reactivity adapter (`docs/design/REACTIVITY.md`).
 *
 * The domain publishes a change channel (`subscribe(fn): () => void`); this turns each
 * notification into a Vue invalidation. `.live` always returns the SAME subscribable object —
 * never a copy, never a wrapper around one field of it — so a caller reads it and then calls the
 * domain object's own methods directly. That is what makes a per-field accessor unnecessary: one
 * adapter covers every method the object has, including ones added later.
 *
 * Framework boundary: this file is the only place in `logic/` that imports Vue's reactivity
 * primitives for this purpose. The subscribable itself (`ManagedOpenISDProject`) stays
 * framework-free — it exports plain `subscribe()`, nothing Vue-shaped.
 */
import { shallowRef, triggerRef, type ShallowRef } from 'vue';

/** Anything that publishes a plain-JS change channel: `subscribe(fn)` registers a listener and
 *  returns the function that removes it. `ManagedOpenISDProject` satisfies this without
 *  importing this file or Vue; the type is generic over anything else that does too. */
export interface Subscribable {
  subscribe(fn: () => void): () => void;
}

/** `live` — the given object, wrapped so that reading `.value` inside a template, `watchEffect`
 *  or `computed` registers a dependency that invalidates on every notification from `obj`.
 *  `dispose()` removes the subscription; call it when the owner of `obj` is discarded, or a
 *  closed object's listener keeps it alive.
 *
 *  A plain `computed(() => { void version.value; return obj; })` does NOT work here: `obj`'s
 *  reference never changes, so Vue's computed short-circuits and never propagates to a consumer
 *  (`BUG_20260821_reactivity_design_computed_short_circuits_on_unchanged_reference.md`).
 *  `triggerRef` bypasses that value comparison — it notifies `live`'s subscribers
 *  unconditionally, which is what "the object mutated in place, identity unchanged" needs. */
export interface LiveRef<T> {
  live: Readonly<ShallowRef<T>>;
  dispose: () => void;
}

export function createLiveRef<T extends Subscribable>(obj: T): LiveRef<T> {
  const live = shallowRef(obj) as ShallowRef<T>;
  const stop = obj.subscribe(() => { triggerRef(live); });
  return { live, dispose: stop };
}
