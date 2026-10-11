import {shallowRef, type Ref} from 'vue';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface ConfirmPort {
  ask(request: ConfirmRequest): Promise<boolean>;
}

export interface PendingRequest {
  request: ConfirmRequest;
  resolve: (value: boolean) => void;
}

export interface ConfirmDialogState {
  current: Ref<PendingRequest | null>;
  answer: (result: boolean) => void;
}

export function createConfirmPort(): { port: ConfirmPort; state: ConfirmDialogState } {
  const queue: PendingRequest[] = [];
  const current = shallowRef<PendingRequest | null>(null);
  let processing = false;

  function processQueue(): void {
    if (processing || queue.length === 0) return;
    processing = true;
    const next = queue.shift()!;
    current.value = next;
  }

  function answer(result: boolean): void {
    const pending = current.value;
    if (!pending) return;
    current.value = null;
    pending.resolve(result);
    processing = false;
    processQueue();
  }

  function ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      queue.push({ request, resolve });
      processQueue();
    });
  }

  return {
    port: { ask },
    state: { current, answer },
  };
}