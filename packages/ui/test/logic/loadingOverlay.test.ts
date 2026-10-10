import {describe, expect, it} from 'vitest';
import {
  type LoadingOverlayElement,
  type OverlayClock,
  type VisibilityTarget,
  createLoadingOverlay,
} from '../../src/logic/loadingOverlay.js';

interface ScheduledTask {
  fn: () => void;
  fireAt: number;
  cancelled: boolean;
}

class FakeClock implements OverlayClock {
  currentTime = 0;
  private tasks: ScheduledTask[] = [];

  now(): number {
    return this.currentTime;
  }

  schedule(fn: () => void, ms: number): () => void {
    const task: ScheduledTask = {
      fn,
      fireAt: this.currentTime + ms,
      cancelled: false,
    };
    this.tasks.push(task);
    return () => {
      task.cancelled = true;
    };
  }

  advance(ms: number): void {
    this.currentTime += ms;
    while (true) {
      const due = this.tasks
        .filter(t => !t.cancelled && t.fireAt <= this.currentTime)
        .sort((a, b) => a.fireAt - b.fireAt)[0];
      if (!due) break;
      this.tasks = this.tasks.filter(t => t !== due);
      due.fn();
    }
  }

  pendingCount(): number {
    return this.tasks.filter(t => !t.cancelled).length;
  }
}

class FakeVisibilityTarget implements VisibilityTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  private listeners: (() => void)[] = [];

  addEventListener(type: 'visibilitychange', listener: () => void): void {
    if (type === 'visibilitychange') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: 'visibilitychange', listener: () => void): void {
    if (type === 'visibilitychange') {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  }

  dispatch(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  listenerCount(): number {
    return this.listeners.length;
  }
}

describe('LoadingOverlay wiring', () => {
  it('stays visible until app is mounted AND at least 0.7 s have passed', () => {
    const clock = new FakeClock();
    const visibilityTarget = new FakeVisibilityTarget();
    const element: LoadingOverlayElement = {
      style: {display: 'flex'},
    };

    const overlay = createLoadingOverlay({
      element,
      visibilityTarget,
      clock,
      initialShownAt: 0,
    });

    expect(element.style.display).toBe('flex');

    // App mounts early at 200 ms (< 700 ms)
    clock.advance(200);
    overlay.onAppMounted();

    // Must still be showing because 0.7 s have not elapsed
    expect(element.style.display).toBe('flex');

    // Advance to 699 ms -> still visible
    clock.advance(499);
    expect(element.style.display).toBe('flex');

    // Advance to 700 ms -> hides
    clock.advance(1);
    expect(element.style.display).toBe('none');
  });

  it('hides immediately upon mount if mounting takes longer than 0.7 s', () => {
    const clock = new FakeClock();
    const visibilityTarget = new FakeVisibilityTarget();
    const element: LoadingOverlayElement = {
      style: {display: 'flex'},
    };

    const overlay = createLoadingOverlay({
      element,
      visibilityTarget,
      clock,
      initialShownAt: 0,
    });

    // Advance past 700 ms before app mounts
    clock.advance(1_200);
    // Not mounted yet -> still visible
    expect(element.style.display).toBe('flex');

    // App finishes mounting
    overlay.onAppMounted();
    // Hides immediately
    expect(element.style.display).toBe('none');
  });

  it('shows again when page becomes visible after having been hidden for > 30 s, and stays for at least 0.7 s', () => {
    const clock = new FakeClock();
    const visibilityTarget = new FakeVisibilityTarget();
    const element: LoadingOverlayElement = {
      style: {display: 'flex'},
    };

    const overlay = createLoadingOverlay({
      element,
      visibilityTarget,
      clock,
      initialShownAt: 0,
    });

    // Mount and let initial 700 ms expire
    overlay.onAppMounted();
    clock.advance(700);
    expect(element.style.display).toBe('none');

    // Page hidden at t = 1,000
    clock.advance(300);
    visibilityTarget.dispatch('hidden');

    // Case A: Page becomes visible after only 15 s (not > 30 s)
    clock.advance(15_000);
    visibilityTarget.dispatch('visible');
    expect(element.style.display).toBe('none');

    // Page hidden again at t = 16,000
    visibilityTarget.dispatch('hidden');

    // Case B: Page becomes visible after 35 s (> 30 s)
    clock.advance(35_000);
    visibilityTarget.dispatch('visible');

    // Must be showing again!
    expect(element.style.display).toBe('flex');

    // Stays showing for at least 700 ms
    clock.advance(699);
    expect(element.style.display).toBe('flex');

    // Once 700 ms have passed, it hides again
    clock.advance(1);
    expect(element.style.display).toBe('none');
  });

  it('does not redisplay if page becomes visible exactly at 30 s (must be strictly more than 30 s)', () => {
    const clock = new FakeClock();
    const visibilityTarget = new FakeVisibilityTarget();
    const element: LoadingOverlayElement = {
      style: {display: 'flex'},
    };

    const overlay = createLoadingOverlay({
      element,
      visibilityTarget,
      clock,
      initialShownAt: 0,
    });

    overlay.onAppMounted();
    clock.advance(700);
    expect(element.style.display).toBe('none');

    visibilityTarget.dispatch('hidden');
    clock.advance(30_000);
    visibilityTarget.dispatch('visible');

    expect(element.style.display).toBe('none');
  });

  it('dispose unregisters the visibilitychange listener and cancels pending timers', () => {
    const clock = new FakeClock();
    const visibilityTarget = new FakeVisibilityTarget();
    const element: LoadingOverlayElement = {
      style: {display: 'flex'},
    };

    const overlay = createLoadingOverlay({
      element,
      visibilityTarget,
      clock,
      initialShownAt: 0,
    });

    expect(visibilityTarget.listenerCount()).toBe(1);

    overlay.onAppMounted();
    expect(clock.pendingCount()).toBe(1);

    overlay.dispose();
    expect(visibilityTarget.listenerCount()).toBe(0);
    expect(clock.pendingCount()).toBe(0);
  });
});
