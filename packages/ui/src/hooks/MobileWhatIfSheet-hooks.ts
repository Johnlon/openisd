/**
 * `MobileWhatIfSheet.vue`'s hook — the What-if? bottom sheet on the mobile Graph page. Closed, it
 * is a pull-tab; tapped or dragged up, the sheet opens, a What-if begins, and the charts above
 * stay live. The drag handle sets the sheet's height; dragging it down far enough closes it. The
 * rows and the What-if come from the skin-neutral `createWhatIfSession`, shared with desktop.
 *
 * The What-if never changes the project. Every way out (Close, dragging the sheet down) ends it,
 * and the charts show the project's own values again. Reset puts the project's values back and
 * keeps the sheet open.
 */
import {computed, ref} from 'vue';
import {useApp} from '../logic/app.js';
import {useFeatureUse} from './telemetryContext.js';
import type {ComputedRef, Ref} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {createWhatIfSession, type WhatIfRow} from './whatIfSession.js';
import type {WhatIfField} from '@openisd/design/fields';

/** The sheet's open state, owned by the chart view (its Auto Y box follows it). */
export interface MobileWhatIfSheetDeps {
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

/** The part of a pointer, mouse or click event the port-value press reads. */
export interface PressEvent {
  readonly type: string;
  preventDefault(): void;
}

export interface MobileWhatIfSheetAPI {
  readonly isOpen: ComputedRef<boolean>;
  readonly rows: ComputedRef<readonly WhatIfRow[]>;
  /** The port-area row whose port's fields are open over the sheet, or null. */
  readonly portEditor: Ref<WhatIfRow | null>;
  /** A press on a port-area value opens that port's fields; the box is never focused, so the keyboard stays down. */
  portValuePress(e: PressEvent, row: WhatIfRow): void;
  closePortEditor(): void;
  readonly sheetEl: Ref<HTMLElement | null>;
  /** The sheet's inline height: its default (CSS) until dragged. */
  readonly sheetStyle: ComputedRef<string>;
  setValue(field: WhatIfField, v: number | null): void;
  openSheet(): void;
  /** Close the sheet and end the What-if. */
  close(): void;
  reset(): void;
  onTabDown(e: PointerEvent): void;
  onTabUp(e: PointerEvent): void;
  onHandleDown(e: PointerEvent): void;
  onHandleMove(e: PointerEvent): void;
  onHandleUp(): void;
}

export function useMobileWhatIfSheet({ open, setOpen }: MobileWhatIfSheetDeps): MobileWhatIfSheetAPI {
  const {projectChanged} = useApp().appState;
  const project = useFocusedProject();
  const session = createWhatIfSession({ project, projectChanged });
  const featureUse = useFeatureUse();

  const isOpen = computed(() => open());
  const sheetEl = ref<HTMLElement | null>(null);
  const height = ref<number | null>(null);
  const sheetStyle = computed(() => height.value === null ? '' : `height: ${height.value}px`);

  /** An emptied field is left alone: every What-if slot holds a value. */
  function setValue(field: WhatIfField, v: number | null): void {
    if (v !== null) session.set(field, v);
  }

  function openSheet(): void {
    featureUse.feature('whatif');
    session.begin();
    setOpen(true);
  }
  const portEditor = ref<WhatIfRow | null>(null);
  function closePortEditor(): void { portEditor.value = null; }
  function portValuePress(e: PressEvent, row: WhatIfRow): void {
    if (row.vent === null) return;
    e.preventDefault();
    if (e.type !== 'click') return;
    session.begin();
    portEditor.value = row;
  }

  function close(): void {
    portEditor.value = null;
    session.close();
    height.value = null;
    setOpen(false);
  }
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
    if (height.value !== null && height.value < CLOSE_BELOW_PX) close();
  }

  return {
    isOpen, rows: session.rows, portEditor, portValuePress, closePortEditor, sheetEl, sheetStyle, setValue, openSheet, close, reset,
    onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp,
  };
}
