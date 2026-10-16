<script setup lang="ts">
// The Options "Your data" Storage and Backups groups: what each kind of data takes, and everything
// kept in this browser, one row each. Display only — rows, wording and every action come from
// `StorageHistory-hooks.ts`.
import {useStorageHistory} from '../../hooks/StorageHistory-hooks.js';

const {
  usedLine, siteLine, fullWarning, persistWarning, usageRows, binHasProjects, emptyBin, deleteAllBackups,
  rows, totalSize, keepRule, picker, backUpNow, exportRow, restoreRow, openPicker, closePicker, restoreProject, deleteRow,
} = useStorageHistory();

async function onRestore(key: string) {
  const outcome = await restoreRow(key);
  if (outcome.kind === 'cancelled') return;
  if (outcome.kind === 'failed') { alert(`Could not restore: ${outcome.reason}`); return; }
  alert(`Restored (${outcome.keysRestored} item${outcome.keysRestored === 1 ? '' : 's'}). The app will now reload.`);
  window.location.reload();
}
</script>

<template>
  <fieldset class="opt-group su-page">
    <legend>Storage</legend>
    <p v-if="persistWarning" class="su-warning su-persist-warning" role="alert">{{ persistWarning }}</p>
    <p v-if="fullWarning" class="su-warning su-full-warning" role="alert">{{ fullWarning }}</p>
    <p class="opt-help su-used">{{ usedLine }}</p>
    <p v-if="siteLine" class="opt-help su-site">{{ siteLine }}</p>
    <dl class="su-rows">
      <div v-for="u in usageRows" :key="u.label" class="su-row"><dt>{{ u.label }}</dt><dd>{{ u.size }}</dd></div>
    </dl>
    <div class="opt-group-actions">
      <button class="opt-reset-btn su-empty-bin" :disabled="!binHasProjects" @click="emptyBin">Empty Bin</button>
      <button class="opt-reset-btn su-delete-all" :disabled="rows.length === 0" @click="deleteAllBackups">Delete all backups</button>
    </div>
  </fieldset>
  <fieldset class="opt-group sh-page">
    <legend>Backups</legend>
    <p class="opt-help">{{ keepRule }}</p>
    <div class="opt-group-actions sh-head">
      <button class="opt-reset-btn sh-backup-now" title="Make a backup of everything in this browser now." @click="backUpNow">
        Back up now
      </button>
      <span class="sh-total">Total {{ totalSize }}</span>
    </div>
    <p v-if="rows.length === 0" class="opt-help sh-empty">No backups yet.</p>
    <ul v-else class="sh-rows">
      <template v-for="row in rows" :key="row.kind === 'copy' ? row.copy : row.key">
        <li v-if="row.kind === 'backup'" class="sh-row">
          <div class="sh-line">
            <span class="sh-taken">{{ row.takenAt }}</span>
            <span class="sh-reason">{{ row.reason }}</span>
            <span class="sh-projects">{{ row.projects }}</span>
            <span class="sh-size">{{ row.size }}</span>
          </div>
          <p v-if="row.note" class="opt-help sh-note">{{ row.note }}</p>
          <div class="sh-actions">
            <button class="opt-reset-btn sh-restore" :disabled="!row.restorable" @click="onRestore(row.key)">Restore everything</button>
            <button class="opt-reset-btn sh-restore-one" :disabled="!row.restorable" @click="openPicker(row.key)">Restore one project</button>
            <button class="opt-reset-btn sh-export" @click="exportRow(row)">Export</button>
            <button class="opt-reset-btn sh-delete" @click="deleteRow(row)">Delete</button>
          </div>
          <div v-if="picker !== null && picker.key === row.key" class="sh-picker">
            <p v-if="picker.projects.length === 0" class="opt-help">This backup holds no saved project.</p>
            <div v-for="p in picker.projects" :key="p.id" class="sh-picker-row">
              <span class="sh-picker-name">{{ p.name }}</span>
              <button class="opt-reset-btn sh-picker-restore" :disabled="!p.readable" @click="restoreProject(p)">Restore</button>
            </div>
            <button class="opt-reset-btn sh-picker-close" @click="closePicker">Close</button>
          </div>
        </li>
        <li v-else class="sh-row sh-copy-row">
          <div class="sh-line">
            <span class="sh-taken">{{ row.takenAt }}</span>
            <span class="sh-reason">{{ row.reason }}</span>
            <span class="sh-holds">{{ row.holds }}</span>
            <span class="sh-size">{{ row.size }}</span>
          </div>
          <div class="sh-actions">
            <button class="opt-reset-btn sh-export" @click="exportRow(row)">Export</button>
            <button class="opt-reset-btn sh-delete" @click="deleteRow(row)">Delete</button>
          </div>
        </li>
      </template>
    </ul>
  </fieldset>
</template>

<style scoped>
.su-rows { display: flex; flex-wrap: wrap; gap: 2px 18px; margin: 4px 0 0; }
.su-row { display: flex; gap: 6px; }
.su-row dt { color: var(--mut); }
.su-row dd { margin: 0; }
.sh-head { align-items: center; }
.sh-total { color: var(--mut); }
.sh-rows { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.sh-row { border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; }
.sh-line { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.sh-reason { font-weight: 600; }
.sh-size, .sh-projects, .sh-holds { color: var(--mut); }
.sh-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.sh-picker { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
.sh-picker-row { display: flex; align-items: center; gap: 8px; }
.sh-picker-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.sh-picker-close { align-self: flex-start; }
.su-warning { margin: 0 0 8px; padding: 6px 8px; border-radius: 4px; background: #fdecc8; color: #5a3a00; font-size: 12px; line-height: 1.4; }
</style>
