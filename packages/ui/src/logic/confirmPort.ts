import {shallowRef, type Ref} from 'vue';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** Omitted: the dialog is a notice with only the confirm button (OK). */
  cancelLabel?: string;
  /** `buttonsOnly`: Esc and a click outside the dialog do nothing; only a button answers. Default `any`. */
  dismissal?: 'any' | 'buttonsOnly';
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
    if (processing) return;
    const next = queue.shift();
    if (next === undefined) return;
    processing = true;
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