/**
 * Keeps a field's note popup inside the window and inside the nearest scrolling container: when it
 * opens, the popup is measured against the field and the bounds and given inline offsets.
 */
import {nextTick, ref, watch, type CSSProperties, type Ref} from 'vue';
import {intersect, placeNote, type Rect} from './fieldNotePlacement.js';

function rectOf(box: DOMRect): Rect {
  return {left: box.left, top: box.top, right: box.right, bottom: box.bottom};
}

/** The window's rect cut down by every ancestor that clips or scrolls its content. */
function visibleBounds(from: HTMLElement): Rect {
  let bounds: Rect = {left: 0, top: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight};
  for (let el = from.parentElement; el !== null; el = el.parentElement) {
    const {overflowX, overflowY} = getComputedStyle(el);
    if (overflowX !== 'visible' || overflowY !== 'visible') bounds = intersect(bounds, rectOf(el.getBoundingClientRect()));
  }
  return bounds;
}

/** The inline style of the popup, set after it is shown; empty until measured. */
export function useFieldNotePlacement(field: Ref<HTMLElement | null>, note: Ref<HTMLElement | null>, open: Ref<boolean>): Ref<CSSProperties> {
  const style = ref<CSSProperties>({});
  watch(open, async isOpen => {
    if (!isOpen) { style.value = {}; return; }
    await nextTick();
    const fieldEl = field.value;
    const noteEl = note.value;
    if (fieldEl === null || noteEl === null) return;
    const offset = placeNote(rectOf(fieldEl.getBoundingClientRect()), {width: noteEl.offsetWidth, height: noteEl.offsetHeight}, visibleBounds(fieldEl));
    style.value = {left: `${offset.left}px`, top: `${offset.top}px`};
  });
  return style;
}
