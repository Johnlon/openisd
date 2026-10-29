<script setup lang="ts">
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import {useOriginalProjectList, type OriginalProjectListProps, type OriginalProjectListEmit} from '../../../hooks/OriginalProjectList-hooks.js';
const props = defineProps<OriginalProjectListProps>();
const emit = defineEmits<OriginalProjectListEmit>();
const {emptyBinLabel, PROJECT_LIST_TEXT, editingRow, editingName, startRename, setRenameInput, commitRename, cancelRename, searchInputRef, listRef, focusSearchOrList, menuOpen, openRowMenu, openRowContextMenu, onSortChange, onQueryInput, onToggleShow, onRowClick, handleMenuAction, colourInput, onColourClick, openColourPicker, onColourInput, desktopMenuItems} = useOriginalProjectList(props, emit);
defineExpose({focusSearchOrList});
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
          <button
            type="button"
            class="project-swatch"
            :disabled="row.open.kind === 'closed'"
            :aria-label="'Change trace colour for ' + row.name"
            title="Click for an unused colour; double-click to choose a colour"
            @click.stop="onColourClick(row, $event)"
            @dblclick.stop.prevent="openColourPicker(row, true, $event)"
            :class="{
              'swatch-closed': row.open.kind === 'closed',
              'swatch-open': row.open.kind === 'open' && row.open.shown,
              'swatch-hidden': row.open.kind === 'open' && !row.open.shown,
            }"
            :style="row.open.kind === 'open' && row.open.colour ? { '--swatch-color': row.open.colour } : {}"
          ></button>

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

          <div class="project-content">
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
              :title="row.name"
              @dblclick.stop="startRename(row)"
            >{{ row.name }}</span>
            <span
              v-for="t in row.tags"
              :key="t.kind"
              class="project-tag"
              :class="`project-tag-${t.kind}`"
            >{{ t.text }}</span>
            <span
              v-if="row.sync"
              class="project-sync-mark"
              :title="row.sync.text"
            >{{ row.sync.glyph }}</span>
          </div>

          <span v-if="row.boxDetails" class="project-box-type" :title="row.summary">{{ row.boxDetails.type }}</span>
          <span v-if="row.boxDetails" class="project-volumes">{{ row.boxDetails.volumes }}</span>
          <div class="project-metadata">
            <span class="col-edited">{{ row.edited }}</span>
            <span class="col-size">{{ row.size }}</span>
          </div>
          </div>

          <div class="project-row-actions">
            <button
              type="button"
              class="row-menu-btn"
              :title="PROJECT_LIST_TEXT.MORE_OPTIONS"
              @click.stop="openRowMenu(row, $event)"
            >⋯</button>
            <button
              v-if="row.open.kind === 'open' && row.open.unsaved"
              type="button"
              class="row-save-btn"
              title="Save this project"
              :aria-label="'Save ' + row.name"
              @click.stop="emit('saveProject', row)"
            ><ToolbarIcon :name="row.open.active ? 'saveInverted' : 'save'" /></button>
          </div>
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

    <input ref="colourInput" class="project-colour-input" type="color" tabindex="-1" aria-label="Project trace colour" @click.stop @input="onColourInput">
    <!-- Context / row menu -->
    <div
      v-if="menuOpen !== null"
      class="row-menu-popup"
      :style="{ top: `${menuOpen.y}px`, left: `${menuOpen.x}px` }"
      @click.stop
    >
      <button
        v-for="item in desktopMenuItems(menuOpen.row)"
        :key="item.action"
        type="button"
        class="row-menu-item"
        :class="`menu-action-${item.action}`"
        @click="handleMenuAction(menuOpen.row, item.action, $event)"
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
  display: grid;
  grid-template-columns: 6px 16px minmax(0, 1fr) 24px;
  grid-template-rows: 1fr;
  align-items: start;
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
}

.project-row.is-unsaved:hover {
  background: #ffe680;
}

.project-row.is-unsaved.selected {
  background: #1868d1;
  color: #fff;
}

.project-swatch {
  width: 5px;
  min-height: 24px;
  height: calc(100% - 10px);
  grid-column: 1;
  grid-row: 1;
  justify-self: center;
  align-self: stretch;
  margin: 5px 0;
  padding: 0;
  cursor: pointer;
  border-radius: 2px;
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
  grid-column: 2;
  grid-row: 1;
  align-self: start;
  justify-self: center;
  accent-color: #1868d1;
  flex: none;
  margin: 0;
  cursor: pointer;
}

.project-show-spacer {
  grid-column: 2;
  grid-row: 1;
  width: 13px;
  flex: none;
}

.project-identity {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 2px 4px;
  overflow: hidden;
}

.project-name {
  flex: 1 1 auto;
  min-width: 0;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: normal;
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

.project-row-actions {
  grid-column: 4;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.row-save-btn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 1px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  cursor: pointer;
}

.row-save-btn:hover:not(:disabled) {background: rgba(0, 0, 0, 0.08);}
.project-row.selected .row-save-btn:hover:not(:disabled) {background:transparent;}
.row-save-btn:disabled {opacity: 0.35; cursor: default;}

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

<style scoped>
.project-content {grid-column:3;grid-row:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.project-box-type,.project-volumes {display:block;font-size:11px;line-height:1.3;overflow-wrap:normal;}
.project-box-type {white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.project-metadata {display:flex;gap:6px;min-width:0;}
.project-colour-input {position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;padding:0;border:0;}
.project-swatch:focus-visible {outline:2px solid currentColor;outline-offset:2px;}
.project-swatch:disabled {cursor:default;}
</style>
