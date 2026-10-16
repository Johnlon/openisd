/**
 * `MobileSheet.vue`'s hook — the bottom sheet on the mobile Graph page (Tune or Learn mode).
 * Closed, it is a pull-tab; tapped or dragged up, the sheet opens, and the charts above stay live.
 * In Learn mode, a What-if begins, which never changes the project. In Tune mode, edits write
 * directly to the project.
 *
 * The drag handle sets the sheet's height; dragging it down far enough closes it. The rows and
 * the session come from the skin-neutral `createSheetSession`, shared with desktop.
 */
import {computed, ref} from 'vue';
import {useApp} from '../logic/app.js';
import {useFeatureUse} from './telemetryContext.js';
import type {ComputedRef, Ref} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {createSheetSession, type SheetRow} from './sheetSession.js';
import {portFieldsView, type PortFieldsView} from './portFieldsView.js';
import type {SheetField, SheetMode} from '@openisd/design/fields';

/** The sheet's open state, mode, owned by the chart view (its Auto Y box follows it). */
export interface MobileSheetDeps {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  mode: Ref<SheetMode>;
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

export interface MobileSheetAPI {
  readonly isOpen: ComputedRef<boolean>;
  readonly lines: ComputedRef<readonly (readonly SheetRow[])[]>;
  readonly rows: ComputedRef<readonly SheetRow[]>;
  readonly rowSlots: ComputedRef<number>;
  readonly mode: Ref<SheetMode>;
  setMode(next: SheetMode): void;
  /** The port-area row whose port's fields are open, or null. */
  readonly portEditor: Ref<SheetRow | null>;
  /** The open port's fields, current after every edit; null when none is open. */
  readonly portView: ComputedRef<PortFieldsView | null>;
  /** A press on a port-area value opens that port's fields; the box is never focused, so the keyboard stays down. */
  portValuePress(e: PressEvent, row: SheetRow): void;
  closePortEditor(): void;
  readonly sheetEl: Ref<HTMLElement | null>;
  /** The sheet's inline height: its default (CSS) until dragged. */
  readonly sheetStyle: ComputedRef<string>;
  setValue(field: SheetField, v: number | null): void;
  openSheet(): void;
  /** Close the sheet and end the What-if (in Learn mode). */
  close(): void;
  reset(): void;
  onTabDown(e: PointerEvent): void;
  onTabUp(e: PointerEvent): void;
  onHandleDown(e: PointerEvent): void;
  onHandleMove(e: PointerEvent): void;
  onHandleUp(): void;
}

export function useMobileSheet({ open, setOpen, mode }: MobileSheetDeps): MobileSheetAPI {
  const {projectChanged} = useApp().appState;
  const project = useFocusedProject();
  const session = createSheetSession({ project, projectChanged, mode });
  const featureUse = useFeatureUse();

  const isOpen = computed(() => open());
  const sheetEl = ref<HTMLElement | null>(null);
  const height = ref<number | null>(null);
  const sheetStyle = computed(() => height.value === null ? '' : `height: ${height.value}px`);

  /** An emptied field is left alone: every sheet slot holds a value. */
  function setValue(field: SheetField, v: number | null): void {
    if (v !== null) session.set(field, v);
  }

  function openSheet(): void {
    switch (mode.value.edits) {
      case 'project':
        featureUse.feature('tune');
        break;
      case 'whatIfLayer':
        featureUse.feature('whatif');
        break;
    }
    session.begin();
    setOpen(true);
  }

  const portEditor = ref<SheetRow | null>(null);
  const portView = computed(() => {
    const openRow = portEditor.value;
    if (openRow === null) return null;
    const vent = session.rows.value.find(r => r.field.label === openRow.field.label)?.vent ?? null;
    return vent === null ? null : portFieldsView(vent);
  });

  function closePortEditor(): void { portEditor.value = null; }

  function portValuePress(e: PressEvent, row: SheetRow): void {
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
    isOpen, lines: session.lines, rows: session.rows, rowSlots: session.rowSlots, mode, setMode: session.setMode,
    portEditor, portView, portValuePress, closePortEditor, sheetEl, sheetStyle, setValue, openSheet, close, reset,
    onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp,
  };
}
