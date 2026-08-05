import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Dismiss a modal/overlay when the user presses Escape.
 *
 * Design rule (.claude/rules/openisd-ui-design.md): pressing Escape dismisses any open
 * modal. Every modal component uses this composable rather than hand-rolling a
 * keydown listener, so the behaviour is consistent and can't be forgotten.
 *
 * Escape dismisses ONE dialog — the top-most open one. Registrations form a stack in
 * mount order, so a dialog opened over another (the driver editor over the library
 * picker) takes the key and the dialog underneath stays open, which is what "cancel
 * takes me back where I was" requires.
 *
 * @param isOpen  reactive getter — true while the modal is shown
 * @param onClose called when Escape is pressed and this is the top-most open modal
 */

interface Registration { isOpen: () => boolean; onClose: () => void }

const stack: Registration[] = [];

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].isOpen()) { stack[i].onClose(); return; }
  }
}

export function useEscToClose(isOpen: () => boolean, onClose: () => void): void {
  const reg: Registration = { isOpen, onClose };
  onMounted(() => {
    if (!stack.length) window.addEventListener('keydown', onKeydown);
    stack.push(reg);
  });
  onBeforeUnmount(() => {
    const i = stack.indexOf(reg);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) window.removeEventListener('keydown', onKeydown);
  });
}
