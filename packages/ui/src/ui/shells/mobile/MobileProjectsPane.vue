<script setup lang="ts">
import {shallowRef} from 'vue';
import type {ProjectListRow} from '../../../hooks/projectBinView.js';
import type {BinRow} from '../../../hooks/binRows.js';
import {PROJECT_LIST_TEXT, type ProjectRowAction, type ProjectRowOrder} from '@openisd/design/fields';
import MobilePaneDialog from './MobilePaneDialog.vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import {inputChecked} from '../../../logic/domEvents.js';

const props = defineProps<{
  projectRows: readonly ProjectListRow[];
  shownProjects: readonly ProjectListRow[];
  projectsFooter: string;
  searchOffered: boolean;
  projectOrders: readonly ProjectRowOrder[];
  binRows: readonly BinRow[];
  binTotal: string;
  binLabel: string;
  storeLabel: string;
  chooseProject: (row: ProjectListRow) => void;
  setProjectTraceVisible: (row: ProjectListRow, visible: boolean) => void;
  cycleProjectColour: (row: ProjectListRow) => void;
  closeProjectRow: (row: ProjectListRow) => Promise<void>;
  duplicateProjectRow: (row: ProjectListRow) => void;
  exportProjectRow: (row: ProjectListRow) => Promise<void>;
  renameProjectRow: (row: ProjectListRow) => void;
  resolveProjectRow: (row: ProjectListRow) => void;
  moveToBin: (row: ProjectListRow) => Promise<void>;
  restoreFromBin: (row: BinRow) => void;
  deleteForever: (row: BinRow) => Promise<void>;
  emptyBin: () => Promise<void>;
  exportProjectsArchive: () => void;
  openNewProject: () => void;
  openFromDisk: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const projectQuery = defineModel<string>('query', {required: true});
const projectOrder = defineModel<ProjectRowOrder>('order', {required: true});
const binOpen = defineModel<boolean>('binOpen', {required: true});

const activeActionRow = shallowRef<ProjectListRow | null>(null);

function executeRowAction(action: ProjectRowAction): void {
  const row = activeActionRow.value;
  activeActionRow.value = null;
  if (row === null) return;
  switch (action) {
    case 'open':
    case 'makeActive':
      props.chooseProject(row);
      break;
    case 'close':
      void props.closeProjectRow(row);
      break;
    case 'show':
      props.setProjectTraceVisible(row, true);
      break;
    case 'hide':
      props.setProjectTraceVisible(row, false);
      break;
    case 'colour':
      props.cycleProjectColour(row);
      break;
    case 'duplicate':
      props.duplicateProjectRow(row);
      break;
    case 'export':
      void props.exportProjectRow(row);
      break;
    case 'delete':
      void props.moveToBin(row);
      break;
    case 'rename':
      props.renameProjectRow(row);
      break;
    case 'resolve':
      props.resolveProjectRow(row);
      break;
    default: {
      const unhandled: never = action;
      throw new Error(`unhandled row action ${String(unhandled)}`);
    }
  }
}
</script>

<template>
  <MobilePaneDialog class="mob-projects-pane" title="Projects" @close="emit('close')">
    <template v-if="!binOpen">
      <div class="mob-project-tools">
        <input
          v-if="searchOffered"
          class="mob-project-search"
          type="search"
          v-model="projectQuery"
          placeholder="Search projects"
          aria-label="Search projects"
        >
        <div class="mob-project-sort" role="group" aria-label="Sort projects">
          <button
            v-for="o in projectOrders"
            :key="o.label"
            type="button"
            :class="{on: projectOrder === o}"
            :title="o.label"
            @click="projectOrder = o"
          >
            {{ o.short }}
          </button>
        </div>
      </div>

      <p v-if="projectRows.length === 0" class="mob-hint">{{ PROJECT_LIST_TEXT.EMPTY }}</p>
      <p v-else-if="shownProjects.length === 0" class="mob-hint">{{ PROJECT_LIST_TEXT.NO_MATCH }}</p>

      <div class="mob-projects-list">
        <div
          v-for="p in shownProjects"
          :key="p.key"
          class="mob-project-row"
          :class="{open: p.open.kind === 'open', active: p.open.kind === 'open' && p.open.active}"
        >
          <div class="mob-project-leading">
            <button
              v-if="p.open.kind === 'open'"
              type="button"
              class="mob-project-swatch-btn"
              :aria-label="`Change colour for ${p.name}`"
              @click.stop="cycleProjectColour(p)"
            >
              <span
                class="mob-project-swatch"
                :class="{hidden: !p.open.shown}"
                :style="p.open.shown ? {background: p.open.colour ?? '#3366cc'} : {borderColor: p.open.colour ?? '#3366cc'}"
              ></span>
            </button>
            <span v-else class="mob-project-swatch-placeholder">
              <span class="mob-project-swatch closed" aria-hidden="true"></span>
            </span>

            <label v-if="p.open.kind === 'open'" class="mob-project-show-wrap">
              <input
                type="checkbox"
                class="mob-project-show"
                :checked="p.open.shown"
                :aria-label="`Show ${p.name} on the graphs`"
                @change="setProjectTraceVisible(p, inputChecked($event))"
              >
            </label>
          </div>

          <button type="button" class="mob-project-info" @click="chooseProject(p)">
            <div class="mob-project-name-line">
              <span v-if="p.open.kind === 'open'" class="project-tag project-tag-open mob-project-open-mark">{{ PROJECT_LIST_TEXT.OPEN_MARK }}</span>
              <span class="mob-project-name">{{ p.name }}</span>
              <span v-if="p.open.kind === 'open' && p.open.unsaved" class="project-tag project-tag-unsaved mob-project-dirty">{{ PROJECT_LIST_TEXT.UNSAVED_MARK }}</span>
              <span v-for="t in p.tags" :key="t.kind" class="project-tag" :class="`project-tag-${t.kind}`">{{ t.text }}</span>
            </div>
            <div class="mob-project-summary">{{ p.phoneSummary }}</div>
            <div class="mob-project-meta">
              <span>{{ p.edited }}</span>
              <template v-if="p.size"> · <span>{{ p.size }}</span></template>
              <span v-if="p.sync" class="project-sync-mark" :title="p.sync.text"> · {{ p.sync.glyph }}</span>
            </div>
          </button>

          <button
            type="button"
            class="mob-project-menu-btn"
            :aria-label="`Actions for ${p.name}`"
            title="Actions"
            @click.stop="activeActionRow = p"
          >
            ⋯
          </button>
        </div>
      </div>

      <p v-if="projectRows.length > 0" class="mob-hint mob-projects-footer">{{ projectsFooter }}</p>

      <div class="mob-projects-buttons">
        <button type="button" class="mob-cta" @click="openNewProject(); emit('close')">
          <ToolbarIcon name="new" /> <span>New project</span>
        </button>
        <button type="button" class="mob-cta mob-cta-secondary" @click="openFromDisk(); emit('close')">
          <ToolbarIcon name="import" /> <span>Import</span>
        </button>
      </div>
    </template>

    <template v-else>
      <p v-if="binRows.length === 0" class="mob-hint">{{ PROJECT_LIST_TEXT.BIN_EMPTY }}</p>
      <div v-for="b in binRows" :key="b.id" class="mob-bin-row">
        <span class="mob-stored-project-name">{{ b.name }}</span>
        <span class="mob-stored-project-summary">{{ b.binnedAt }} · {{ b.device }} · {{ b.size }}</span>
        <div class="mob-bin-actions">
          <button type="button" class="mob-bin-restore" @click="restoreFromBin(b)">Restore</button>
          <button type="button" class="mob-bin-delete-forever" @click="deleteForever(b)">Delete forever</button>
        </div>
      </div>
      <button v-if="binRows.length > 0" type="button" class="mob-cta mob-cta-secondary mob-bin-empty" @click="emptyBin">
        Empty Bin ({{ binTotal }})
      </button>
    </template>

    <div class="mob-project-actions">
      <button type="button" class="mob-project-action mob-export-projects" @click="exportProjectsArchive">
        Export all projects
      </button>
      <button type="button" class="mob-project-action mob-bin-toggle" @click="binOpen = !binOpen">
        <template v-if="binOpen">Back to projects</template>
        <template v-else><ToolbarIcon name="bin" /> {{ binLabel }}</template>
      </button>
    </div>
    <p class="store-label mob-store-label">{{ storeLabel }}</p>

    <!-- Bottom action sheet for row menu ⋯ -->
    <div v-if="activeActionRow !== null" class="mob-action-sheet-overlay" @click="activeActionRow = null">
      <div class="mob-action-sheet" @click.stop>
        <div class="mob-action-sheet-header">
          <div class="mob-action-sheet-title">{{ activeActionRow.name }}</div>
        </div>
        <div class="mob-action-sheet-items">
          <button
            v-for="m in activeActionRow.menu"
            :key="m.action"
            type="button"
            class="mob-action-sheet-item"
            :class="`mob-action-${m.action}`"
            @click="executeRowAction(m.action)"
          >
            {{ m.label }}
          </button>
        </div>
        <button type="button" class="mob-action-sheet-cancel" @click="activeActionRow = null">Cancel</button>
      </div>
    </div>
  </MobilePaneDialog>
</template>

<style scoped>
.mob-projects-pane {
  user-select: none;
}
.mob-project-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
}
.mob-project-search {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  font: inherit;
  font-size: 15px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--fg);
}
.mob-project-sort {
  display: flex;
  flex-wrap: nowrap;
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}
.mob-project-sort button {
  all: unset;
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--mut);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  white-space: nowrap;
}
.mob-project-sort button:last-child {
  border-right: none;
}
.mob-project-sort button.on {
  background: var(--panel2);
  color: var(--fg);
  font-weight: 600;
}
.mob-projects-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
}
.mob-project-row {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 6px 4px 6px 8px;
  border-bottom: 1px solid var(--line);
  box-sizing: border-box;
  background: var(--panel);
}
.mob-project-row.active {
  background: var(--panel2);
}
.mob-project-leading {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.mob-project-swatch-btn {
  all: unset;
  box-sizing: border-box;
  min-width: 32px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.mob-project-swatch-placeholder {
  min-width: 32px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mob-project-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-sizing: border-box;
  display: inline-block;
}
.mob-project-swatch.hidden {
  background: transparent !important;
  border: 2px solid;
}
.mob-project-swatch.closed {
  background: transparent;
  border: 2px solid var(--line);
}
.mob-project-show-wrap {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.mob-project-show {
  width: 20px;
  height: 20px;
  margin: 0;
  cursor: pointer;
}
.mob-project-info {
  all: unset;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 6px;
  cursor: pointer;
}
.mob-project-name-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}
.mob-project-name {
  font-size: 15px;
  color: var(--fg);
  word-break: break-word;
}
.mob-project-row.active .mob-project-name {
  font-weight: 700;
}
.mob-project-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--acc2);
  margin-right: 4px;
}
.mob-project-summary {
  font-size: 13px;
  color: var(--mut);
  line-height: 1.3;
  word-break: break-word;
}
.mob-project-meta {
  font-size: 12px;
  color: var(--mut);
  line-height: 1.3;
}
.mob-project-menu-btn {
  all: unset;
  box-sizing: border-box;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--mut);
  cursor: pointer;
  flex-shrink: 0;
}
.mob-hint {
  margin: 12px 16px;
  font-size: 13px;
  color: var(--mut);
  line-height: 1.4;
}
.mob-projects-footer {
  margin-top: 10px;
  font-weight: 500;
}
.mob-projects-buttons {
  display: flex;
  gap: 10px;
  padding: 8px 16px;
  flex-wrap: wrap;
}
.mob-cta {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1 1 120px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--acc);
  border-radius: 4px;
  background: var(--acc);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.mob-cta-secondary {
  background: var(--panel2);
  border-color: var(--line);
  color: var(--fg);
}
.mob-project-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 12px 8px 0;
  border-top: 1px solid var(--line);
  padding-top: 4px;
}
.mob-project-action {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 8px;
  font-size: 14px;
  color: var(--acc);
  cursor: pointer;
}
.mob-store-label {
  margin: 8px 16px 16px;
  font-size: 11px;
  color: var(--mut);
}
.project-tag {
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  background: var(--panel2);
  color: var(--mut);
  font-weight: normal;
}
.project-tag.project-tag-open { background: var(--acc); color: #fff; }
.project-tag.project-tag-unsaved { background: var(--acc2); color: #fff; }
.project-tag-conflict { color: var(--acc2); }
.project-tag-unreadable { color: var(--bad); }
.project-sync-mark { white-space: nowrap; }

.mob-bin-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
}
.mob-bin-row:first-of-type { border-top: none; }
.mob-bin-actions { display: flex; gap: 16px; margin-top: 4px; }
.mob-bin-restore, .mob-bin-delete-forever {
  all: unset;
  box-sizing: border-box;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  cursor: pointer;
  color: var(--acc);
}
.mob-bin-delete-forever { color: var(--bad); }
.mob-bin-empty {
  margin: 12px 16px;
  width: auto;
}

/* Bottom action sheet */
.mob-action-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.mob-action-sheet {
  background: var(--panel);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  padding: 8px 12px 20px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.25);
  box-sizing: border-box;
}
.mob-action-sheet-header {
  padding: 6px 12px 10px;
  border-bottom: 1px solid var(--line);
}
.mob-action-sheet-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--fg);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mob-action-sheet-items {
  display: flex;
  flex-direction: column;
}
.mob-action-sheet-item {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 16px;
  color: var(--fg);
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}
.mob-action-sheet-item.mob-action-delete {
  color: var(--bad);
}
.mob-action-sheet-cancel {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--mut);
  border-radius: 6px;
  background: var(--panel2);
  cursor: pointer;
}
</style>
