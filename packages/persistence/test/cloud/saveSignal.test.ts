import {describe, it, expect, vi} from 'vitest';
import {createSaveSignal} from '../../src/cloud/saveSignal.js';

describe('createSaveSignal', () => {
  it('notifies registered listeners when notify() is called', () => {
    const signal = createSaveSignal();
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    signal.listen(listenerA);
    signal.listen(listenerB);

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).not.toHaveBeenCalled();

    signal.notify();

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes listener when the returned function is called', () => {
    const signal = createSaveSignal();
    const listener = vi.fn();

    const unsubscribe = signal.listen(listener);
    signal.notify();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    signal.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('handles unsubscribing multiple times safely', () => {
    const signal = createSaveSignal();
    const listener = vi.fn();

    const unsubscribe = signal.listen(listener);
    unsubscribe();
    unsubscribe();

    signal.notify();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies multiple times on repeated notify() calls', () => {
    const signal = createSaveSignal();
    const listener = vi.fn();

    signal.listen(listener);
    signal.notify();
    signal.notify();
    signal.notify();

    expect(listener).toHaveBeenCalledTimes(3);
  });
});
