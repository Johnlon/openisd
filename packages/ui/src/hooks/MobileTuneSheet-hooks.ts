/**
 * `MobileTuneSheet.vue`'s hook — the Tune bottom sheet on the mobile Graph page. Closed, it is a
 * pull-tab; tapped or dragged up, the sheet opens, a what-if begins, and the charts above stay
 * live. The drag handle sets the sheet's height; dragging it down far enough closes it. The
 * rows and the what-if come from the skin-neutral `createTuneSession`, shared with desktop Tune.
 *
 * Done closes the sheet and keeps the what-if on the charts; Cancel discards it and closes;
 * Reset puts the committed design back and keeps tuning.
 */
import {computed, ref} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import {projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {createTuneSession, type TuneRow} from './tuneSession.js';
import type {TuneField} from '@openisd/design/fields';

/** The sheet's open state, owned by the chart view (its Auto Y box follows it). */
export interface MobileTuneSheetDeps {
  open: () => boolean;
  setOpen: (open: boolean) => void;
}

/** The chart keeps at least this much height above the sheet. */
const MIN_CHART_PX = 120;
/** Dragging the sheet below this height closes it. */
const CLOSE_BELOW_PX = 90;
/** An upward drag on the pull-tab longer than this sets the opened sheet's height. */
const TAB_DRAG_PX = 12;
/** The pull-tab's own height, added back when an upward drag sizes the sheet. */
const TAB_PX = 28;

interface DragStart {
  readonly y: number;
  readonly height: number;
  readonly max: number;
}

export interface MobileTuneSheetAPI {
  readonly isOpen: ComputedRef<boolean>;
  readonly rows: ComputedRef<readonly TuneRow[]>;
  readonly sheetEl: Ref<HTMLElement | null>;
  /** The sheet's inline height: its default (CSS) until dragged. */
  readonly sheetStyle: ComputedRef<string>;
  setValue(tune: TuneField, v: number | null): void;
  openSheet(): void;
  done(): void;
  cancel(): void;
  reset(): void;
  onTabDown(e: PointerEvent): void;
  onTabUp(e: PointerEvent): void;
  onHandleDown(e: PointerEvent): void;
  onHandleMove(e: PointerEvent): void;
  onHandleUp(): void;
}

export function useMobileTuneSheet({ open, setOpen }: MobileTuneSheetDeps): MobileTuneSheetAPI {
  const project = useFocusedProject();
  const session = createTuneSession({ project, projectChanged });

  const isOpen = computed(() => open());
  const sheetEl = ref<HTMLElement | null>(null);
  const height = ref<number | null>(null);
  const sheetStyle = computed(() => height.value === null ? '' : `height: ${height.value}px`);

  /** An emptied field is left alone: every Tune slot holds a value. */
  function setValue(tune: TuneField, v: number | null): void {
    if (v !== null) session.set(tune, v);
  }

  function openSheet(): void {
    session.begin();
    setOpen(true);
  }
  function close(): void {
    height.value = null;
    setOpen(false);
  }
  function done(): void { close(); }
  function cancel(): void { session.cancel(); close(); }
  function reset(): void { session.reset(); }

  // Pull-tab: a tap opens (click); an upward drag also sizes the sheet to where the finger went.
  let tabStartY: number | null = null;
  function onTabDown(e: PointerEvent): void { tabStartY = e.clientY; }
  function onTabUp(e: PointerEvent): void {
    if (tabStartY === null) return;
    const up = tabStartY - e.clientY;
    tabStartY = null;
    if (up > TAB_DRAG_PX) height.value = up + TAB_PX;
  }

  // Drag handle: the sheet follows the finger, between nothing and leaving the chart its minimum.
  let drag: DragStart | null = null;
  function onHandleDown(e: PointerEvent): void {
    const el = sheetEl.value;
    if (el === null) return;
    const room = el.parentElement?.clientHeight ?? el.offsetHeight;
    drag = { y: e.clientY, height: el.offsetHeight, max: Math.max(room - MIN_CHART_PX, CLOSE_BELOW_PX) };
    if (e.target instanceof Element) e.target.setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: PointerEvent): void {
    if (drag === null) return;
    height.value = Math.min(drag.max, Math.max(0, drag.height + drag.y - e.clientY));
  }
  function onHandleUp(): void {
    if (drag === null) return;
    drag = null;
    if (height.value !== null && height.value < CLOSE_BELOW_PX) done();
  }

  return {
    isOpen, rows: session.rows, sheetEl, sheetStyle, setValue, openSheet, done, cancel, reset,
    onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp,
  };
}
