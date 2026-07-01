import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Dismiss a modal/overlay when the user presses Escape.
 *
 * Design rule (.claude/context/ui-rules.md): pressing Escape dismisses any open
 * modal. Every modal component uses this composable rather than hand-rolling a
 * keydown listener, so the behaviour is consistent and can't be forgotten.
 *
 * @param {() => boolean} isOpen  reactive getter — true while the modal is shown
 * @param {() => void}    onClose called when Escape is pressed and isOpen() is true
 */
export function useEscToClose(isOpen, onClose) {
  function handler(e) {
    if (e.key === 'Escape' && isOpen()) onClose();
  }
  onMounted(() => window.addEventListener('keydown', handler));
  onBeforeUnmount(() => window.removeEventListener('keydown', handler));
}
