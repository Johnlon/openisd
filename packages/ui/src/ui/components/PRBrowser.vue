<script setup lang="ts">
import { ref, computed } from 'vue';
import { useEscToClose } from '../../logic/useEscToClose.js';
import { useApp } from '../../logic/app.js';
import { passiveRadiatorRows } from '../../logic/driverDisplay.js';

const { myPassiveRadiators, bundledPassiveRadiators } = useApp();

// PR browser — a popup mirroring the driver browser (DriverBrowserMd.vue): two
// sections, "Saved" (your localStorage PR library) and "Bundled" (passive radiators
// pulled from the driver collections), plus a "Define new PR" affordance.

// A row's `id` is all that crosses the boundary: the storage uuid for a saved radiator, the
// list position for a bundled one. The shell resolves it back to a radiator (A9 — a component
// carries no domain value).
const emit = defineEmits<{
  close: [];
  load: [string];
  loadBundled: [string];
  define: [];
}>();

const savedRows = ref(passiveRadiatorRows(
  myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator }))));
const bundledRows = passiveRadiatorRows(
  bundledPassiveRadiators.map((radiator, i) => ({ id: String(i), radiator })));
const filter = ref('');

const matching = <T extends { name: string }>(rows: readonly T[], q: string): readonly T[] =>
  q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;

const fSaved = computed(() => matching(savedRows.value, filter.value.trim().toLowerCase()));
const fBundled = computed(() => matching(bundledRows, filter.value.trim().toLowerCase()));

function remove(uuid: string) {
  myPassiveRadiators.remove(uuid);
  savedRows.value = passiveRadiatorRows(
    myPassiveRadiators.list().map(e => ({ id: e.uuid, radiator: e.passiveRadiator })));
}
function close() { emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) close(); }
useEscToClose(() => true, close);
</script>

<template>
  <div class="overlay on" @click="onBackdrop">
    <div class="modal">
      <h2>Passive radiator library<button class="x" @click="close" title="Close">✕</button></h2>
      <div class="body">
        <input class="pr-filter" type="text" v-model="filter" placeholder="Filter passive radiators…"
          style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:5px 8px" />

        <div class="pr-lib">
          <div class="pr-lib-hdr">Saved</div>
          <div v-if="!fSaved.length" style="color:var(--mut);font-size:11px;padding:4px 8px">
            {{ filter ? 'No saved PRs match.' : 'No saved PRs yet — define one below, or Save from the PR editor.' }}
          </div>
          <div v-for="e in fSaved" :key="e.id" class="pr-lib-item">
            <span class="pr-lib-name" @click="emit('load', e.id)"
              :title="`Load ${e.name} — Sd=${e.sd} Mms=${e.mms} Cms=${e.cms}`">{{ e.name }}</span>
            <button class="pr-lib-del" @click="remove(e.id)" title="Remove this PR from your library">✕</button>
          </div>

          <div class="pr-lib-hdr"
            title="Passive radiators bundled from the driver collections. Datasheets publish Sd/Cms/Vas only — Fs/Mms/Rms/Xmax are left blank for you to supply.">Bundled</div>
          <div v-if="!fBundled.length" style="color:var(--mut);font-size:11px;padding:4px 8px">
            {{ filter ? 'No bundled PRs match.' : 'No bundled passive radiators in the current collection.' }}
          </div>
          <div v-for="p in fBundled" :key="p.id" class="pr-lib-item">
            <span class="pr-lib-name" @click="emit('loadBundled', p.id)"
              :title="'Load ' + p.name + ' — Sd/Cms/Vas from the datasheet; Fs/Mms/Rms/Xmax not published, left blank'">{{ p.name }}</span>
          </div>
        </div>

        <div class="btns" style="margin-top:10px">
          <button @click="emit('define')" title="Define a brand-new passive radiator from scratch">＋ Define new PR</button>
          <button class="pri" @click="close" title="Close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pri { background: var(--acc); color:#fff; border-color: var(--acc); }
</style>
