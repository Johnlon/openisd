
import { nextTick, ref, shallowRef, onMounted, onUnmounted } from 'vue';
import {
  emptyBinLabel,
  PROJECT_LIST_TEXT,
  type ProjectRowAction,
  type ProjectRowOrder,
} from '@openisd/design/fields';
import type { ProjectListRow } from './projectBinView.js';
import type { BinRow } from './binRows.js';
import type { OpenISDProject } from '@openisd/design';
import { inputValue, inputChecked, selectValue } from '../logic/domEvents.js';


export interface OriginalProjectListProps {
  projectRows: readonly ProjectListRow[];
  shownProjects: readonly ProjectListRow[];
  projectsFooter: string;
  searchOffered: boolean;
  projectQuery: string;
  projectOrder: ProjectRowOrder;
  projectOrders: readonly ProjectRowOrder[];
  binRows: readonly BinRow[];
  binTotal: string;
  binOpen: boolean;
  binLabel: string;
  storeLabel: string;
}

export interface OriginalProjectListEmit {
  (e: 'update:projectQuery', val: string): void;
  (e: 'update:projectOrder', val: ProjectRowOrder): void;
  (e: 'update:binOpen', val: boolean): void;
  (e: 'choose', row: ProjectListRow): void;
  (e: 'close', project: OpenISDProject): void;
  (e: 'setTraceVisible', project: OpenISDProject, visible: boolean): void;
  (e: 'cycleColor', project: OpenISDProject): void;
  (e: 'setColor', project: OpenISDProject, colour: string): void;
  (e: 'copyCharts', row: ProjectListRow): void;
  (e: 'saveProject', row: ProjectListRow): void;
  (e: 'duplicate', row: ProjectListRow): void;
  (e: 'export', row: ProjectListRow): void;
  (e: 'rename', row: ProjectListRow, name: string): void;
  (e: 'resolve', row: ProjectListRow): void;
  (e: 'moveToBin', row: ProjectListRow): void;
  (e: 'restoreFromBin', binned: BinRow): void;
  (e: 'deleteForever', binned: BinRow): void;
  (e: 'emptyBin'): void;
  (e: 'exportAll'): void;
  (e: 'newProject'): void;
  (e: 'import'): void;
}

export function useOriginalProjectList(props: OriginalProjectListProps, emit: OriginalProjectListEmit) {
const editingRow = shallowRef<ProjectListRow | null>(null);
const editingName = ref('');
let renameInputEl: HTMLInputElement | null = null;
let cancellingRename = false;

function setRenameInput(el: unknown): void {
  renameInputEl = el instanceof HTMLInputElement ? el : null;
}

async function startRename(row: ProjectListRow): Promise<void> {
  cancellingRename = false;
  editingRow.value = row;
  editingName.value = row.name;
  await nextTick();
  if (renameInputEl) {
    renameInputEl.focus();
    renameInputEl.select();
  }
}

function commitRename(): void {
  if (cancellingRename) {
    cancellingRename = false;
    return;
  }
  const row = editingRow.value;
  if (row === null) return;
  const name = editingName.value.trim();
  editingRow.value = null;
  if (name !== '' && name !== row.name) {
    emit('rename', row, name);
  }
}

function cancelRename(): void {
  cancellingRename = true;
  editingRow.value = null;
  editingName.value = '';
}

const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);

async function focusSearchOrList(): Promise<void> {
  await nextTick();
  if (props.searchOffered && searchInputRef.value) {
    searchInputRef.value.focus();
    searchInputRef.value.select?.();
  } else if (listRef.value) {
    listRef.value.focus();
  }
}


const menuOpen = shallowRef<{ row: ProjectListRow; x: number; y: number } | null>(null);

function closeMenu(): void {
  menuOpen.value = null;
}

function openRowMenu(row: ProjectListRow, ev: MouseEvent): void {
  if (ev.currentTarget instanceof HTMLElement) {
    const rect = ev.currentTarget.getBoundingClientRect();
    menuOpen.value = {
      row,
      x: Math.max(10, Math.min(rect.left, window.innerWidth - 180)),
      y: Math.min(rect.bottom, window.innerHeight - 200),
    };
  }
}

function openRowContextMenu(row: ProjectListRow, ev: MouseEvent): void {
  menuOpen.value = {
    row,
    x: Math.max(10, Math.min(ev.clientX, window.innerWidth - 180)),
    y: Math.min(ev.clientY, window.innerHeight - 200),
  };
}

function onWindowKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && menuOpen.value !== null) {
    closeMenu();
    ev.stopPropagation();
  }
}

onMounted(() => {
  window.addEventListener('click', closeMenu);
  window.addEventListener('keydown', onWindowKeydown);
});

onUnmounted(() => {
  for (const click of colourClicks.values()) clearTimeout(click.timer);
  colourClicks.clear();
  window.removeEventListener('click', closeMenu);
  window.removeEventListener('keydown', onWindowKeydown);
});

function onSortChange(e: Event): void {
  const val = selectValue(e);
  const found = props.projectOrders.find(o => o.label === val);
  if (found) {
    emit('update:projectOrder', found);
  }
}

function onQueryInput(e: Event): void {
  emit('update:projectQuery', inputValue(e));
}

function onToggleShow(row: ProjectListRow, e: Event): void {
  const project = row.handle.open;
  if (project) {
    emit('setTraceVisible', project, inputChecked(e));
  }
}

function onRowClick(row: ProjectListRow): void {
  emit('choose', row);
}

function handleMenuAction(row: ProjectListRow, action: ProjectRowAction | 'copyCharts', event?: MouseEvent): void {
  const menuAnchor = action === 'colour' && event?.currentTarget instanceof HTMLElement
    ? event.currentTarget.getBoundingClientRect()
    : undefined;
  closeMenu();
  const project = row.handle.open;
  switch (action) {
    case 'open':
    case 'makeActive':
      emit('choose', row);
      break;
    case 'close':
      if (project) emit('close', project);
      break;
    case 'show':
      if (project) emit('setTraceVisible', project, true);
      break;
    case 'hide':
      if (project) emit('setTraceVisible', project, false);
      break;
    case 'colour':
      openColourPicker(row, false, menuAnchor);
      break;
    case 'copyCharts':
      emit('copyCharts', row);
      break;
    case 'duplicate':
      emit('duplicate', row);
      break;
    case 'export':
      emit('export', row);
      break;
    case 'delete':
      emit('moveToBin', row);
      break;
    case 'rename':
      void startRename(row);
      break;
    case 'resolve':
      emit('resolve', row);
      break;
  }
}

const colourInput = ref<HTMLInputElement | null>(null);
const colourProject = shallowRef<OpenISDProject | null>(null);
// Keep click arbitration per project: clicks on another row must never cancel this row.
const colourClicks = new Map<OpenISDProject, {timer: ReturnType<typeof setTimeout>; apply: () => void}>();
const appliedClicks = new Map<OpenISDProject, {before: string; after: string}>();
const COLOUR_DOUBLE_CLICK_MS = 400;
function cancelColourClick(project: OpenISDProject): void {
  const pending = colourClicks.get(project);
  if (pending !== undefined) clearTimeout(pending.timer);
  colourClicks.delete(project);
}
function onColourClick(row: ProjectListRow, event: MouseEvent): void {
  const project = row.handle.open;
  if (project === null || event.detail > 1) return;
  // A fresh detail=1 click starts a separate native click sequence.
  const pending = colourClicks.get(project);
  if (pending !== undefined) {cancelColourClick(project); pending.apply();}
  appliedClicks.delete(project);
  if (event.detail === 0) {emit('cycleColor', project); return;}
  const apply = () => {
    colourClicks.delete(project);
    const before = project.traceColor.value ?? '#c9c92e';
    emit('cycleColor', project);
    appliedClicks.set(project, {before, after: project.traceColor.value ?? '#c9c92e'});
  };
  colourClicks.set(project, {timer: setTimeout(apply, COLOUR_DOUBLE_CLICK_MS), apply});
}
function openColourPicker(row: ProjectListRow, doubleClick = false, anchor?: MouseEvent | DOMRect): void {
  const project = row.handle.open, input = colourInput.value;
  if (project === null || input === null) return;
  cancelColourClick(project);
  // Native double-click timing is an OS preference and may exceed our single-click delay.
  const applied = appliedClicks.get(project);
  if (doubleClick && applied !== undefined && project.traceColor.value === applied.after) {
    emit('setColor', project, applied.before);
  }
  appliedClicks.delete(project);
  colourProject.value = project;
  input.value = project.traceColor.value ?? '#c9c92e';
  if (anchor instanceof MouseEvent) {
    input.style.left = `${anchor.clientX}px`;
    input.style.top = `${anchor.clientY}px`;
  } else if (anchor !== undefined) {
    input.style.left = `${anchor.left + (anchor.right - anchor.left) / 2}px`;
    input.style.top = `${anchor.top + (anchor.bottom - anchor.top) / 2}px`;
  }
  if (typeof input.showPicker === 'function') input.showPicker();
  else input.click();
}
function onColourInput(event: Event): void {
  if (colourProject.value !== null) emit('setColor', colourProject.value, inputValue(event));
}
function desktopMenuItems(row: ProjectListRow): readonly {action: ProjectRowAction | 'copyCharts'; label: string}[] {
  const source = props.projectRows.find(other => other.open.kind === 'open' && other.open.active);
  const readable = row.open.kind === 'open' || row.menu.some(item => item.action === 'open');
  if (source === undefined || source.key === row.key || !readable) return row.menu;
  return [...row.menu, {action: 'copyCharts', label: 'Copy charts from active project'}];
}

return {emptyBinLabel, PROJECT_LIST_TEXT, editingRow, editingName, startRename, setRenameInput, commitRename, cancelRename, searchInputRef, listRef, focusSearchOrList, menuOpen, closeMenu, openRowMenu, openRowContextMenu, onSortChange, onQueryInput, onToggleShow, onRowClick, handleMenuAction, colourInput, onColourClick, openColourPicker, onColourInput, desktopMenuItems};
}
