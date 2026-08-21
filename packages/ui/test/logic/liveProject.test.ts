/**
 * `createLiveRef` (`docs/design/REACTIVITY.md`) — the delegate-free reactivity adapter.
 *
 * Seam under test: a FAKE subscribable, per the design's own inversion-of-control example. No
 * component mount, no `ManagedOpenISDProject` import — the adapter takes any object shaped
 * `{ subscribe(fn): () => void }` and turns its notifications into a Vue invalidation, so the
 * test proves the adapter's behaviour without any domain object at all.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { effect } from 'vue';
import { createLiveRef } from '../../src/logic/liveProject.js';

/** A minimal subscribable: `subscribe(fn)` registers `fn`, `notify()` fires every registered
 *  listener, `unsubscribeCount` proves `dispose()` actually called the stored unsubscribe. */
function fakeSubscribable() {
  const listeners = new Set<() => void>();
  let unsubscribeCount = 0;
  return {
    obj: {
      subscribe(fn: () => void): () => void {
        listeners.add(fn);
        return () => { listeners.delete(fn); unsubscribeCount++; };
      },
    },
    notify(): void { for (const fn of [...listeners]) fn(); },
    listenerCount(): number { return listeners.size; },
    unsubscribeCount(): number { return unsubscribeCount; },
  };
}

describe('createLiveRef', () => {
  it('subscribes to the given subscribable immediately', () => {
    const fake = fakeSubscribable();
    assert.equal(fake.listenerCount(), 0);
    createLiveRef(fake.obj);
    assert.equal(fake.listenerCount(), 1);
  });

  it('.live returns the SAME object handed in, not a copy', () => {
    const fake = fakeSubscribable();
    const { live } = createLiveRef(fake.obj);
    assert.equal(live.value, fake.obj);
  });

  it('a Vue effect reading .live re-evaluates on every notification, and not otherwise', () => {
    // `effect()` — a template render effect's own primitive, per `bugs/BUG_20260821_reactivity_
    // design_computed_short_circuits_on_unchanged_reference.md` — proves the case a `computed`
    // consumer of `live` cannot: `live.value` is the SAME object every read, so any check that
    // stops at a `computed`-of-`live` short-circuits before ever reaching a real consumer.
    const fake = fakeSubscribable();
    const { live } = createLiveRef(fake.obj);
    let runs = 0;
    const stopEffect = effect(() => { runs++; void live.value; });
    assert.equal(runs, 1); // effect() runs its function once on creation
    fake.notify();
    assert.equal(runs, 2);
    fake.notify();
    fake.notify();
    assert.equal(runs, 4);
    stopEffect.effect.stop();
    fake.notify();
    assert.equal(runs, 4); // stopped effect no longer re-runs
  });

  it('dispose() unsubscribes from the subscribable', () => {
    const fake = fakeSubscribable();
    const { dispose } = createLiveRef(fake.obj);
    assert.equal(fake.unsubscribeCount(), 0);
    dispose();
    assert.equal(fake.unsubscribeCount(), 1);
  });

  it('after dispose(), a further notification touches nothing (listener is gone)', () => {
    const fake = fakeSubscribable();
    const { dispose } = createLiveRef(fake.obj);
    dispose();
    assert.equal(fake.listenerCount(), 0);
    fake.notify(); // must not throw
  });
});
