<script setup>
import { ref, computed, watch } from 'vue';
import { state } from '../store.js';
import { parseWdr } from '../core/driver.js';
import sourcesJson from '../../drivers/sources.json';
import bundleJson  from '../drivers-bundle.json';

const sources     = sourcesJson.sources || [];
const allFiles    = ref([]);   // unified pool across all sources
const filterQ     = ref('');
const statusMsg   = ref('');
const statusErr   = ref(false);
const customUrl   = ref('');
const initialized = ref(false);

// SpeakerBoxLite opt-in state
const sblLoaded   = ref(false);
const sblLoading  = ref(false);

const filteredFiles = computed(() => {
  const q = filterQ.value.toLowerCase().trim();
  if (!q) return allFiles.value;
  return allFiles.value.filter(f => f.name.toLowerCase().includes(q));
});

// ── GitHub source helpers ────────────────────────────────────────────────────

async function ghDefaultBranch(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}`);
  if (!r.ok) throw new Error('repo not found (' + r.status + ')');
  return (await r.json()).default_branch || 'main';
}

async function fetchSource(src) {
  try {
    const branch = src.branch || await ghDefaultBranch(src.repo);
    const r = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) return;
    const tree = (await r.json()).tree || [];
    const base = (src.path || '').replace(/^\/|\/$/g, '');
    const found = tree
      .filter(t => t.type === 'blob' && t.path.toLowerCase().endsWith('.wdr')
                && (!base || t.path.toLowerCase().startsWith(base.toLowerCase() + '/')))
      .map(t => ({
        path: t.path, branch, repo: src.repo,
        name: t.path.split('/').pop().replace(/\.wdr$/i, ''),
        sourceName: src.name,
        sourceUrl:  src.url || '',
        sourceDesc: src.description || '',
      }));
    allFiles.value = [
      ...allFiles.value.filter(f => f.sourceName !== src.name),
      ...found,
    ];
    statusMsg.value = `${allFiles.value.length} drivers`;
  } catch {}
}

function parseRepoInput(s) {
  s = s.trim(); if (!s) return null;
  let m = s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i);
  if (m) return { name: m[1]+'/'+m[2], type:'github', repo: m[1]+'/'+m[2], branch: m[3]||'', path: m[4]||'' };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { name: s, type:'github', repo: s, branch: '', path: '' };
  return null;
}

// ── Initialise ───────────────────────────────────────────────────────────────

// Index bundled sources by name for O(1) lookup
const bundledByName = Object.fromEntries(
  (bundleJson.sources || []).map(s => [s.name, s.files])
);

async function init() {
  if (initialized.value) return;
  initialized.value = true;
  statusErr.value = false;

  // 1. Load bundled sources instantly from the pre-built JSON (no network)
  for (const src of sources) {
    const files = bundledByName[src.name];
    if (!files) continue;
    const entries = files.map(f => ({
      name: f.name,
      content: f.content,        // inline — no fetch needed on pick
      path: null, repo: null, branch: null,
      sourceName: src.name,
      sourceUrl:  src.url || '',
      sourceDesc: src.description || '',
    }));
    allFiles.value = [...allFiles.value, ...entries];
  }

  statusMsg.value = `${allFiles.value.length} drivers`;

  // 2. Fetch any non-bundled sources from GitHub in the background
  const liveSources = sources
    .filter(src => !bundledByName[src.name])
    .map(src => {
      const m = src.url?.match(/github\.com\/([^/]+\/[^/]+?)(?:\/tree\/([^/]+)(?:\/(.*?))?)?(?:\.git)?$/i);
      return m ? { ...src, repo: m[1], branch: m[2] || '', path: m[3] || '' } : src;
    })
    .filter(s => s.repo);

  if (liveSources.length) {
    await Promise.all(liveSources.map(fetchSource));
  }

  statusMsg.value = allFiles.value.length
    ? `${allFiles.value.length} drivers`
    : 'No drivers loaded — check network';
}

// ── SpeakerBoxLite opt-in load ───────────────────────────────────────────────

async function loadSpeakerBoxLite() {
  if (sblLoaded.value || sblLoading.value) return;
  sblLoading.value = true; statusErr.value = false;
  const PAGE = 500, base = 'https://speakerboxlite.com/api/v1/speakers';

  // Probe first so we can tell network-block from CORS from real errors.
  // NOTE: speakerboxlite.com returns Access-Control-Allow-Origin: * on HEAD but NOT on GET.
  // This is a server-side CORS misconfiguration — the browser blocks the GET response.
  let countResp;
  try { countResp = await fetch(base + '/count'); }
  catch (err) {
    statusErr.value = true;
    statusMsg.value = 'speakerboxlite.com CORS error — their API returns Access-Control-Allow-Origin '
      + 'on HEAD requests but not GET requests, so browsers block it. '
      + 'This is a bug on their server; nothing can be done client-side.';
    sblLoading.value = false; return;
  }
  if (!countResp.ok) {
    statusErr.value = true;
    statusMsg.value = `SpeakerBoxLite: server returned ${countResp.status}`;
    sblLoading.value = false; return;
  }

  try {
    const { count } = await countResp.json();
    const batches = Math.ceil(count / PAGE);
    const sblFiles = [];
    for (let i = 0; i < batches; i++) {
      statusMsg.value = `SpeakerBoxLite: loading ${Math.min((i+1)*PAGE, count)} / ${count}…`;
      const rows = await (await fetch(`${base}?offset=${i*PAGE}&limit=${PAGE}`)).json();
      for (const d of rows) {
        sblFiles.push({
          path: null, branch: null, repo: null,
          name: [d.brand, d.model].filter(Boolean).join(' ') || d.name || 'Unknown',
          sourceName: 'SpeakerBoxLite',
          sourceUrl:  'https://www.speakerboxlite.com/',
          sourceDesc: 'speakerboxlite.com community database',
          sblData: d,
        });
      }
    }
    allFiles.value = [...allFiles.value.filter(f => f.sourceName !== 'SpeakerBoxLite'), ...sblFiles];
    sblLoaded.value = true;
    statusMsg.value = `${allFiles.value.length} drivers total`;
  } catch (err) {
    statusErr.value = true;
    statusMsg.value = 'SpeakerBoxLite load failed mid-stream: ' + err.message;
  }
  sblLoading.value = false;
}

// ── Add custom source ────────────────────────────────────────────────────────

async function loadCustom() {
  const src = parseRepoInput(customUrl.value);
  if (!src) { statusErr.value = true; statusMsg.value = 'Enter owner/repo or a github.com URL'; return; }
  statusErr.value = false; statusMsg.value = `Loading ${src.name}…`;
  await fetchSource(src);
  customUrl.value = '';
}

// ── Pick a driver ────────────────────────────────────────────────────────────

async function pickFile(f) {
  // SpeakerBoxLite drivers carry T/S data inline; convert to WDR format
  if (f.sblData) {
    const d = f.sblData;
    const raw = {
      name:  f.name,
      brand: d.brand || '', model: d.model || '',
      Fs: d.fs, Qts: d.qts, Qes: d.qes, Qms: d.qms,
      Vas: d.vas_l != null ? d.vas_l / 1000 : undefined,  // L → m³
      Sd: d.sd_cm2 != null ? d.sd_cm2 / 1e4 : undefined,  // cm² → m²
      Re: d.re, Le: d.le_mh != null ? d.le_mh / 1000 : undefined, // mH → H
      Bl: d.bl,
      Xmax: d.xmax_mm != null ? d.xmax_mm / 1000 : undefined, // mm → m
      Mms: d.mms_g  != null ? d.mms_g  / 1000 : undefined, // g → kg
      Cms: d.cms_mm_n != null ? 1 / (d.cms_mm_n * 1000) : undefined, // mm/N → m/N
      Rms: d.rms,
      Pe:  d.pe,
    };
    // strip undefined fields so deriveDriver uses its own defaults
    Object.keys(raw).forEach(k => raw[k] === undefined && delete raw[k]);
    state.driverRaw = raw;
    state.browseOpen = false;
    return;
  }
  // Bundled drivers carry inline content — no network call needed
  if (f.content) {
    state.driverRaw = parseWdr(f.content);
    state.browseOpen = false;
    return;
  }
  statusErr.value = false; statusMsg.value = 'Loading ' + f.name + '…';
  try {
    const url = `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${f.path.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url); if (!r.ok) throw new Error('fetch failed (' + r.status + ')');
    state.driverRaw = parseWdr(await r.text());
    state.browseOpen = false;
  } catch(err) { statusErr.value = true; statusMsg.value = 'Could not load: ' + err.message; }
}

function openSourceUrl(url) {
  if (url) window.open(url, '_blank', 'noopener');
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
        <span class="x" @click="close" title="Close the driver library browser">&times;</span>
      </h2>
      <div class="body">
        <input class="filter" v-model="filterQ" placeholder="Search drivers…" autofocus>
        <div class="statusrow">
          <span class="status" :class="{ err: statusErr }">{{ statusMsg }}</span>
          <button v-if="!sblLoaded" class="sblbtn" :disabled="sblLoading"
                  title="Load ~6000 drivers from the speakerboxlite.com community database (fetched live)"
                  @click="loadSpeakerBoxLite">
            {{ sblLoading ? 'Loading…' : '+ SpeakerBoxLite' }}
          </button>
        </div>
        <div class="dlist">
          <div v-for="f in filteredFiles.slice(0, 500)" :key="(f.path || '') + f.name"
               class="ditem" @click="pickFile(f)">
            <b>{{ f.name }}</b>
            <a v-if="f.sourceUrl" class="stag"
               :title="f.sourceUrl + (f.sourceDesc ? ' — ' + f.sourceDesc : '')"
               @click.stop.prevent="openSourceUrl(f.sourceUrl)">{{ f.sourceName }}</a>
            <span v-else class="stag">{{ f.sourceName }}</span>
          </div>
          <div v-if="!filteredFiles.length && !statusErr" class="status loading">
            {{ filterQ ? 'No matching drivers.' : 'Loading…' }}
          </div>
        </div>
        <div class="addrow">
          <input v-model="customUrl" placeholder="Add GitHub source: owner/repo or full URL"
                 @keydown.enter="loadCustom"
                 title="Load .wdr files from any public GitHub repository and add them to the pool">
          <button @click="loadCustom" title="Fetch .wdr files from the specified GitHub repository">Add</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { display:none; position:fixed; inset:0; background:#0008; z-index:1000; align-items:center; justify-content:center; }
.overlay.on { display:flex; }
.modal { background:var(--bg2); border:1px solid var(--mut); border-radius:8px; width:420px; max-height:80vh; display:flex; flex-direction:column; }
h2 { margin:0; padding:12px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--mut); }
.x { cursor:pointer; font-size:18px; line-height:1; color:var(--mut); }
.x:hover { color:var(--fg); }
.body { display:flex; flex-direction:column; padding:10px; gap:6px; overflow:hidden; }
.filter { width:100%; box-sizing:border-box; padding:5px 8px; font-size:12px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.filter:focus { outline:none; border-color:var(--acc); }
.statusrow { display:flex; align-items:center; gap:8px; }
.status { font-size:11px; color:var(--mut); flex:1; }
.status.err { color:#ff6b6b; }
.sblbtn { font-size:11px; padding:2px 8px; white-space:nowrap; }
.dlist { flex:1; overflow-y:auto; border:1px solid var(--mut); border-radius:4px; min-height:200px; }
.ditem { padding:4px 10px; cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; }
.ditem:hover { background:var(--bg3); }
.stag { font-size:10px; color:var(--mut); margin-left:8px; white-space:nowrap; cursor:pointer; }
.stag:hover { color:var(--acc); text-decoration:underline; }
.status.loading { padding:8px 10px; }
.addrow { display:flex; gap:6px; }
.addrow input { flex:1; padding:4px 8px; font-size:11px; background:var(--bg); border:1px solid var(--mut); border-radius:4px; color:var(--fg); }
.addrow input:focus { outline:none; border-color:var(--acc); }
.addrow button { font-size:11px; padding:3px 10px; }
</style>
