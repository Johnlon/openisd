<script setup lang="ts">
import { nextTick, ref, shallowRef, onMounted, onUnmounted } from 'vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import {
  emptyBinLabel,
  PROJECT_LIST_TEXT,
  type ProjectRowAction,
  type ProjectRowOrder,
} from '@openisd/design/fields';
import type { ProjectListRow } from '../../../hooks/projectBinView.js';
import type { BinRow } from '../../../hooks/binRows.js';
import type { OpenISDProject } from '@openisd/design';
import { inputValue, inputChecked, selectValue } from '../../../logic/domEvents.js';

const props = defineProps<{
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
}>();

const emit = defineEmits<{
  (e: 'update:projectQuery', val: string): void;
  (e: 'update:projectOrder', val: ProjectRowOrder): void;
  (e: 'update:binOpen', val: boolean): void;
  (e: 'choose', row: ProjectListRow): void;
  (e: 'close', project: OpenISDProject): void;
  (e: 'setTraceVisible', project: OpenISDProject, visible: boolean): void;
  (e: 'cycleColor', project: OpenISDProject): void;
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
}>();

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

defineExpose({
  focusSearchOrList,
});

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

function handleMenuAction(row: ProjectListRow, action: ProjectRowAction): void {
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
      if (project) emit('cycleColor', project);
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
    default: {
      const unhandled: never = action;
      throw new Error(`unhandled row action ${String(unhandled)}`);
    }
  }
}
</script>

<template>
  <div class="quad-projects-wrap original-project-list">
    <div class="projects-header">
      <div class="header-top-row">
        <span class="panel-title">{{ PROJECT_LIST_TEXT.TITLE }}</span>
        <div class="header-actions">
          <button type="button" class="link-btn" :title="PROJECT_LIST_TEXT.NEW_PROJECT" @click="emit('newProject')">{{ PROJECT_LIST_TEXT.NEW }}</button>
          <button type="button" class="link-btn" :title="PROJECT_LIST_TEXT.IMPORT" @click="emit('import')">{{ PROJECT_LIST_TEXT.IMPORT }}</button>
        </div>
      </div>
      <div class="header-controls">
        <select
          class="project-sort-select"
          :value="projectOrder.label"
          :aria-label="PROJECT_LIST_TEXT.SORT_ARIA"
          @change="onSortChange"
        >
          <option v-for="o in projectOrders" :key="o.label" :value="o.label">{{ o.label }}</option>
        </select>
        <input
          v-if="searchOffered"
          ref="searchInputRef"
          type="search"
          class="project-search-input"
          :value="projectQuery"
          :placeholder="PROJECT_LIST_TEXT.SEARCH_PLACEHOLDER"
          :aria-label="PROJECT_LIST_TEXT.SEARCH_ARIA"
          @input="onQueryInput"
        >
      </div>
    </div>

    <!-- Active projects list -->
    <template v-if="!binOpen">
      <div ref="listRef" class="projects-list" tabindex="-1">
        <div v-if="projectRows.length === 0" class="projects-empty">
          <p class="empty-text">{{ PROJECT_LIST_TEXT.EMPTY }}</p>
          <div class="empty-actions">
            <button type="button" class="btn" @click="emit('newProject')">{{ PROJECT_LIST_TEXT.NEW_PROJECT }}</button>
            <button type="button" class="btn" @click="emit('import')">{{ PROJECT_LIST_TEXT.IMPORT }}</button>
          </div>
        </div>
        <div v-else-if="shownProjects.length === 0" class="projects-empty">
          <p class="empty-text">{{ PROJECT_LIST_TEXT.NO_MATCH }}</p>
        </div>
        <div
          v-else
          v-for="row in shownProjects"
          :key="row.key"
          class="project-row"
          :class="{
            selected: row.open.kind === 'open' && row.open.active,
            'is-unsaved': row.open.kind === 'open' && row.open.unsaved,
            'trace-hidden': row.open.kind === 'open' && !row.open.shown,
            'is-closed': row.open.kind === 'closed',
          }"
          :title="row.title"
          @click="onRowClick(row)"
          @contextmenu.prevent.stop="openRowContextMenu(row, $event)"
        >
          <span
            class="project-swatch"
            :class="{
              'swatch-closed': row.open.kind === 'closed',
              'swatch-open': row.open.kind === 'open' && row.open.shown,
              'swatch-hidden': row.open.kind === 'open' && !row.open.shown,
            }"
            :style="row.open.kind === 'open' && row.open.colour ? { '--swatch-color': row.open.colour } : {}"
          ></span>

          <input
            v-if="row.open.kind === 'open'"
            type="checkbox"
            class="project-show-cbx"
            :checked="row.open.shown"
            :title="PROJECT_LIST_TEXT.TRACE_CHECKBOX_TITLE"
            @click.stop
            @change.stop="onToggleShow(row, $event)"
          >
          <span v-else class="project-show-spacer" aria-hidden="true"></span>

          <div class="project-identity">
            <input
              v-if="editingRow?.key === row.key"
              :ref="setRenameInput"
              type="text"
              class="project-name-input"
              v-model="editingName"
              :aria-label="PROJECT_LIST_TEXT.RENAME_ARIA"
              @click.stop
              @dblclick.stop
              @keydown.enter.stop.prevent="commitRename"
              @keydown.escape.stop.prevent="cancelRename"
              @blur="commitRename"
            >
            <span
              v-else
              class="project-name"
              @dblclick.stop="startRename(row)"
            >{{ row.name }}</span>
            <span
              v-for="t in row.tags"
              :key="t.kind"
              class="project-tag"
              :class="`project-tag-${t.kind}`"
            >{{ t.text }}</span>
            <span
              v-if="row.open.kind === 'open' && row.open.unsaved"
              class="project-unsaved-dot"
              :title="PROJECT_LIST_TEXT.UNSAVED_CHANGES"
            >●</span>
            <span
              v-if="row.sync"
              class="project-sync-mark"
              :title="row.sync.text"
            >{{ row.sync.glyph }}</span>
          </div>

          <span class="col-summary" :title="row.summary">{{ row.summary }}</span>
          <span class="col-edited">{{ row.edited }}</span>
          <span class="col-size">{{ row.size }}</span>

          <button
            type="button"
            class="row-menu-btn"
            :title="PROJECT_LIST_TEXT.MORE_OPTIONS"
            @click.stop="openRowMenu(row, $event)"
          >⋯</button>
        </div>
      </div>

      <div class="projects-panel-footer">
        <span class="footer-totals">{{ projectsFooter }}</span>
        <div class="footer-buttons">
          <button type="button" class="link-btn export-all-btn" @click="emit('exportAll')">{{ PROJECT_LIST_TEXT.EXPORT_ALL }}</button>
          <button type="button" class="link-btn bin-toggle" @click="emit('update:binOpen', true)">
            <ToolbarIcon name="bin" />
            <span>{{ binLabel }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Bin view -->
    <template v-else>
      <div ref="listRef" class="projects-list bin-list" tabindex="-1">
        <p v-if="binRows.length === 0" class="empty-text hint">{{ PROJECT_LIST_TEXT.BIN_EMPTY }}</p>
        <div v-for="binned in binRows" :key="binned.id" class="bin-row">
          <div class="bin-row-text">
            <span class="bin-name">{{ binned.name }}</span>
            <small class="bin-detail">{{ binned.binnedAt }} · {{ binned.device }} · {{ binned.size }}</small>
          </div>
          <button type="button" class="btn btn-sm bin-restore" @click="emit('restoreFromBin', binned)">{{ PROJECT_LIST_TEXT.RESTORE }}</button>
          <button type="button" class="btn btn-sm bin-delete-forever" @click="emit('deleteForever', binned)">{{ PROJECT_LIST_TEXT.DELETE_FOREVER }}</button>
        </div>
        <button v-if="binRows.length > 0" type="button" class="btn btn-sm bin-empty" @click="emit('emptyBin')">{{ emptyBinLabel(binTotal) }}</button>
        <p class="store-label">{{ storeLabel }}</p>
      </div>

      <div class="projects-panel-footer bin-footer">
        <button type="button" class="link-btn bin-toggle" @click="emit('update:binOpen', false)">
          {{ PROJECT_LIST_TEXT.BACK_TO_PROJECTS }}
        </button>
      </div>
    </template>

    <!-- Context / row menu -->
    <div
      v-if="menuOpen !== null"
      class="row-menu-popup"
      :style="{ top: `${menuOpen.y}px`, left: `${menuOpen.x}px` }"
      @click.stop
    >
      <button
        v-for="item in menuOpen.row.menu"
        :key="item.action"
        type="button"
        class="row-menu-item"
        :class="`menu-action-${item.action}`"
        @click="handleMenuAction(menuOpen.row, item.action)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.original-project-list {
  container-type: inline-size;
  container-name: project-list;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.projects-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
  flex-shrink: 0;
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.panel-title {
  color: #7d9fc9;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.15;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.project-sort-select {
  padding: 2px 4px;
  font-size: 11px;
  border: 1px solid #bbb;
  border-radius: 2px;
  background: #f7f7f7;
  max-width: 100px;
}

.project-search-input {
  flex: 1 1 80px;
  min-width: 60px;
  box-sizing: border-box;
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid #bbb;
  border-radius: 2px;
  background: #fff;
}

.projects-list {
  flex: 1 1 auto;
  min-height: 60px;
  border: 1px solid #bbb;
  background: #fff;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.projects-empty {
  padding: 16px 8px;
  text-align: center;
  color: #888;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-text {
  margin: 0;
  font-style: italic;
}

.empty-actions {
  display: flex;
  gap: 8px;
}

.project-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  box-sizing: border-box;
  width: 100%;
}

.project-row:hover {
  background: #eef4ff;
}

.project-row.selected {
  background: #1868d1;
  color: #fff;
}

.project-row.is-unsaved {
  background: #fff3b3;
  border-left: 4px solid #f2994a;
  padding-left: 3px;
}

.project-row.is-unsaved:hover {
  background: #ffe680;
}

.project-row.is-unsaved.selected {
  background: #1868d1;
  border-left-color: #ffd07d;
  color: #fff;
}

.project-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  box-sizing: border-box;
}

.project-swatch.swatch-closed {
  border: 1.5px solid #888;
  background: transparent;
}

.project-swatch.swatch-open {
  border: 1.5px solid var(--swatch-color, #1868d1);
  background: var(--swatch-color, #1868d1);
}

.project-swatch.swatch-hidden {
  background: transparent;
  border: 1.5px solid var(--swatch-color, #1868d1);
}

.project-show-cbx {
  accent-color: #1868d1;
  flex: none;
  margin: 0;
  cursor: pointer;
}

.project-show-spacer {
  width: 13px;
  flex: none;
}

.project-identity {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 4px;
  overflow: hidden;
}

.project-name {
  /* The name comes first: it keeps about 10 characters and wraps to 2 lines; a tag that no longer
     fits beside it moves to the next line (T217 review: a narrow panel cut the name to "s…"). */
  flex: 1 1 10ch;
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: 12px;
}

.project-name-input {
  box-sizing: border-box;
  font-size: 12px;
  height: 20px;
  padding: 0 4px;
  margin: 0;
  border: 1px solid #1868d1;
  border-radius: 2px;
  background: #fff;
  color: #111;
  outline: none;
  min-width: 60px;
  max-width: 100%;
  flex: 1 1 auto;
}

.project-row.selected .project-name {
  font-weight: bold;
}

.project-row.is-unsaved .project-name {
  font-style: italic;
}

.project-tag {
  padding: 0 4px;
  border-radius: 2px;
  font-size: 10px;
  background: #e8edf2;
  color: #4a5560;
  font-weight: normal;
  white-space: nowrap;
  flex: none;
}

.project-tag-conflict {
  background: #fdecc8;
  color: #7a4d00;
}

.project-tag-unreadable {
  background: #f9d6d6;
  color: #8a1f1f;
}

.project-tag-hidden {
  background: #e8edf2;
  color: #666;
}

.project-unsaved-dot {
  color: #f2994a;
  font-size: 9px;
  flex: none;
  line-height: 1;
}

.project-row.selected .project-unsaved-dot {
  color: #ffd07d;
}

.project-sync-mark {
  white-space: nowrap;
  font-size: 11px;
  flex: none;
}

.col-summary,
.col-edited,
.col-size {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: none;
}

.col-summary {
  max-width: 130px;
}

.col-edited {
  max-width: 105px;
}

.col-size {
  max-width: 45px;
  text-align: right;
}

.project-row.selected .col-summary,
.project-row.selected .col-edited,
.project-row.selected .col-size {
  color: #dbeafe;
}

.row-menu-btn {
  border: 0;
  background: transparent;
  padding: 0 4px;
  color: #666;
  font-weight: bold;
  cursor: pointer;
  flex: none;
  font-size: 13px;
  line-height: 1;
}

.project-row.selected .row-menu-btn {
  color: #fff;
}

.row-menu-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
}

/* Container query column collapse */
@container project-list (max-width: 480px) {
  .col-size {
    display: none;
  }
}

@container project-list (max-width: 380px) {
  .col-edited {
    display: none;
  }
}

@container project-list (max-width: 270px) {
  .col-summary {
    display: none;
  }
}

.projects-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  flex-shrink: 0;
  font-size: 11px;
  color: #666;
  flex-wrap: wrap;
}

.footer-totals {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-btn {
  background: none;
  border: none;
  color: #1868d1;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  text-decoration: underline;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.link-btn:hover {
  color: #0b4594;
}

.bin-list {
  padding: 4px;
  gap: 4px;
}

.bin-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-bottom: 1px solid #eee;
}

.bin-row-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bin-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bin-detail {
  font-size: 10px;
  color: #666;
}

.bin-empty {
  align-self: flex-start;
  margin-top: 6px;
}

.store-label {
  margin: 6px 0 0;
  font-size: 11px;
  color: #666;
}

.btn {
  border: 1px solid #999;
  background: #f0f0f0;
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
}

.btn:hover {
  background: #dbeaff;
  border-color: #7fb3ff;
}

.btn-sm {
  padding: 2px 6px;
  font-size: 11px;
}

.row-menu-popup {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid #888;
  box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  min-width: 130px;
  padding: 2px 0;
  border-radius: 2px;
}

.row-menu-item {
  border: 0;
  background: transparent;
  padding: 5px 12px;
  text-align: left;
  font-size: 12px;
  cursor: pointer;
  color: #222;
  white-space: nowrap;
}

.row-menu-item:hover {
  background: #1868d1;
  color: #fff;
}
</style>
