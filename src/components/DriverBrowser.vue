<script setup>
import { ref, computed, watch } from 'vue';
import { state } from '../store.js';
import { parseWdr } from '../core/driver.js';
import sourcesJson from '../../drivers/sources.json';

const sources = ref(sourcesJson.sources || []);
const files = ref([]);
const allFiles = ref([]);
const srcIdx = ref(0);
const currentSrc = ref(null);
const filterQ = ref('');
const srcStatus = ref('');
const srcErr = ref(false);
const customUrl = ref('');
const sblCache = ref(null);

const filteredFiles = computed(() => {
  const q = filterQ.value.toLowerCase();
  if (!q) return files.value;
  const pool = allFiles.value.length ? allFiles.value : files.value;
  return pool.filter(f => f.name.toLowerCase().includes(q));
});

function mergeIntoPool(srcName, fileList) {
  allFiles.value = [
    ...allFiles.value.filter(f => f.sourceName !== srcName),
    ...fileList.map(f => ({ ...f, sourceName: srcName })),
  ];
}

async function fetchSourceIntoPool(src) {
  if (src.type === 'speakerboxlite') return;
  try {
    const resolved = src.repo ? src : parseRepoInput(src.url);
    if (!resolved) return;
    const branch = resolved.branch || await ghDefaultBranch(resolved.repo);
    const r = await fetch(`https://api.github.com/repos/${resolved.repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) return;
    const tree = (await r.json()).tree || [];
    const base = (resolved.path || '').replace(/^\/|\/$/g, '');
    const srcFiles = tree
      .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith('.wdr')
                && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
      .map(t => ({
        path: t.path, branch, repo: resolved.repo,
        name: t.path.split('/').pop().replace(/\.wdr$/i, ''),
        sourceName: src.name,
      }));
    mergeIntoPool(src.name, srcFiles);
  } catch {}
}

async function init() {
  if (srcIdx.value !== 0 || files.value.length) return;
  if (sources.value.length) await selectSource(sources.value[0]);
  for (const src of sources.value.slice(1)) fetchSourceIntoPool(src);
}

function fromSpeakerboxlite(s) {
  const d = { brand: s.manufName || '', model: s.name || '' };
  const name = [d.brand, d.model].filter(Boolean).join(' ');
  if (name) d.name = name;
  if (s.fs   > 0) d.Fs   = s.fs;
  if (s.qts  > 0) d.Qts  = s.qts;
  if (s.qes  > 0) d.Qes  = s.qes;
  if (s.qms  > 0) d.Qms  = s.qms;
  if (s.re   > 0) d.Re   = s.re;
  if (s.sd   > 0) d.Sd   = s.sd   * 1e-6;  // mm² → m²
  if (s.vas  > 0) d.Vas  = s.vas  * 1e-3;  // L → m³
  if (s.xMax > 0) d.Xmax = s.xMax * 1e-3;  // mm → m
  if (s.le   > 0) d.Le   = s.le   * 1e-3;  // mH → H
  if (s.bl   > 0) d.Bl   = s.bl;
  return d;
}

async function loadSpeakerboxlite(srcName) {
  if (sblCache.value) {
    files.value = sblCache.value;
    srcStatus.value = `${files.value.length} drivers`;
    return;
  }
  const PAGE = 500, base = 'https://speakerboxlite.com/api/v1/speakers';
  try {
    const { count } = await (await fetch(base + '/count')).json();
    srcStatus.value = `Loading ${count} drivers from speakerboxlite…`;
    let all = [];
    for (let offset = 0; offset < count; offset += PAGE) {
      const r = await fetch(`${base}?offset=${offset}&limit=${PAGE}`);
      if (!r.ok) throw new Error('speakerboxlite API error (' + r.status + ')');
      all = all.concat(await r.json());
      srcStatus.value = `Loading… ${all.length} / ${count}`;
    }
    const usable = all
      .filter(s => s.fs > 0 && s.sd > 0 && s.re > 0 && (s.vas > 0 || s.qts > 0))
      .sort((a, b) => (a.manufName + a.name).localeCompare(b.manufName + b.name))
      .map(s => ({ name: s.manufName + ' ' + s.name, sbl: s, sourceName: srcName }));
    sblCache.value = usable;
    files.value = usable;
    mergeIntoPool(srcName, usable);
    srcStatus.value = `${usable.length} drivers`;
  } catch(err) {
    srcErr.value = true; srcStatus.value = 'Error: ' + err.message;
  }
}

async function ghDefaultBranch(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}`);
  if (!r.ok) throw new Error('repo not found (' + r.status + ')');
  return (await r.json()).default_branch || 'main';
}

async function selectSource(src) {
  currentSrc.value = src; files.value = []; srcErr.value = false;
  srcStatus.value = 'Loading…';
  const srcName = src.name;
  if (src.type === 'speakerboxlite') { await loadSpeakerboxlite(srcName); return; }
  try {
    const resolved = src.repo ? src : parseRepoInput(src.url);
    if (!resolved) throw new Error('cannot parse source URL');
    const branch = resolved.branch || await ghDefaultBranch(resolved.repo);
    src = { ...src, ...resolved, branch };
    const r = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) throw new Error('cannot list files (' + r.status + (r.status === 403 ? ', rate limit' : '') + ')');
    const tree = (await r.json()).tree || [];
    const ext = '.wdr';
    const base = (src.path || '').replace(/^\/|\/$/g, '');
    files.value = tree
      .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith(ext)
                && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
      .map(t => ({ path: t.path, branch, repo: src.repo,
                   name: t.path.split('/').pop().replace(/\.wdr$/i, ''), sourceName: srcName }));
    mergeIntoPool(srcName, files.value);
    srcStatus.value = `${files.value.length} drivers`;
  } catch(err) {
    srcErr.value = true; srcStatus.value = 'Error: ' + err.message;
  }
}

function rawUrl(f) {
  return `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${f.path.split('/').map(encodeURIComponent).join('/')}`;
}

async function pickFile(f) {
  if (f.sbl) {
    state.driverRaw = fromSpeakerboxlite(f.sbl);
    state.browseOpen = false;
    return;
  }
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
  if (m) return { name:m[1]+'/'+m[2], type:'github', repo:m[1]+'/'+m[2], branch:m[3]||'', path:m[4]||'', url:'https://github.com/'+m[1]+'/'+m[2] };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { name:s, type:'github', repo:s, branch:'', path:'', url:'https://github.com/'+s };
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
          <div v-for="f in filteredFiles.slice(0, 500)" :key="f.path || f.name"
               class="ditem" @click="pickFile(f)">
            <b>{{ f.name }}</b>
            <span v-if="filterQ && f.sourceName" class="stag">{{ f.sourceName }}</span>
          </div>
          <div v-if="!filteredFiles.length && srcStatus && !srcErr" class="status loading">{{ srcStatus }}</div>
          <div v-if="!filteredFiles.length && !srcStatus" class="status">No matching drivers.</div>
        </div>
        <div class="status" :class="{ err: srcErr }">{{ srcErr ? srcStatus : '' }}</div>
      </div>
    </div>
  </div>
</template>
