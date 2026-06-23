<script setup>
import { ref, computed, watch } from 'vue';
import { state } from '../store.js';
import { parseWdr } from '../core/driver.js';

const DEFAULT_SOURCES = [
  { name:'Resonate built-in', type:'github', repo:'Johnlon/resonate', branch:'main', path:'drivers', fileExtension:'.wdr', url:'https://github.com/Johnlon/resonate/tree/main/drivers' },
  { name:'MWisBest / WinISDDrivers', type:'github', repo:'MWisBest/WinISDDrivers', branch:'master', path:'', fileExtension:'.wdr', url:'https://github.com/MWisBest/WinISDDrivers' },
];

const sources = ref([]);
const files = ref([]);
const srcIdx = ref(0);
const currentSrc = ref(null);
const filterQ = ref('');
const srcStatus = ref('');
const srcErr = ref(false);
const customUrl = ref('');

const filteredFiles = computed(() => {
  const q = filterQ.value.toLowerCase();
  return q ? files.value.filter(f => f.name.toLowerCase().includes(q)) : files.value;
});

async function init() {
  if (sources.value.length) return;
  try {
    const r = await fetch('drivers/sources.json', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      if (j?.sources?.length) { sources.value = j.sources; }
    }
  } catch {}
  if (!sources.value.length) sources.value = [...DEFAULT_SOURCES];
  await selectSource(sources.value[0]);
}

async function ghDefaultBranch(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}`);
  if (!r.ok) throw new Error('repo not found (' + r.status + ')');
  return (await r.json()).default_branch || 'main';
}

async function selectSource(src) {
  currentSrc.value = src; files.value = []; srcErr.value = false;
  srcStatus.value = 'Loading file list…';
  try {
    const branch = src.branch || await ghDefaultBranch(src.repo);
    const r = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) throw new Error('cannot list files (' + r.status + (r.status === 403 ? ', rate limit' : '') + ')');
    const tree = (await r.json()).tree || [];
    const ext = (src.fileExtension || '.wdr').toLowerCase();
    const base = (src.path || '').replace(/^\/|\/$/g, '');
    files.value = tree
      .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith(ext)
                && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
      .map(t => ({ path: t.path, branch, repo: src.repo, name: t.path.split('/').pop().replace(/\.wdr$/i, '') }));
    srcStatus.value = `${files.value.length} drivers`;
  } catch(err) {
    srcErr.value = true; srcStatus.value = 'Error: ' + err.message;
  }
}

function rawUrl(f) {
  return `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${f.path.split('/').map(encodeURIComponent).join('/')}`;
}

async function pickFile(f) {
  srcErr.value = false; srcStatus.value = 'Loading ' + f.name + '…';
  try {
    const r = await fetch(rawUrl(f)); if (!r.ok) throw new Error('fetch failed (' + r.status + ')');
    state.driverRaw = parseWdr(await r.text());
    state.browseOpen = false;
  } catch(err) { srcErr.value = true; srcStatus.value = 'Could not load: ' + err.message; }
}

function parseRepoInput(s) {
  s = s.trim(); if (!s) return null;
  let m = s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i);
  if (m) return { name:m[1]+'/'+m[2], type:'github', repo:m[1]+'/'+m[2], branch:m[3]||'', path:m[4]||'', fileExtension:'.wdr', url:'https://github.com/'+m[1]+'/'+m[2] };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { name:s, type:'github', repo:s, branch:'', path:'', fileExtension:'.wdr', url:'https://github.com/'+s };
  return null;
}

function loadCustom() {
  const src = parseRepoInput(customUrl.value);
  if (!src) { srcErr.value = true; srcStatus.value = 'Enter owner/repo or a github.com URL'; return; }
  selectSource(src);
}

watch(() => state.browseOpen, val => { if (val) init(); });
function close() { state.browseOpen = false; }
function onBackdrop(e) { if (e.target === e.currentTarget) close(); }
</script>

<template>
  <div class="overlay" :class="{ on: state.browseOpen }" @click="onBackdrop">
    <div class="modal" v-if="state.browseOpen">
      <h2>
        Browse driver library
        <span class="x" @click="close">&times;</span>
      </h2>
      <div class="body">
        <div class="srcrow">
          <select @change="e => selectSource(sources[+e.target.value])">
            <option v-for="(s, i) in sources" :key="i" :value="i">{{ s.name }}</option>
          </select>
          <input v-model="customUrl" placeholder="…or paste: owner/repo or github.com URL" @keydown.enter="loadCustom">
          <button @click="loadCustom">Load</button>
        </div>
        <div v-if="currentSrc" class="srcmeta">
          <a v-if="currentSrc.url" :href="currentSrc.url" target="_blank" rel="noopener">{{ currentSrc.url }}</a>
          <template v-if="currentSrc.description"> — {{ currentSrc.description }}</template>
        </div>
        <input class="filter" v-model="filterQ" placeholder="Filter drivers…">
        <div class="dlist">
          <div v-for="f in filteredFiles.slice(0, 500)" :key="f.path"
               class="ditem" @click="pickFile(f)">
            <b>{{ f.name }}</b>
          </div>
          <div v-if="!filteredFiles.length && !srcStatus" class="status">No matching drivers.</div>
        </div>
        <div class="status" :class="{ err: srcErr }">{{ srcStatus }}</div>
      </div>
    </div>
  </div>
</template>
