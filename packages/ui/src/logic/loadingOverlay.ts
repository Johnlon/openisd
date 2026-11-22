import {
  isOverlayDueToShow,
  mayOverlayHide,
  overlayRemainingDisplayMs,
} from '@openisd/design';

export interface LoadingOverlayElement {
  style: {
    display: string;
  };
}

export interface VisibilityTarget {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface OverlayClock {
  now(): number;
  schedule(fn: () => void, ms: number): () => void;
}

export interface LoadingOverlayDeps {
  element: LoadingOverlayElement;
  visibilityTarget: VisibilityTarget;
  clock: OverlayClock;
  initialShownAt?: number;
}

export interface LoadingOverlay {
  onAppMounted(): void;
  dispose(): void;
}

export function createLoadingOverlay(deps: LoadingOverlayDeps): LoadingOverlay {
  let isMounted = false;
  let shownAt = deps.initialShownAt ?? deps.clock.now();
  let hiddenAt: number | null = deps.visibilityTarget.visibilityState === 'hidden' ? shownAt : null;
  let cancelHide: (() => void) | null = null;

  function show(): void {
    deps.element.style.display = 'flex';
  }

  function hide(): void {
    deps.element.style.display = 'none';
  }

  function tryHide(): void {
    if (mayOverlayHide(shownAt, deps.clock.now(), isMounted)) {
      cancelHide?.();
      cancelHide = null;
      hide();
    } else if (isMounted) {
      scheduleHide();
    }
  }

  function scheduleHide(): void {
    cancelHide?.();
    const delay = overlayRemainingDisplayMs(shownAt, deps.clock.now());
    cancelHide = deps.clock.schedule(() => {
      cancelHide = null;
      tryHide();
    }, delay);
  }

  function onVisibilityChange(): void {
    const state = deps.visibilityTarget.visibilityState;
    const now = deps.clock.now();
    if (state === 'hidden') {
      hiddenAt = now;
    } else if (state === 'visible') {
      if (hiddenAt !== null && isOverlayDueToShow(hiddenAt, now)) {
        shownAt = now;
        show();
        scheduleHide();
      }
      hiddenAt = null;
    }
  }

  deps.visibilityTarget.addEventListener('visibilitychange', onVisibilityChange);

  return {
    onAppMounted(): void {
      isMounted = true;
      tryHide();
    },
    dispose(): void {
      deps.visibilityTarget.removeEventListener('visibilitychange', onVisibilityChange);
      cancelHide?.();
      cancelHide = null;
    },
  };
}
