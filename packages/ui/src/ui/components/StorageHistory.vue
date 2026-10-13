<script setup lang="ts">
// The Options "Storage history" page: one row per backup held in this browser. Display only —
// rows, wording and every action come from `StorageHistory-hooks.ts`.
import {useStorageHistory} from '../../hooks/StorageHistory-hooks.js';

const { rows, backUpNow, exportRow, restoreRow, deleteRow } = useStorageHistory();

async function onRestore(key: string) {
  const outcome = await restoreRow(key);
  if (outcome.kind === 'cancelled') return;
  if (outcome.kind === 'failed') { alert(`Could not restore: ${outcome.reason}`); return; }
  alert(`Backup restored (${outcome.keysRestored} item${outcome.keysRestored === 1 ? '' : 's'}). The app will now reload.`);
  window.location.reload();
}
</script>

<template>
  <fieldset class="opt-group sh-page">
    <legend>Storage history</legend>
    <p class="opt-help">
      A backup of everything in this browser is made before anything is restored, migrated, repaired or deleted.
      The newest ten are kept.
    </p>
    <div class="opt-group-actions">
      <button class="opt-reset-btn sh-backup-now" title="Make a backup of everything in this browser now." @click="backUpNow">
        Back up now
      </button>
    </div>
    <p v-if="rows.length === 0" class="opt-help sh-empty">No backups yet.</p>
    <ul v-else class="sh-rows">
      <li v-for="row in rows" :key="row.key" class="sh-row">
        <dl class="sh-facts">
          <div><dt>Built</dt><dd class="sh-build">{{ row.build }}</dd></div>
          <div><dt>Layout</dt><dd class="sh-layout">{{ row.layout }}</dd></div>
          <div><dt>Projects</dt><dd class="sh-projects">{{ row.projects }}</dd></div>
          <div><dt>Size</dt><dd class="sh-size">{{ row.size }}</dd></div>
          <div><dt>Taken</dt><dd class="sh-taken">{{ row.takenAt }}</dd></div>
        </dl>
        <p v-if="row.note" class="opt-help sh-note">{{ row.note }}</p>
        <div class="sh-actions">
          <button class="opt-reset-btn sh-export" @click="exportRow(row.key)">Export</button>
          <button class="opt-reset-btn sh-restore" :disabled="!row.restorable" @click="onRestore(row.key)">Restore</button>
          <button class="opt-reset-btn sh-delete" @click="deleteRow(row.key)">Delete</button>
        </div>
      </li>
    </ul>
  </fieldset>
</template>

<style scoped>
.sh-rows { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.sh-row { border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; }
.sh-facts { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; }
.sh-facts div { display: flex; gap: 6px; }
.sh-facts dt { color: var(--mut); }
.sh-facts dd { margin: 0; }
.sh-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
</style>
