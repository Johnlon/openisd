import {ref, type Ref} from 'vue';

// The application's event surface — the one way anything below the UI says something to the
// user. A LEAF: it depends on no other module, and nothing it does needs one.

/** How long a one-line flash stays on screen. */
const VISIBLE_MS = 2000;
/** How much longer a flash stays for each line after its first: a line per value the opening
 *  repaired ("Series resistance -2 Ω in the file: set to 0 Ω, the least") must stay
 *  long enough to read (QO953.c31, "all you can do is show a toast"). */
const EXTRA_LINE_MS = 4000;

/** How long `msg` stays on screen: 2 s, and 4 s more for each line after the first. */
export function visibleMsOf(msg: string): number {
  return VISIBLE_MS + EXTRA_LINE_MS * (msg.split('\n').length - 1);
}

export interface Logging {
  /** The message on screen right now, or '' when there is none. */
  readonly message: Ref<string>;
  /** Show a message for `visibleMsOf(msg)`, replacing whatever is showing. */
  flash(msg: string): void;
}

/**
 * Build the logging surface. Constructed once by the composition root and handed to whoever
 * needs it — a module-level instance could not be substituted, so every consumer of one
 * would be untestable without a DOM.
 */
export function createLogging(): Logging {
  const message = ref('');
  // Whatever handle this platform's setTimeout hands back.
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    message,
    flash(msg: string): void {
      message.value = msg;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { message.value = ''; }, visibleMsOf(msg));
    },
  };
}
