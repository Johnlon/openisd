import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import { focusLeft } from './focusLeft.js';

/**
 * A pop-up menu closes when the user leaves it (John, 18 Nov 2026, QO946.c253: "the drop down menu on the
 * chart needs to dismiss if it lose focus"; "at present have to click the header again"): a press anywhere
 * outside it, Escape, or keyboard focus moving outside it. `inside` are the elements that count as the menu
 * (its trigger and its list): a press on the trigger is left to the trigger's own toggle.
 */
export function useDismissOnOutside(open: Ref<boolean>, inside: readonly Ref<HTMLElement | null>[], close: () => void): void {
  const outside = (target: EventTarget | null): boolean => inside.every(r => focusLeft(r.value, target));
  const onPointerDown = (e: PointerEvent): void => { if (outside(e.target)) close(); };
  const onFocusIn = (e: FocusEvent): void => { if (outside(e.target)) close(); };
  const onKeyDown = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  function listen(on: boolean): void {
    const act = on ? document.addEventListener.bind(document) : document.removeEventListener.bind(document);
    act('pointerdown', onPointerDown, true);
    act('focusin', onFocusIn);
    act('keydown', onKeyDown);
  }
  onMounted(() => { watch(open, o => listen(o), { immediate: true }); });
  onUnmounted(() => listen(false));
}
