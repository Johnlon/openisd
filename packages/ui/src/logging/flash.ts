import { ref, type Ref } from 'vue';

// The application's event surface — the one way anything below the UI says something to the
// user. A LEAF: it depends on no other module, and nothing it does needs one.

/** How long a flash stays on screen. */
const VISIBLE_MS = 2000;

export interface Logging {
  /** The message on screen right now, or '' when there is none. */
  readonly message: Ref<string>;
  /** Show a message for VISIBLE_MS, replacing whatever is showing. */
  flash(msg: string): void;
}

/**
 * Build the logging surface. Constructed once by the composition root and handed to whoever
 * needs it — a module-level instance could not be substituted, so every consumer of one
 * would be untestable without a DOM.
 */
export function createLogging(): Logging {
  const message = ref('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    message,
    flash(msg: string): void {
      message.value = msg;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { message.value = ''; }, VISIBLE_MS);
    },
  };
}
