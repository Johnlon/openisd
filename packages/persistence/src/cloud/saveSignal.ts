export interface SaveSignal {
  notify(): void;
  listen(fn: () => void): () => void;
}

export function createSaveSignal(): SaveSignal {
  const listeners: (() => void)[] = [];

  function notify(): void {
    const targets = [...listeners];
    for (const fn of targets) {
      fn();
    }
  }

  function listen(fn: () => void): () => void {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    };
  }

  return {
    notify,
    listen,
  };
}
