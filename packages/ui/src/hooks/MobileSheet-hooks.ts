/**
 * `MobileSheet.vue`'s hook — one of the two bottom sheets on the mobile Graph page (Tune or
 * What-if; each has its own pull-tab and its own fields). Closed, it is a pull-tab; tapped or
 * dragged up, the sheet opens, and the charts above stay live. The What-if sheet begins a What-if,
 * which never changes the project. The Tune sheet writes directly to the project.
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
import {ChartPageHelp, PhoneRowSizes, SheetSizes, type PhoneHelpSection, type SheetField, type SheetMode} from '@openisd/design/fields';

/** The sheet's open state (owned by the chart view; its Auto Y box follows it) and its fixed mode. */
export interface MobileSheetDeps {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  mode: SheetMode;
}

/** The chart keeps at least this much height above the sheet. */
const MIN_CHART_PX = 120;
/** Dragging the sheet below this height closes it. */
const CLOSE_BELOW_PX = 90;
/** A press on the sheet's band moves less than this and it is a tap, not a drag. */
const DRAG_START_PX = 4;
/** An upward drag on the pull-tab longer than this sets the opened sheet's height. */
const TAB_DRAG_PX = 12;
/** The pull-tab's own height, added back when an upward drag sizes the sheet. */
const TAB_PX = SheetSizes.TAB_PX;

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
  readonly mode: SheetMode;
  /** The port-area row whose port's fields are open, or null. */
  readonly portEditor: Ref<SheetRow | null>;
  /** The open port's fields, current after every edit; null when none is open. */
  readonly portView: ComputedRef<PortFieldsView | null>;
  /** A press on a port-area value opens that port's fields; the box is never focused, so the keyboard stays down. */
  portValuePress(e: PressEvent, row: SheetRow): void;
  closePortEditor(): void;
  /** The sizes the sheet's controls and rows take, as CSS variables (from design). */
  readonly sizeStyle: string;
  /** What the ? on the sheet's band opens: the sheet, then one line per row it shows for this box. */
  readonly help: ComputedRef<PhoneHelpSection>;
  readonly sheetEl: Ref<HTMLElement | null>;
  /** The sheet's inline height: its default (CSS) until dragged. */
  readonly sheetStyle: ComputedRef<string>;
  setValue(field: SheetField, v: number | null): void;
  openSheet(): void;
  /** Close the sheet and end the What-if (the What-if sheet). */
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
  /** Dragged, the sheet takes the finger's height, past the usual cap. */
  const sheetStyle = computed(() => height.value === null ? '' : `height: ${height.value}px; max-height: none`);
  const help = computed(() => { void projectChanged.value; return ChartPageHelp.forSheet(mode, project.value.box.boxType.value); });

  /** An emptied field is left alone: every sheet slot holds a value. */
  function setValue(field: SheetField, v: number | null): void {
    if (v !== null) session.set(field, v);
  }

  function openSheet(): void {
    switch (mode.edits) {
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
    const room = el.offsetParent?.clientHeight ?? el.offsetHeight;
    drag = { y: e.clientY, height: el.offsetHeight, max: Math.max(room - MIN_CHART_PX, CLOSE_BELOW_PX) };
    if (e.target instanceof Element) e.target.setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: PointerEvent): void {
    if (drag === null) return;
    if (height.value === null && Math.abs(drag.y - e.clientY) < DRAG_START_PX) return;
    height.value = Math.min(drag.max, Math.max(0, drag.height + drag.y - e.clientY));
  }
  function onHandleUp(): void {
    if (drag === null) return;
    drag = null;
    if (height.value !== null && height.value < CLOSE_BELOW_PX) close();
  }

  return {
    isOpen, lines: session.lines, rows: session.rows, rowSlots: session.rowSlots, mode,
    sizeStyle: [...PhoneRowSizes.CLASSIC.cssVars()].map(([name, value]) => `${name}: ${value}`).join('; '), help,
    portEditor, portView, portValuePress, closePortEditor, sheetEl, sheetStyle, setValue, openSheet, close, reset,
    onTabDown, onTabUp, onHandleDown, onHandleMove, onHandleUp,
  };
}
