<script setup lang="ts">
import { ref, computed } from 'vue';
import { listPRs, deletePR, listBundledPRs } from '../utils/prLibrary.js';
import type { PRLibEntry, BundledPR } from '../types.js';
import { useEscToClose } from '../composables/useEscToClose.js';

// PR browser — a popup mirroring the driver browser (DriverBrowser.vue): two
// sections, "Saved" (your localStorage PR library) and "Bundled" (passive radiators
// pulled from the driver collections), plus a "Define new PR" affordance. Replaces
// PRPanel's old inline saved-only list, which never surfaced the bundled PRs.

const emit = defineEmits<{
  close: [];
  load: [PRLibEntry];
  loadBundled: [BundledPR];
  define: [];
}>();

const saved = ref(listPRs());
const bundled = listBundledPRs();
const filter = ref('');

const fSaved = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return q ? saved.value.filter(e => e.name.toLowerCase().includes(q)) : saved.value;
});
const fBundled = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return q ? bundled.filter(p => p.name.toLowerCase().includes(q)) : bundled;
});

function loadSaved(e: PRLibEntry) { emit('load', e); }
function loadBundledPR(p: BundledPR) { emit('loadBundled', p); }
function remove(id: number) { saved.value = deletePR(id); }
function define() { emit('define'); }
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
            <span class="pr-lib-name" @click="loadSaved(e)"
              :title="`Load ${e.name} — Sd=${(e.prSd*1e4).toFixed(0)}cm² Mms=${(e.prMmd*1000).toFixed(1)}g Cms=${(e.prCms*1000).toFixed(2)}mm/N`">{{ e.name }}</span>
            <button class="pr-lib-del" @click="remove(e.id)" title="Remove this PR from your library">✕</button>
          </div>

          <div class="pr-lib-hdr"
            title="Passive radiators bundled from the driver collections. Datasheets publish Sd/Cms/Vas only — Fs/Mms/Rms/Xmax are left blank for you to supply.">Bundled</div>
          <div v-if="!fBundled.length" style="color:var(--mut);font-size:11px;padding:4px 8px">
            {{ filter ? 'No bundled PRs match.' : 'No bundled passive radiators in the current collection.' }}
          </div>
          <div v-for="p in fBundled" :key="p.key + '/' + p.path" class="pr-lib-item">
            <span class="pr-lib-name" @click="loadBundledPR(p)"
              :title="'Load ' + p.name + ' — Sd/Cms/Vas from the datasheet; Fs/Mms/Rms/Xmax not published, left blank'">{{ p.name }}</span>
          </div>
        </div>

        <div class="btns" style="margin-top:10px">
          <button @click="define" title="Define a brand-new passive radiator from scratch">＋ Define new PR</button>
          <button class="pri" @click="close" title="Close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pri { background: var(--acc); color:#fff; border-color: var(--acc); }
</style>
