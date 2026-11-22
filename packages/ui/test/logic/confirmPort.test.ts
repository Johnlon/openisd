import {describe, expect, it} from 'vitest';
import {createConfirmPort, type ConfirmRequest} from '../../src/logic/confirmPort.js';

describe('createConfirmPort', () => {
  it('resolves true when answer(true) is called', async () => {
    const { port, state } = createConfirmPort();
    const request: ConfirmRequest = {
      title: 'Test',
      message: 'Test message',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    };

    const promise = port.ask(request);
    expect(state.current.value).not.toBeNull();
    expect(state.current.value?.request).toEqual(request);

    state.answer(true);
    await expect(promise).resolves.toBe(true);
    expect(state.current.value).toBeNull();
  });

  it('resolves false when answer(false) is called', async () => {
    const { port, state } = createConfirmPort();
    const request: ConfirmRequest = {
      title: 'Test',
      message: 'Test message',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    };

    const promise = port.ask(request);
    state.answer(false);
    await expect(promise).resolves.toBe(false);
  });

  it('queues multiple asks and processes them in order', async () => {
    const { port, state } = createConfirmPort();
    const request1: ConfirmRequest = { title: '1', message: 'First', confirmLabel: 'Yes', cancelLabel: 'No' };
    const request2: ConfirmRequest = { title: '2', message: 'Second', confirmLabel: 'Yes', cancelLabel: 'No' };
    const request3: ConfirmRequest = { title: '3', message: 'Third', confirmLabel: 'Yes', cancelLabel: 'No' };

    const p1 = port.ask(request1);
    const p2 = port.ask(request2);
    const p3 = port.ask(request3);

    expect(state.current.value?.request).toEqual(request1);

    state.answer(true);
    await expect(p1).resolves.toBe(true);
    expect(state.current.value?.request).toEqual(request2);

    state.answer(false);
    await expect(p2).resolves.toBe(false);
    expect(state.current.value?.request).toEqual(request3);

    state.answer(true);
    await expect(p3).resolves.toBe(true);
    expect(state.current.value).toBeNull();
  });

  it('second ask waits its turn while first is pending', async () => {
    const { port, state } = createConfirmPort();
    const request1: ConfirmRequest = { title: '1', message: 'First', confirmLabel: 'Yes', cancelLabel: 'No' };
    const request2: ConfirmRequest = { title: '2', message: 'Second', confirmLabel: 'Yes', cancelLabel: 'No' };

    const p1 = port.ask(request1);
    const p2 = port.ask(request2);

    // First request should be current
    expect(state.current.value?.request).toEqual(request1);
    // Second request should be queued, not current
    expect(state.current.value?.request).not.toEqual(request2);

    // Resolve first
    state.answer(true);
    await expect(p1).resolves.toBe(true);

    // Now second should be current
    expect(state.current.value?.request).toEqual(request2);

    state.answer(false);
    await expect(p2).resolves.toBe(false);
  });

  it('answer() with no pending request does nothing', () => {
    const { state } = createConfirmPort();
    expect(() => state.answer(true)).not.toThrow();
    expect(() => state.answer(false)).not.toThrow();
  });
});